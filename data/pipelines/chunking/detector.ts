export interface SectionBoundary {
  startLine: number;
  endLine: number;
  title: string;
  level: number; // 1=top, 2=sub, 3=sub-sub
  type: string;
  text: string;
}

interface PatternDef {
  pattern: RegExp;
  type: string;
  level: number;
}

// Ordered by specificity — first match wins.
// These only fire on lines that ARE the section marker (short lines, all-caps, etc.)
// to avoid false positives against body text.
const JUDGMENT_PATTERNS: PatternDef[] = [
  // Court header — "IN THE SUPREME COURT OF INDIA" / "BEFORE THE HIGH COURT…"
  { pattern: /^(IN THE|BEFORE THE)\s+(SUPREME COURT|HIGH COURT|NATIONAL COMPANY LAW)/i, type: 'header', level: 1 },
  // Coram
  { pattern: /^CORAM\s*:/i, type: 'coram', level: 1 },
  // HON'BLE bench line (another coram form)
  { pattern: /^HON['']?BLE\b/i, type: 'coram', level: 1 },
  // "VERSUS" / "V." / "VS." on its own line — parties separator
  { pattern: /^(VERSUS|V\.|VS\.)\s*$/i, type: 'parties', level: 1 },
  // Appellant/Respondent/Petitioner labelled block
  { pattern: /^(PETITIONER|APPELLANT|RESPONDENT)\s*[:(]/i, type: 'parties', level: 1 },
  // Background / Facts (must be short line = header only)
  { pattern: /^(BACKGROUND|BRIEF FACTS|RELEVANT FACTS|FACTUAL BACKGROUND)\s*:?\s*$/i, type: 'facts', level: 2 },
  { pattern: /^FACTS\s*:?\s*$/i, type: 'facts', level: 2 },
  // Issues
  { pattern: /^(ISSUES? (FRAMED|FOR CONSIDERATION|OF LAW|FOR DECISION)|QUESTIONS? (OF LAW|FOR CONSIDERATION)|POINTS? FOR DETERMINATION)\s*:?\s*$/i, type: 'issues', level: 2 },
  { pattern: /^ISSUES?\s*:?\s*$/i, type: 'issues', level: 2 },
  // Arguments / Submissions
  { pattern: /^(SUBMISSIONS|ARGUMENTS|CONTENTIONS|AVERMENTS)\s*:?\s*$/i, type: 'arguments', level: 2 },
  // Analysis / Discussion
  { pattern: /^(ANALYSIS|DISCUSSION|REASONING|OUR ANALYSIS|COURT'?S? ANALYSIS|LEGAL ANALYSIS)\s*:?\s*$/i, type: 'analysis', level: 2 },
  // Findings
  { pattern: /^(FINDINGS?|CONCLUSIONS?|DECISION|OUR VIEW|HELD)\s*:?\s*$/i, type: 'findings', level: 2 },
  // Operative order / judgment — must be entire line
  // Also catches spaced-out forms: "J U D G M E N T"
  { pattern: /^(JUDGMENT|OPERATIVE ORDER|INTERIM ORDER|ORDER)\s*$|^(J\s+U\s+D\s+G\s+M\s+E\s+N\s+T|O\s+R\s+D\s+E\s+R)\s*$/i, type: 'order', level: 1 },
];

const LEGISLATION_PATTERNS: PatternDef[] = [
  // Act title or preamble block
  { pattern: /^(AN?\s+ACT|PREAMBLE)\b/i, type: 'preamble', level: 1 },
  // Chapter headings
  { pattern: /^CHAPTER\s+[IVXLCDM\d]+/i, type: 'chapter', level: 1 },
  // Section: number + period + capital word (e.g. "1. Short title")
  // At most 4 spaces of indent; number 1–999; followed by a capital letter
  { pattern: /^ {0,4}\d{1,3}\.\s+[A-Z][a-z]/, type: 'section', level: 2 },
  // Sub-section: "(1)" / "(2)" at line start
  { pattern: /^\s+\(\d+\)\s+[A-Za-z]/, type: 'subsection', level: 3 },
  // Proviso / Explanation / Schedule
  { pattern: /^(Provided(?: that)?|Explanation\s*[\d.]*|Schedule\s*[IVX\d]*)\b/, type: 'proviso', level: 3 },
];

function matchLine(line: string, patterns: PatternDef[]): PatternDef | null {
  if (line.trim().length === 0) return null;
  for (const def of patterns) {
    if (def.pattern.test(line)) return def;
  }
  return null;
}

export function detectSections(
  text: string,
  documentType: 'judgment' | 'legislation',
): SectionBoundary[] {
  const lines = text.split('\n');
  const patterns = documentType === 'judgment' ? JUDGMENT_PATTERNS : LEGISLATION_PATTERNS;

  type Marker = { line: number; title: string; type: string; level: number };
  const markers: Marker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const matched = matchLine(lines[i] ?? '', patterns);
    if (matched) {
      markers.push({
        line: i,
        title: (lines[i] ?? '').trim(),
        type: matched.type,
        level: matched.level,
      });
    }
  }

  if (markers.length === 0) {
    // No section headers found — treat whole document as one section
    return [
      {
        startLine: 0,
        endLine: lines.length - 1,
        title: documentType === 'judgment' ? 'Judgment' : 'Document',
        level: 1,
        type: documentType === 'judgment' ? 'order' : 'preamble',
        text,
      },
    ];
  }

  const boundaries: SectionBoundary[] = [];

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!;
    const nextMarker = markers[i + 1];
    const endLine = nextMarker ? nextMarker.line - 1 : lines.length - 1;
    const sectionLines = lines.slice(marker.line, endLine + 1);

    boundaries.push({
      startLine: marker.line,
      endLine,
      title: marker.title,
      level: marker.level,
      type: marker.type,
      text: sectionLines.join('\n'),
    });
  }

  // If text before the first marker is substantial, prepend it as a preamble
  if (markers[0]!.line > 10) {
    const preambleLines = lines.slice(0, markers[0]!.line);
    boundaries.unshift({
      startLine: 0,
      endLine: markers[0]!.line - 1,
      title: documentType === 'judgment' ? 'Header' : 'Preamble',
      level: 1,
      type: documentType === 'judgment' ? 'header' : 'preamble',
      text: preambleLines.join('\n'),
    });
  }

  return boundaries.sort((a, b) => a.startLine - b.startLine);
}
