import { readdir } from 'fs/promises';
import { join, relative, basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import pLimit from 'p-limit';
import { CheckpointManager } from './shared/checkpoint.js';
import { extractNativePdf } from './extractors/native-pdf.js';
import { assessExtractionQuality } from './extractors/quality.js';
import { saveExtractedDocument } from './extractors/storage.js';
import type { ExtractionResult } from './shared/types.js';
import logger from './shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

const COURT_PRIORITY = [
  'supreme-court',
  'delhi-hc',
  'bombay-hc',
  'madras-hc',
  'calcutta-hc',
  'karnataka-hc',
];

const JURISDICTION_MAP: Record<string, string> = {
  'supreme-court': 'national',
  'delhi-hc': 'delhi',
  'bombay-hc': 'maharashtra',
  'madras-hc': 'tamil-nadu',
  'calcutta-hc': 'west-bengal',
  'karnataka-hc': 'karnataka',
  'india-code': 'national',
};

// Loaded lazily so a missing Ghostscript install doesn't crash the runner
type OcrExtractFn = (
  filePath: string,
  language?: string,
) => Promise<{ text: string; pageCount: number; pages: Array<{ pageNumber: number; text: string }> }>;

let extractOcrPdf: OcrExtractFn | null = null;

async function initOcr(): Promise<void> {
  try {
    const mod = await import('./extractors/ocr-pdf.js');
    extractOcrPdf = mod.extractOcrPdf as OcrExtractFn;
    logger.info('OCR (Ghostscript + Tesseract) available');
  } catch (err) {
    logger.warn('OCR unavailable — skipping for scanned PDFs', {
      hint: err instanceof Error ? err.message : String(err),
    });
  }
}

interface CliArgs {
  dryRun: boolean;
  limit: number;
  court: string | undefined;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined =>
    argv.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=');
  return {
    dryRun: argv.includes('--dry-run'),
    limit: get('--limit') !== undefined ? parseInt(get('--limit')!, 10) : Infinity,
    court: get('--court'),
  };
}

async function walkPdfs(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries.map(async entry => {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await walkPdfs(fullPath)));
        } else if (entry.isFile() && (entry.name as string).endsWith('.pdf')) {
          results.push(fullPath);
        }
      }),
    );
  } catch {
    // dir doesn't exist or isn't accessible
  }
  return results;
}

interface FileMeta {
  docType: 'judgment' | 'legislation' | 'tribunal_order';
  court: string;
  year: number;
}

function parseMeta(filePath: string, rawDataDir: string): FileMeta {
  // Relative path: e.g. "judgments/supreme-court/2023/case.pdf"
  //                  or "legislation/2019/filename.pdf"
  const rel = relative(rawDataDir, filePath);
  const parts = rel.split('/');
  const typeDir = parts[0] ?? '';

  let docType: FileMeta['docType'] = 'judgment';
  if (typeDir === 'legislation') docType = 'legislation';
  else if (typeDir === 'tribunal') docType = 'tribunal_order';

  if (docType === 'legislation') {
    return { docType, court: 'india-code', year: parseInt(parts[1] ?? '0', 10) };
  }
  return {
    docType,
    court: parts[1] ?? 'unknown',
    year: parseInt(parts[2] ?? '0', 10),
  };
}

function sortFiles(files: string[], rawDataDir: string): string[] {
  return [...files].sort((a, b) => {
    const mA = parseMeta(a, rawDataDir);
    const mB = parseMeta(b, rawDataDir);

    // Judgments before everything else
    if (mA.docType !== mB.docType) {
      if (mA.docType === 'judgment') return -1;
      if (mB.docType === 'judgment') return 1;
    }

    // Within judgments: SC first, then HCs in priority order
    if (mA.docType === 'judgment' && mB.docType === 'judgment') {
      const rankA = COURT_PRIORITY.indexOf(mA.court);
      const rankB = COURT_PRIORITY.indexOf(mB.court);
      const normA = rankA === -1 ? COURT_PRIORITY.length : rankA;
      const normB = rankB === -1 ? COURT_PRIORITY.length : rankB;
      if (normA !== normB) return normA - normB;
    }

    // Within each court: newer years first
    return mB.year - mA.year;
  });
}

