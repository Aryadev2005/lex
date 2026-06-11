type TextItem = {
  str: string;
  transform: number[];
};
type TextMarkedContent = { type: string; id: string };

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item;
}

function buildReadingOrderText(items: Array<TextItem | TextMarkedContent>): string {
  const textItems = items.filter(isTextItem);
  if (textItems.length === 0) return '';

  // PDF y-axis increases upward; sort y descending (top-to-bottom), then x ascending
  const sorted = [...textItems].sort((a, b) => {
    const yDiff = (b.transform[5] as number) - (a.transform[5] as number);
    if (Math.abs(yDiff) > 2) return yDiff;
    return (a.transform[4] as number) - (b.transform[4] as number);
  });

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

  for (const line of lines) {
    line.items.sort((a, b) => (a.transform[4] as number) - (b.transform[4] as number));
  }

  let text = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineText = line.items
      .filter((item) => item.str.trim().length > 0)
      .map((item) => item.str.trim())
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

export async function extractPdfText(file: File): Promise<string> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error(`Not a valid PDF file: ${file.name}`);
  }

  // Dynamically import to avoid SSR issues
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Disable worker — same pattern as data/pipelines/extractors/native-pdf.ts
  (pdfjsLib.GlobalWorkerOptions as { workerSrc: unknown }).workerSrc = '';

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  let doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
  try {
    doc = await pdfjsLib.getDocument({ data }).promise;
  } catch (err) {
    throw new Error(
      `Failed to parse PDF "${file.name}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items as Array<TextItem | TextMarkedContent>;
      pageTexts.push(buildReadingOrderText(items));
    } catch {
      pageTexts.push('');
    }
  }

  return pageTexts.join('\n\n').trim();
}
