import { readFile } from 'fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// TextItem / TextMarkedContent are not re-exported from the pdfjs-dist root,
// so we define the minimal shapes we actually use.
type TextItem = {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
};
type TextMarkedContent = { type: string; id: string };

// Point to the bundled worker using a relative path from this file's directory
// (../../../node_modules/pdfjs-dist/...) so Node.js can resolve it correctly.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href;

interface PageResult {
  pageNumber: number;
  text: string;
}

export async function extractNativePdf(filePath: string): Promise<{
  text: string;
  pageCount: number;
  pages: PageResult[];
}> {
  const data = new Uint8Array(await readFile(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const pages: PageResult[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items as Array<TextItem | TextMarkedContent>;
      pages.push({ pageNumber: pageNum, text: buildReadingOrderText(items) });
    } catch {
      pages.push({ pageNumber: pageNum, text: '[[PAGE_EXTRACTION_FAILED]]' });
    }
  }

  return {
    text: pages.map(p => p.text).join('\f'),
    pageCount,
    pages,
  };
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item;
}

function buildReadingOrderText(items: Array<TextItem | TextMarkedContent>): string {
  const textItems = items.filter(isTextItem);
  if (textItems.length === 0) return '';

  // PDF transform matrix: [a, b, c, d, x, y]
  // transform[4] = x, transform[5] = y (y increases upward in PDF space)
  const sorted = [...textItems].sort((a, b) => {
    const yA = a.transform[5] as number;
    const yB = b.transform[5] as number;
    const yDiff = yB - yA;
    if (Math.abs(yDiff) > 2) return yDiff;
    return (a.transform[4] as number) - (b.transform[4] as number);
  });

  // Group items into lines by y-proximity (within 2px = same line)
  type Line = { y: number; items: TextItem[] };
  const lines: Line[] = [];
  for (const item of sorted) {
    const y = item.transform[5] as number;
    const last = lines[lines.length - 1];
    if (last && Math.abs(y - last.y) <= 2) {
      last.items.push(item);
    } else {
      lines.push({ y, items: [item] });
    }
  }

  // Sort items within each line by x ascending
  for (const line of lines) {
    line.items.sort((a, b) => (a.transform[4] as number) - (b.transform[4] as number));
  }

  let text = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineText = line.items
      .filter(item => item.str.trim().length > 0)
      .map(item => item.str.trim())
      .join(' ');

    if (!lineText) continue;
    text += lineText;

    if (i < lines.length - 1) {
      const nextLine = lines[i + 1]!;
      const gap = line.y - nextLine.y;
      text += gap > 12 ? '\n\n' : '\n';
    }
  }

  return text;
}