async function main(): Promise<void> {
  const { dryRun, limit, court: courtFilter } = parseArgs();
  const rawDataDir = process.env['RAW_DATA_DIR'];
  if (!rawDataDir) throw new Error('RAW_DATA_DIR env var must be set in data/.env');

  logger.info('Starting extraction pipeline', { dryRun, limit, courtFilter, rawDataDir });

  await initOcr();

  const checkpoint = new CheckpointManager('extract');
  const processed = await checkpoint.load();

  let allFiles = await walkPdfs(rawDataDir);

  if (courtFilter) {
    allFiles = allFiles.filter(f => f.includes(`/${courtFilter}/`));
  }

  const sorted = sortFiles(allFiles, rawDataDir);
  const pending = sorted.filter(f => !checkpoint.isProcessed(f));
  const toProcess = isFinite(limit) ? pending.slice(0, limit) : pending;
  const skipped = allFiles.length - pending.length;

  logger.info('Queue ready', {
    total: allFiles.length,
    alreadyDone: processed.size,
    pending: pending.length,
    queued: toProcess.length,
  });

  if (toProcess.length === 0) {
    logger.info('Nothing to process — all files already checkpointed');
    return;
  }

  const limiter = pLimit(4);
  let extracted = 0;
  let errors = 0;
  let done = 0;

  const tasks = toProcess.map(filePath =>
    limiter(async () => {
      const { docType, court, year } = parseMeta(filePath, rawDataDir);
      const filename = basename(filePath);

      try {
        // Native PDF extraction
        const native = await extractNativePdf(filePath);
        const nativeQ = assessExtractionQuality(native.text, native.pageCount);

        let finalText = native.text;
        let pageCount = native.pageCount;
        let method: ExtractionResult['extraction_method'] = 'native_pdf';
        let qualityScore = nativeQ.quality;
        let nonAsciiRatio = nativeQ.nonAsciiRatio;

        logger.debug('Native quality', { file: filename, quality: nativeQ.quality.toFixed(2), reason: nativeQ.reason });

        if (nativeQ.needsOcr && extractOcrPdf !== null) {
          logger.info(`OCR triggered for ${filename}`, { reason: nativeQ.reason });
          try {
            const ocr = await extractOcrPdf(filePath);
            const ocrQ = assessExtractionQuality(ocr.text, ocr.pageCount);
            if (ocr.text.length > 0 && ocrQ.quality > nativeQ.quality) {
              finalText = ocr.text;
              pageCount = ocr.pageCount;
              method = native.text.length > 0 ? 'hybrid' : 'ocr';
              qualityScore = ocrQ.quality;
              nonAsciiRatio = ocrQ.nonAsciiRatio;
              logger.info(`OCR improved quality for ${filename}`, {
                native: nativeQ.quality.toFixed(2),
                ocr: ocrQ.quality.toFixed(2),
              });
            }
          } catch (ocrErr) {
            logger.warn(`OCR failed for ${filename} — using native result`, {
              error: ocrErr instanceof Error ? ocrErr.message : String(ocrErr),
            });
          }
        } else if (nativeQ.needsOcr) {
          logger.warn(`OCR needed but unavailable for ${filename}`);
        }

        const extractionResult: ExtractionResult = {
          document_id: '',
          raw_text: finalText,
          page_count: pageCount,
          extraction_method: method,
          char_count: finalText.length,
          non_ascii_ratio: nonAsciiRatio,
          quality_score: qualityScore,
          language_detected: 'english',
        };

        const title = filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
        const jurisdiction = JURISDICTION_MAP[court] ?? 'national';

        if (!dryRun) {
          const docId = await saveExtractedDocument({
            localFilePath: filePath,
            extractionResult,
            documentMeta: {
              document_type: docType,
              court,
              year,
              jurisdiction,
              language: 'english',
              source_url: `file://${filePath}`,
              title,
              metadata: { original_filename: filename },
            },
          });
          extractionResult.document_id = docId;
          await checkpoint.mark(filePath, 'success', { document_id: docId, method });
        } else {
          logger.info(`[DRY RUN] ${filename}`, { docType, court, year, chars: finalText.length, method });
          await checkpoint.mark(filePath, 'success', { dry_run: true, method });
        }

        extracted++;
      } catch (err) {
        errors++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed: ${filename}`, { error: message });
        await checkpoint.mark(filePath, 'error', { error: message });
      }

      done++;
      if (done % 50 === 0) {
        logger.info('Progress', { done, extracted, errors, total: toProcess.length });
      }
    }),
  );

  await Promise.all(tasks);

  logger.info('Extraction complete', {
    extracted,
    errors,
    skipped,
    total: toProcess.length,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
