import { chromium, type Browser, type Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import logger from '../pipelines/shared/logger.js';
import { CheckpointManager } from '../pipelines/shared/checkpoint.js';

const __dirname = pathDirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../.env') });

const BASE_URL = 'https://www.indiacode.nic.in';
const ACTS_INDEX_URL = `${BASE_URL}/handle/123456789/1362`;
const DELAY_MS = 2000;

interface ActMetadata {
  title: string;
  act_number: string;
  year: number;
  ministry: string;
  short_title: string;
  pdf_url: string | null;
  enactment_date: string | null;
  last_amended_date: string | null;
  source_url: string;
  scrape_timestamp: string;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function getMetaCell(page: Page, label: string): Promise<string | null> {
  try {
    const locators = [
      page.locator(`table.table tr:has(td:text-is("${label}")) td`).nth(1),
      page.locator(`tr:has(th:text-is("${label}")) td`).first(),
      page.locator(`.metadata-field:has(.label:text-is("${label}")) .value`).first(),
      page.locator(`td.label-cell:text-is("${label}") + td`).first(),
    ];
    for (const loc of locators) {
      const text = await loc.textContent({ timeout: 1500 }).catch(() => null);
      if (text?.trim()) return text.trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function extractActMetadata(page: Page, actUrl: string): Promise<ActMetadata | null> {
  try {
    await page.goto(actUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const title =
      (await page
        .locator('h2.page-header, h1.first-page-header, .item-title h3, .item-view-head h2, h1, h2')
        .first()
        .textContent({ timeout: 3000 })
        .catch(() => null))
        ?.trim() ?? '';

    const actNumber = await getMetaCell(page, 'Act Number') ?? await getMetaCell(page, 'Act No.');
    const yearStr =
      await getMetaCell(page, 'Year') ??
      await getMetaCell(page, 'Enactment Year') ??
      await getMetaCell(page, 'year');
    const ministry =
      await getMetaCell(page, 'Ministry') ??
      await getMetaCell(page, 'Department') ??
      '';
    const shortTitle =
      await getMetaCell(page, 'Short Title') ??
      await getMetaCell(page, 'short title') ??
      title;
    const enactmentDate =
      await getMetaCell(page, 'Enactment Date') ??
      await getMetaCell(page, 'Date of Enactment') ??
      await getMetaCell(page, 'date.issued');
    const lastAmended =
      await getMetaCell(page, 'Last Amended') ??
      await getMetaCell(page, 'Last Amendment') ??
      await getMetaCell(page, 'date.modified');

    // Find PDF download link — prefer direct .pdf href, fall back to bitstream
    const pdfHref = await page
      .locator('a[href$=".pdf"], a[href*="/bitstream/"]')
      .first()
      .getAttribute('href', { timeout: 3000 })
      .catch(() => null);

    const pdfUrl = pdfHref
      ? pdfHref.startsWith('http')
        ? pdfHref
        : `${BASE_URL}${pdfHref}`
      : null;

    const rawYear = parseInt(yearStr ?? '0', 10);
    const year = isFinite(rawYear) && rawYear > 1800 ? rawYear : 0;

    return {
      title,
      act_number: actNumber?.trim() ?? '',
      year,
      ministry: ministry ?? '',
      short_title: shortTitle?.trim() ?? title,
      pdf_url: pdfUrl,
      enactment_date: enactmentDate ?? null,
      last_amended_date: lastAmended ?? null,
      source_url: actUrl,
      scrape_timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn(`Could not extract metadata from ${actUrl}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function downloadPdf(
  page: Page,
  pdfUrl: string,
  destPath: string
): Promise<boolean> {
  try {
    const response = await page.goto(pdfUrl, { waitUntil: 'load', timeout: 60_000 });
    if (!response) return false;

    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      return false;
    }

    const buffer = await response.body();
    if (buffer.length < 1000) return false;

    await writeFile(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function processActUrl(
  page: Page,
  actUrl: string,
  filename: string,
  checkpoint: CheckpointManager,
  rawDataDir: string
): Promise<'success' | 'error' | 'skip'> {
  if (checkpoint.isProcessed(actUrl)) return 'skip';

  await sleep(DELAY_MS);

  const meta = await extractActMetadata(page, actUrl);
  if (!meta) {
    await checkpoint.mark(actUrl, 'error', { error: 'metadata extraction failed' });
    return 'error';
  }

  const year = meta.year || 0;
  const destDir = join(rawDataDir, 'legislation', String(year));
  await mkdir(destDir, { recursive: true });

  const metaPath = join(destDir, `${filename}.meta.json`);
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  if (meta.pdf_url) {
    const pdfPath = join(destDir, `${filename}.pdf`);
    if (!existsSync(pdfPath)) {
      await sleep(DELAY_MS);
      const ok = await downloadPdf(page, meta.pdf_url, pdfPath);
      if (!ok) {
        logger.warn(`PDF unavailable: ${meta.title}`, { url: meta.pdf_url });
      }
      // Navigate back so the browser doesn't stay on the PDF viewer
      await page.goto(actUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => null);
    }
  }

  await checkpoint.mark(actUrl, 'success', { title: meta.title, year: String(year) });
  return 'success';
}

async function scrapeActsIndex(
  page: Page,
  checkpoint: CheckpointManager,
  rawDataDir: string
): Promise<{ processed: number; errors: number; skipped: number }> {
  let processed = 0;
  let errors = 0;
  let skipped = 0;
  let currentUrl: string | null = ACTS_INDEX_URL;

  while (currentUrl) {
    logger.info(`Loading acts index page: ${currentUrl}`);

    try {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (err) {
      logger.error('Failed to load index page', {
        url: currentUrl,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }

    // DSpace item list — anchors pointing to individual handle pages
    const actLinks: string[] = await page
      .locator('a[href*="/handle/123456789/"]')
      .evaluateAll((els: Element[]) =>
        els
          .map(el => (el as HTMLAnchorElement).href)
          .filter(
            href =>
              /\/handle\/123456789\/\d+$/.test(href) &&
              !href.endsWith('/1362')
          )
      );

    // Deduplicate within this page
    const uniqueLinks = [...new Set(actLinks)];
    logger.debug(`Found ${uniqueLinks.length} act links on this page`);

    for (const actUrl of uniqueLinks) {
      const slug = actUrl.split('/').pop() ?? actUrl;
      const result = await processActUrl(
        page,
        actUrl,
        `act-${slug}`,
        checkpoint,
        rawDataDir
      ).catch(err => {
        logger.warn(`Error processing ${actUrl}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        return 'error' as const;
      });

      if (result === 'success') {
        processed++;
        logger.info(`[${processed}] Saved act: ${actUrl}`);
      } else if (result === 'error') {
        errors++;
      } else {
        skipped++;
      }
    }

    // Pagination: DSpace typically uses rel=next or an explicit "next page" link
    const nextHref = await page
      .locator('a[rel="next"], a[title="next page"], a[aria-label="next"], .pagination .next a')
      .first()
      .getAttribute('href')
      .catch(() => null);

    if (nextHref) {
      currentUrl = nextHref.startsWith('http') ? nextHref : `${BASE_URL}${nextHref}`;
    } else {
      currentUrl = null;
    }
  }

  return { processed, errors, skipped };
}

// Verified handle IDs for high-priority acts — confirm at indiacode.nic.in before running
const HIGH_PRIORITY_ACTS: Array<{ name: string; url: string }> = [
  { name: 'constitution-of-india', url: `${BASE_URL}/handle/123456789/1294` },
  { name: 'indian-penal-code-1860', url: `${BASE_URL}/handle/123456789/2263` },
  { name: 'code-of-criminal-procedure-1973', url: `${BASE_URL}/handle/123456789/1353` },
  { name: 'code-of-civil-procedure-1908', url: `${BASE_URL}/handle/123456789/2163` },
  { name: 'indian-contract-act-1872', url: `${BASE_URL}/handle/123456789/1350` },
  { name: 'transfer-of-property-act-1882', url: `${BASE_URL}/handle/123456789/1348` },
  { name: 'limitation-act-1963', url: `${BASE_URL}/handle/123456789/1562` },
  { name: 'indian-evidence-act-1872', url: `${BASE_URL}/handle/123456789/2253` },
  { name: 'companies-act-2013', url: `${BASE_URL}/handle/123456789/2044` },
  { name: 'income-tax-act-1961', url: `${BASE_URL}/handle/123456789/2348` },
  { name: 'cgst-act-2017', url: `${BASE_URL}/handle/123456789/9346` },
  { name: 'igst-act-2017', url: `${BASE_URL}/handle/123456789/9347` },
  { name: 'arbitration-conciliation-act-1996', url: `${BASE_URL}/handle/123456789/1380` },
  { name: 'consumer-protection-act-2019', url: `${BASE_URL}/handle/123456789/13749` },
  { name: 'rera-act-2016', url: `${BASE_URL}/handle/123456789/2148` },
  { name: 'insolvency-bankruptcy-code-2016', url: `${BASE_URL}/handle/123456789/2114` },
];

async function scrapeHighPriorityActs(
  page: Page,
  checkpoint: CheckpointManager,
  rawDataDir: string
): Promise<{ processed: number; errors: number; skipped: number }> {
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (const act of HIGH_PRIORITY_ACTS) {
    const result = await processActUrl(page, act.url, act.name, checkpoint, rawDataDir).catch(
      err => {
        logger.warn(`Error processing high-priority act ${act.name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        return 'error' as const;
      }
    );

    if (result === 'success') {
      processed++;
      logger.info(`[HP ${processed}] Saved: ${act.name}`);
    } else if (result === 'error') {
      errors++;
    } else {
      skipped++;
    }
  }

  return { processed, errors, skipped };
}

async function main(): Promise<void> {
  const rawDataDir = process.env['RAW_DATA_DIR'];
  if (!rawDataDir) throw new Error('RAW_DATA_DIR env var must be set in data/.env');

  await mkdir(rawDataDir, { recursive: true });

  const checkpoint = new CheckpointManager('india-code-scraper');
  await checkpoint.load();

  logger.info('Launching Playwright browser (headless chromium)');
  const browser: Browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page: Page = await context.newPage();

  try {
    logger.info('Phase 1: Scraping high-priority acts');
    const hpResult = await scrapeHighPriorityActs(page, checkpoint, rawDataDir);
    logger.info('High-priority acts complete', hpResult);

    logger.info('Phase 2: Scraping full Central Acts index');
    const indexResult = await scrapeActsIndex(page, checkpoint, rawDataDir);
    logger.info('Acts index scrape complete', indexResult);

    const total = hpResult.processed + indexResult.processed;
    const totalErrors = hpResult.errors + indexResult.errors;
    const totalSkipped = hpResult.skipped + indexResult.skipped;

    logger.info('India Code scrape finished', {
      total,
      errors: totalErrors,
      skipped: totalSkipped,
    });
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  logger.error('Fatal error', { error: String(err) });
  process.exit(1);
});
