import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, resolve, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import logger from '../pipelines/shared/logger.js';
import type { CheckpointEntry } from '../pipelines/shared/types.js';

const __dirname = pathDirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../.env') });

const CHECKPOINT_DIR = resolve(__dirname, '../.checkpoints');
const REPORTS_DIR = resolve(__dirname, '../.reports');

const KNOWN_COURTS = [
  'supreme-court',
  'delhi-hc',
  'bombay-hc',
  'madras-hc',
  'calcutta-hc',
  'karnataka-hc',
] as const;

interface CourtReport {
  court: string;
  totalPdfs: number;
  totalSizeBytes: number;
  totalSizeGb: number;
  yearRange: [number, number] | null;
  corruptFiles: string[];
  orphanMetaFiles: string[];
}

interface LegislationReport {
  totalActs: number;
  totalSizeBytes: number;
  totalSizeGb: number;
  pdfsWithoutMeta: string[];
  corruptFiles: string[];
}

interface CheckpointCrossCheck {
  checkpointName: string;
  successCount: number;
  ghostFiles: string[];
}

interface VerificationReport {
  timestamp: string;
  rawDataDir: string;
  courts: CourtReport[];
  legislation: LegislationReport;
  checkpointCrossChecks: CheckpointCrossCheck[];
  integrityIssues: string[];
  clean: boolean;
}

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  await Promise.all(
    entries.map(async entry => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await walkDir(full);
        files.push(...nested);
      } else {
        files.push(full);
      }
    })
  );
  return files;
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function analyzeCourtDir(courtDir: string, court: string): Promise<CourtReport> {
  const allFiles = await walkDir(courtDir);
  const pdfFiles = allFiles.filter(f => extname(f).toLowerCase() === '.pdf');
  const metaFiles = allFiles.filter(f => f.endsWith('.meta.json'));

  let totalSizeBytes = 0;
  const corruptFiles: string[] = [];
  const yearSet = new Set<number>();

  await Promise.all(
    pdfFiles.map(async f => {
      const size = await fileSize(f);
      totalSizeBytes += size;
      if (size < 1000) corruptFiles.push(f);

      // Path relative to courtDir: {year}/{filename}.pdf
      const rel = f.slice(courtDir.length + 1);
      const yearPart = rel.split('/')[0] ?? '';
      const y = parseInt(yearPart, 10);
      if (isFinite(y) && y > 1800 && y < 2200) yearSet.add(y);
    })
  );

  const orphanMetaFiles: string[] = [];
  for (const m of metaFiles) {
    const pdfPath = m.replace(/\.meta\.json$/, '.pdf');
    if (!existsSync(pdfPath)) orphanMetaFiles.push(m);
  }

  const years = [...yearSet];
  const yearRange: [number, number] | null =
    years.length > 0
      ? [
          years.reduce((a, b) => Math.min(a, b), years[0]!),
          years.reduce((a, b) => Math.max(a, b), years[0]!),
        ]
      : null;

  return {
    court,
    totalPdfs: pdfFiles.length,
    totalSizeBytes,
    totalSizeGb: parseFloat((totalSizeBytes / 1e9).toFixed(3)),
    yearRange,
    corruptFiles,
    orphanMetaFiles,
  };
}

async function analyzeLegislationDir(legDir: string): Promise<LegislationReport> {
  const allFiles = await walkDir(legDir);
  const pdfFiles = allFiles.filter(f => extname(f).toLowerCase() === '.pdf');

  let totalSizeBytes = 0;
  const corruptFiles: string[] = [];

  await Promise.all(
    pdfFiles.map(async f => {
      const size = await fileSize(f);
      totalSizeBytes += size;
      if (size < 1000) corruptFiles.push(f);
    })
  );

  const pdfsWithoutMeta = pdfFiles.filter(
    f => !existsSync(f.replace(/\.pdf$/i, '.meta.json'))
  );

  return {
    totalActs: pdfFiles.length,
    totalSizeBytes,
    totalSizeGb: parseFloat((totalSizeBytes / 1e9).toFixed(3)),
    pdfsWithoutMeta,
    corruptFiles,
  };
}

