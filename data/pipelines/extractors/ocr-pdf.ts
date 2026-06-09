import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { readdir, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { recognize } from 'node-tesseract-ocr';

const execAsync = promisify(exec);

try {
  execSync('gs --version', { stdio: 'pipe' });
} catch {
  throw new Error('Ghostscript not installed. Run: brew install ghostscript');
}

function langCode(language?: string): string {
  switch (language?.toLowerCase()) {
    case 'english': return 'eng';
    case 'hindi': return 'hin';
    case 'tamil': return 'tam';
    case 'kannada': return 'kan';
    case 'marathi': return 'mar';
    default: return 'eng+hin';
  }
}

export async function extractOcrPdf(
  filePath: string,
  language?: string,
): Promise<{
  text: string;
  pageCount: number;
  pages: Array<{ pageNumber: number; text: string }>;
}> {
  const tmpDir = join(tmpdir(), randomUUID());
  await mkdir(tmpDir, { recursive: true });

  try {
    const outputPattern = join(tmpDir, 'page-%04d.png');
    await execAsync(
      `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r300 -sOutputFile="${outputPattern}" "${filePath}"`,
      { timeout: 5 * 60 * 1000 },
    );

    const allFiles = await readdir(tmpDir);
    const pngFiles = allFiles
      .filter(f => f.endsWith('.png'))
      .sort((a, b) => {
        const nA = parseInt(a.replace('page-', '').replace('.png', ''), 10);
        const nB = parseInt(b.replace('page-', '').replace('.png', ''), 10);
        return nA - nB;
      });

    const lang = langCode(language);
    const pages: Array<{ pageNumber: number; text: string }> = [];

    for (let i = 0; i < pngFiles.length; i++) {
      const pngPath = join(tmpDir, pngFiles[i]!);
      const pageText = await recognize(pngPath, { lang, oem: 1, psm: 3 });
      pages.push({ pageNumber: i + 1, text: pageText });
    }

    return {
      text: pages.map(p => p.text).join('\f'),
      pageCount: pages.length,
      pages,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function estimatePageCount(filePath: string): Promise<number> {
  try {
    const { stdout, stderr } = await execAsync(
      `gs -dNOPAUSE -dBATCH -sDEVICE=nullpage "${filePath}"`,
      { timeout: 60_000 },
    );
    const combined = stdout + stderr;
    const m = combined.match(/Processing pages 1 through (\d+)/);
    if (m?.[1]) return parseInt(m[1], 10);
    const pageMatches = combined.match(/Page \d+/g);
    return pageMatches ? pageMatches.length : 0;
  } catch {
    return 0;
  }
}
