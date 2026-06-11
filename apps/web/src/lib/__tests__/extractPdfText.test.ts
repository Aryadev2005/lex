import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- types mirrored from extractPdfText.ts ----------
type TextItem = { str: string; transform: number[] };
type TextMarkedContent = { type: string; id: string };

// ---------- mock pdfjs-dist/legacy/build/pdf.mjs ----------
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
}));

// Import AFTER mocking so the module uses the mock
const { extractPdfText } = await import('../extractPdfText.js');

// ---------- helpers ----------

function makeTextItem(str: string, x: number, y: number): TextItem {
  // transform: [a, b, c, d, x, y]
  return { str, transform: [1, 0, 0, 1, x, y] };
}

function makePdfjsPage(items: Array<TextItem | TextMarkedContent>) {
  return {
    getTextContent: async () => ({ items }),
  };
}

function makePdfjsDoc(pages: Array<Array<TextItem | TextMarkedContent>>) {
  return {
    numPages: pages.length,
    getPage: async (n: number) => makePdfjsPage(pages[n - 1]!),
  };
}

function makePdfFile(name = 'test.pdf'): File {
  const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  // jsdom 24 does not implement File.arrayBuffer() — polyfill for tests
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(new ArrayBuffer(8)),
    writable: true,
  });
  return file;
}

// ---------- tests ----------

describe('extractPdfText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns combined text from two pages in reading order', async () => {
    const page1Items: TextItem[] = [
      makeTextItem('Hello', 10, 700),
      makeTextItem('World', 60, 700),  // same line, higher x → comes after Hello
      makeTextItem('Second line', 10, 680),
    ];
    const page2Items: TextItem[] = [
      makeTextItem('Page two', 10, 700),
    ];

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(makePdfjsDoc([page1Items, page2Items])),
    });

    const result = await extractPdfText(makePdfFile());

    expect(result).toContain('Hello World');
    expect(result).toContain('Second line');
    expect(result).toContain('Page two');
    // Page 1 content before page 2 content
    expect(result.indexOf('Hello')).toBeLessThan(result.indexOf('Page two'));
  });

  it('sorts items within a line by x-position ascending', async () => {
    // B has higher x than A — despite being first in the array, should come after A
    const items: TextItem[] = [
      makeTextItem('B', 80, 500),
      makeTextItem('A', 10, 500),
    ];

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(makePdfjsDoc([items])),
    });

    const result = await extractPdfText(makePdfFile('order.pdf'));

    expect(result.indexOf('A')).toBeLessThan(result.indexOf('B'));
  });

  it('skips TextMarkedContent items that lack a str property', async () => {
    const items: Array<TextItem | TextMarkedContent> = [
      makeTextItem('Real text', 10, 500),
      { type: 'beginMarkedContent', id: 'mark1' } as TextMarkedContent,
    ];

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(makePdfjsDoc([items])),
    });

    const result = await extractPdfText(makePdfFile('marked.pdf'));

    expect(result).toContain('Real text');
    expect(result).not.toContain('beginMarkedContent');
  });

  it('throws a descriptive error when getDocument rejects', async () => {
    // Use mockImplementation so the rejected promise is created lazily (on call),
    // avoiding an unhandled rejection at mock-setup time.
    mockGetDocument.mockImplementation(() => ({
      promise: Promise.reject(new Error('Invalid PDF structure')),
    }));

    await expect(extractPdfText(makePdfFile('bad.pdf'))).rejects.toThrow('Invalid PDF structure');
  });

  it('throws when the file is not a PDF', async () => {
    const file = new File(['hello'], 'doc.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await expect(extractPdfText(file)).rejects.toThrow(/Not a valid PDF/);
  });
});