async function loadCheckpointSuccesses(name: string): Promise<CheckpointEntry[]> {
  const path = join(CHECKPOINT_DIR, `${name}.jsonl`);
  if (!existsSync(path)) return [];

  const raw = await readFile(path, 'utf-8');
  const entries: CheckpointEntry[] = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as CheckpointEntry;
      if (e.status === 'success') entries.push(e);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

async function crossCheckAwsCheckpoint(
  rawDataDir: string
): Promise<CheckpointCrossCheck> {
  const entries = await loadCheckpointSuccesses('download-aws');
  const ghostFiles: string[] = [];

  for (const entry of entries) {
    // S3 key format: judgments/{court}/{year}/{filename}.pdf
    // Local path: {rawDataDir}/{court}/{year}/{filename}.pdf
    const keyWithoutPrefix = entry.id.startsWith('judgments/')
      ? entry.id.slice('judgments/'.length)
      : entry.id;
    const localPath = join(rawDataDir, ...keyWithoutPrefix.split('/'));
    if (!existsSync(localPath)) ghostFiles.push(entry.id);
  }

  return {
    checkpointName: 'download-aws',
    successCount: entries.length,
    ghostFiles,
  };
}

async function crossCheckScraperCheckpoint(
  rawDataDir: string
): Promise<CheckpointCrossCheck> {
  const entries = await loadCheckpointSuccesses('india-code-scraper');
  const ghostFiles: string[] = [];

  for (const entry of entries) {
    const meta = entry.metadata as Record<string, string> | undefined;
    if (!meta) continue;

    const name = meta['name'];
    const year = meta['year'] ?? '0';

    if (name) {
      // High-priority acts use the act name as filename
      const metaPath = join(rawDataDir, 'legislation', year, `${name}.meta.json`);
      if (!existsSync(metaPath)) ghostFiles.push(entry.id);
    } else {
      // Index-scraped acts use act-{id} as filename
      const slug = entry.id.split('/').pop();
      if (slug) {
        const metaPath = join(rawDataDir, 'legislation', year, `act-${slug}.meta.json`);
        if (!existsSync(metaPath)) ghostFiles.push(entry.id);
      }
    }
  }

  return {
    checkpointName: 'india-code-scraper',
    successCount: entries.length,
    ghostFiles,
  };
}

async function main(): Promise<void> {
  const rawDataDir = process.env['RAW_DATA_DIR'];
  if (!rawDataDir) throw new Error('RAW_DATA_DIR env var must be set in data/.env');

  logger.info('Starting download verification', { rawDataDir });
  await mkdir(REPORTS_DIR, { recursive: true });

  const integrityIssues: string[] = [];
  const courts: CourtReport[] = [];

  // --- Court directories ---
  for (const court of KNOWN_COURTS) {
    const courtDir = join(rawDataDir, court);
    if (!existsSync(courtDir)) {
      logger.info(`Court directory absent, skipping: ${court}`);
      continue;
    }

    const report = await analyzeCourtDir(courtDir, court);
    courts.push(report);

    logger.info(`Court: ${court}`, {
      pdfs: report.totalPdfs,
      sizeGb: report.totalSizeGb,
      years: report.yearRange,
      corrupt: report.corruptFiles.length,
    });

    if (report.corruptFiles.length > 0) {
      integrityIssues.push(
        `${court}: ${report.corruptFiles.length} corrupt PDFs (< 1 KB)`
      );
    }
    if (report.orphanMetaFiles.length > 0) {
      integrityIssues.push(
        `${court}: ${report.orphanMetaFiles.length} orphan .meta.json files missing their PDF`
      );
    }
  }

  // --- Legislation directory ---
  const legDir = join(rawDataDir, 'legislation');
  let legislation: LegislationReport = {
    totalActs: 0,
    totalSizeBytes: 0,
    totalSizeGb: 0,
    pdfsWithoutMeta: [],
    corruptFiles: [],
  };

  if (existsSync(legDir)) {
    legislation = await analyzeLegislationDir(legDir);
    logger.info('Legislation', {
      acts: legislation.totalActs,
      sizeGb: legislation.totalSizeGb,
      missingMeta: legislation.pdfsWithoutMeta.length,
      corrupt: legislation.corruptFiles.length,
    });

    if (legislation.pdfsWithoutMeta.length > 0) {
      integrityIssues.push(
        `Legislation: ${legislation.pdfsWithoutMeta.length} PDFs missing .meta.json`
      );
    }
    if (legislation.corruptFiles.length > 0) {
      integrityIssues.push(
        `Legislation: ${legislation.corruptFiles.length} corrupt PDFs (< 1 KB)`
      );
    }
  } else {
    logger.info('Legislation directory absent, skipping');
  }

  // --- Checkpoint cross-checks ---
  const awsCheck = await crossCheckAwsCheckpoint(rawDataDir);
  const scraperCheck = await crossCheckScraperCheckpoint(rawDataDir);
  const checkpointCrossChecks = [awsCheck, scraperCheck];

  for (const check of checkpointCrossChecks) {
    logger.info(`Checkpoint: ${check.checkpointName}`, {
      successes: check.successCount,
      ghosts: check.ghostFiles.length,
    });
    if (check.ghostFiles.length > 0) {
      integrityIssues.push(
        `Checkpoint '${check.checkpointName}': ${check.ghostFiles.length} entries marked success but file missing on disk`
      );
    }
  }

  // --- Write report ---
  const clean = integrityIssues.length === 0;
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    rawDataDir,
    courts,
    legislation,
    checkpointCrossChecks,
    integrityIssues,
    clean,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(REPORTS_DIR, `download-verification-${timestamp}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  if (clean) {
    logger.info('All integrity checks passed ✓', { reportPath });
  } else {
    logger.error(`Found ${integrityIssues.length} integrity issue(s)`, {
      issues: integrityIssues,
      reportPath,
    });
  }

  process.exit(clean ? 0 : 1);
}

main().catch(err => {
  logger.error('Fatal error', { error: String(err) });
  process.exit(1);
});
