import { appendFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CheckpointEntry } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_DIR = resolve(__dirname, '../../../.checkpoints');

export class CheckpointManager {
  private filePath: string;
  private loaded: Set<string> = new Set();

  constructor(name: string) {
    this.filePath = resolve(CHECKPOINT_DIR, `${name}.jsonl`);
  }

  async load(): Promise<Set<string>> {
    await this.ensureDir();

    if (!existsSync(this.filePath)) {
      this.loaded = new Set();
      return this.loaded;
    }

    const raw = await readFile(this.filePath, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim().length > 0);

    this.loaded = new Set<string>();
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as CheckpointEntry;
        if (entry.status === 'success') {
          this.loaded.add(entry.id);
        }
      } catch {
        // skip malformed lines
      }
    }

    return this.loaded;
  }

  async mark(
    id: string,
    status: 'success' | 'error' | 'skip',
    meta?: Record<string, unknown>
  ): Promise<void> {
    await this.ensureDir();

    const entry: CheckpointEntry = {
      id,
      status,
      timestamp: new Date().toISOString(),
      ...(meta !== undefined && { metadata: meta }),
    };

    await appendFile(this.filePath, JSON.stringify(entry) + '\n', 'utf-8');

    if (status === 'success') {
      this.loaded.add(id);
    }
  }

  async getErrors(): Promise<CheckpointEntry[]> {
    if (!existsSync(this.filePath)) return [];

    const raw = await readFile(this.filePath, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim().length > 0);

    const errors: CheckpointEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as CheckpointEntry;
        if (entry.status === 'error') errors.push(entry);
      } catch {
        // skip malformed lines
      }
    }
    return errors;
  }

  isProcessed(id: string): boolean {
    return this.loaded.has(id);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(CHECKPOINT_DIR, { recursive: true });
  }
}
