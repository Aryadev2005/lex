const LEGAL_WORDS = [
  'WHEREAS', 'THEREFORE', 'JUDGMENT', 'ORDER', 'PETITION',
  'Section', 'Act', 'Court',
] as const;

export function assessExtractionQuality(
  text: string,
  pageCount: number,
): {
  needsOcr: boolean;
  quality: number;
  reason: string;
  nonAsciiRatio: number;
  charsPerPage: number;
} {
  const totalChars = text.length;

  if (totalChars === 0) {
    return {
      needsOcr: true,
      quality: 0,
      reason: 'No text extracted — OCR required',
      nonAsciiRatio: 0,
      charsPerPage: 0,
    };
  }

  let nonAsciiCount = 0;
  for (let i = 0; i < totalChars; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) nonAsciiCount++;
  }

  const nonAsciiRatio = nonAsciiCount / totalChars;
  const charsPerPage = totalChars / Math.max(1, pageCount);

  let quality = 0;

  if (charsPerPage >= 500) quality += 0.4;
  else if (charsPerPage >= 200) quality += 0.2;

  if (nonAsciiRatio < 0.05) quality += 0.3;
  else if (nonAsciiRatio < 0.15) quality += 0.15;

  const matchedWords = LEGAL_WORDS.filter(w => text.includes(w));
  quality += Math.min(0.3, (matchedWords.length / LEGAL_WORDS.length) * 0.3);

  quality = Math.min(1, quality);

  const needsOcr = quality < 0.4 || (charsPerPage < 200 && pageCount > 2);

  const parts: string[] = [];
  if (charsPerPage >= 500) parts.push(`good density (${charsPerPage.toFixed(0)} chars/page)`);
  else if (charsPerPage >= 200) parts.push(`moderate density (${charsPerPage.toFixed(0)} chars/page)`);
  else parts.push(`sparse (${charsPerPage.toFixed(0)} chars/page)`);

  if (nonAsciiRatio >= 0.15) parts.push(`high non-ASCII (${(nonAsciiRatio * 100).toFixed(1)}%)`);
  else if (nonAsciiRatio >= 0.05) parts.push(`moderate non-ASCII (${(nonAsciiRatio * 100).toFixed(1)}%)`);

  if (matchedWords.length > 0) parts.push(`legal terms: ${matchedWords.slice(0, 3).join(', ')}`);

  const reason = needsOcr
    ? `OCR required — ${parts.join('; ')}`
    : `Native extraction sufficient — ${parts.join('; ')}`;

  return { needsOcr, quality, reason, nonAsciiRatio, charsPerPage };
}
