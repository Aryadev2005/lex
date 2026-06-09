// IMPORTANT: The public Dattam Labs bucket name must be verified at
// https://registry.opendata.aws/dattam-labs-legal-data — update BUCKET_NAME
// constant at line 30 of this file before running.

import {
  S3Client,
  GetObjectCommand,
  paginateListObjectsV2,
} from '@aws-sdk/client-s3';
import { createWriteStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { join, basename, resolve, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';
import pLimit from 'p-limit';
import { config as loadEnv } from 'dotenv';
import logger from '../pipelines/shared/logger.js';
import { CheckpointManager } from '../pipelines/shared/checkpoint.js';

const __dirname = pathDirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../.env') });

// IMPORTANT: Verify this bucket name at https://registry.opendata.aws/dattam-labs-legal-data
// Update this constant if the exact name differs from what is listed there.
const BUCKET_NAME = 'indian-legal-data';
const REGION = 'ap-south-1';

const COURT_PRIORITY = [
  'supreme-court',
  'delhi-hc',
  'bombay-hc',
  'madras-hc',
  'calcutta-hc',
  'karnataka-hc',
] as const;

type CourtKey = (typeof COURT_PRIORITY)[number];

interface CliArgs {
  courts: CourtKey[];
  yearFrom: number;
  yearTo: number;
  limit: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined =>
    argv.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=');

  const courtsRaw = get('--courts');
  const courts: CourtKey[] = courtsRaw
    ? courtsRaw
        .split(',')
        .filter((c): c is CourtKey =>
          (COURT_PRIORITY as readonly string[]).includes(c)
        )
    : [...COURT_PRIORITY];

  return {
    courts,
    yearFrom: parseInt(get('--year-from') ?? '2000', 10),
    yearTo: parseInt(get('--year-to') ?? '2024', 10),
    limit: parseInt(get('--limit') ?? String(Number.MAX_SAFE_INTEGER), 10),
  };
}

async function main(): Promise<void> {
  console.warn(
    'IMPORTANT: The public Dattam Labs bucket name must be verified at ' +
      'https://registry.opendata.aws/dattam-labs-legal-data — update BUCKET_NAME ' +
      'constant at line 30 of this file before running.'
  );

  const rawDataDir = process.env['RAW_DATA_DIR'];
  if (!rawDataDir) throw new Error('RAW_DATA_DIR env var must be set in data/.env');

  await mkdir(rawDataDir, { recursive: true });

  const { courts, yearFrom, yearTo, limit } = parseArgs();
  logger.info('Starting AWS download', { courts, yearFrom, yearTo, limit, bucket: BUCKET_NAME });

  const checkpoint = new CheckpointManager('download-aws');
  await checkpoint.load();

  // Anonymous credentials for public S3 bucket (--no-sign-request equivalent).
  // AWS Open Data Registry buckets allow s3:GetObject for *, so requests signed
  // with placeholder credentials are accepted by the bucket policy.
  const s3 = new S3Client({
    region: REGION,
    credentials: { accessKeyId: 'ANONYMOUS', secretAccessKey: '' },
  });

  logger.info('Listing bucket objects — this may take several minutes for large datasets...');

  const allObjects: Array<{ key: string; court: CourtKey; year: number }> = [];

  for (const court of courts) {
    const prefix = `judgments/${court}/`;
    try {
      for await (const page of paginateListObjectsV2(
        { client: s3 },
        { Bucket: BUCKET_NAME, Prefix: prefix }
      )) {
        for (const obj of page.Contents ?? []) {
          if (!obj.Key?.endsWith('.pdf')) continue;
          // Key pattern: judgments/{court}/{year}/{filename}.pdf
          const segments = obj.Key.split('/');
          if (segments.length < 4) continue;
          const year = parseInt(segments[2] ?? '0', 10);
          if (!isFinite(year) || year < yearFrom || year > yearTo) continue;
          allObjects.push({ key: obj.Key, court, year });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NoSuchBucket') || msg.includes('The specified bucket does not exist')) {
        logger.error(
          'Bucket not found. Verify the bucket name at ' +
            'https://registry.opendata.aws/dattam-labs-legal-data and update ' +
            'BUCKET_NAME at line 30 of this script.',
          { bucket: BUCKET_NAME }
        );
        process.exit(1);
      }
      throw err;
    }
  }

  logger.info(`Found ${allObjects.length} PDFs matching filters`);

  const pending = allObjects.filter(o => !checkpoint.isProcessed(o.key));
  const batch = pending.slice(0, limit);
  const total = batch.length;
  const alreadyDone = allObjects.length - pending.length;

  logger.info(`Queuing ${total} downloads`, {
    alreadyDone,
    deferredByLimit: pending.length - total,
  });

  const limiter = pLimit(10);
  let downloaded = 0;
  let errors = 0;

  await Promise.all(
    batch.map(({ key, court, year }) =>
      limiter(async () => {
        const filename = basename(key);
        const destDir = join(rawDataDir, court, String(year));
        const destPath = join(destDir, filename);

        try {
          await mkdir(destDir, { recursive: true });

          const { Body } = await s3.send(
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
          );
          if (!Body) throw new Error('S3 response body is empty');

          // Body is Readable at Node.js runtime (StreamingBlobTypes union)
          await pipeline(Body as unknown as Readable, createWriteStream(destPath));

          const { size } = await stat(destPath);
          if (size < 1000) {
            throw new Error(`Corrupt download — file is only ${size} bytes`);
          }

          await checkpoint.mark(key, 'success', { court, year: String(year), size });
          downloaded++;

          if (downloaded % 100 === 0) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            logger.info(`Progress: ${downloaded} / ${total} (${pct}%)`);
          }
        } catch (err) {
          errors++;
          const message = err instanceof Error ? err.message : String(err);
          await checkpoint.mark(key, 'error', { error: message });
          logger.warn(`Failed: ${key}`, { error: message });
        }
      })
    )
  );

  logger.info('Download run complete', { downloaded, errors, skipped: alreadyDone });
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  logger.error('Fatal', { error: String(err) });
  process.exit(1);
});
