import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Packer,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageNumber,
  Footer,
  WidthType,
} from 'docx';
import type { ContractAnalysisResult, RiskItem } from './contract.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const SEVERITY_ORDER: RiskItem['risk_level'][] = ['critical', 'high', 'medium', 'low'];

const RISK_EMOJI: Record<RiskItem['risk_level'], string> = {
  critical: '⚠',   // ⚠
  high: '🔴', // 🔴
  medium: '🟡', // 🟡
  low: '🟢',  // 🟢
};

function scoreColor(score: number): string {
  if (score >= 70) return 'FF2D2D';
  if (score >= 40) return 'E05A00';
  return '22863A';
}

// No-border style reused on every table cell
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
} as const;

function metaRow(label: string, value: TextRun[]): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: NO_BORDERS,
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        borders: NO_BORDERS,
        width: { size: 75, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: value })],
      }),
    ],
  });
}

function bold(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true })] });
}

function italic(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, italics: true })] });
}

function thickRule(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.THICK, size: 6, color: '334155', space: 1 } },
    children: [],
  });
}

function spacer(): Paragraph {
  return new Paragraph({ children: [] });
}

// ── Clause block ──────────────────────────────────────────────────────────────

function buildClauseBlock(risk: RiskItem): Paragraph[] {
  const emoji = RISK_EMOJI[risk.risk_level] ?? '';
  const blocks: Paragraph[] = [
    // a. Clause header
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun(`${emoji} ${risk.clause_title} [${risk.risk_level.toUpperCase()}]`),
      ],
    }),

    // b. Clause type badge
    italic(`Clause type: ${risk.clause_type}`),

    spacer(),

    // c. Original text heading
    bold('Original Contract Language:'),

    // d. Original clause content — red + strikethrough + shaded
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8D7DA' },
      indent: { left: 360 },
      children: [
        new TextRun({
          text: risk.clause_content,
          color: 'FF0000',
          strike: true,
          size: 20,
        }),
      ],
    }),

    spacer(),

    // e. Risk explanation heading
    bold('Risk Assessment:'),

    // f. Risk explanation
    new Paragraph({ children: [new TextRun(risk.risk_explanation)] }),

    spacer(),

    // g. Legal basis
    italic(`Legal basis: ${risk.legal_basis}`),
  ];

  // h. Legal citations (conditional)
  if (risk.legal_citations.length > 0) {
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Citations: ${risk.legal_citations.join(' | ')}`,
            font: 'Courier New',
            size: 18,
          }),
        ],
      }),
    );
  }

  blocks.push(
    spacer(),

    // i. Suggested alternative heading
    bold('Suggested Redraft:'),

    // j. Suggested alternative — green + shaded
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'D1FAE5' },
      indent: { left: 360 },
      children: [
        new TextRun({
          text: risk.suggested_alternative,
          color: '1A7F37',
          size: 20,
        }),
      ],
    }),
  );

  return blocks;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildRedlineDocx(analysis: ContractAnalysisResult): Promise<Buffer> {
  const sorted = [...analysis.risks].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.risk_level) - SEVERITY_ORDER.indexOf(b.risk_level),
  );

  const today = formatDate(new Date());
  const score = analysis.overall_risk_score;
  const scoreText = `${score}/100 — ${analysis.summary}`;

  // ── Document body ──────────────────────────────────────────────────────────

  const children: Paragraph[] = [];

  // 1. Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun('Contract Risk Analysis — Redline')],
    }),
  );

  // 2. Metadata table
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      metaRow('Generated by', [new TextRun({ text: 'LEX Legal AI Platform', size: 20 })]),
      metaRow('Date', [new TextRun({ text: today, size: 20 })]),
      metaRow('Overall Risk Score', [
        new TextRun({ text: scoreText, color: scoreColor(score), bold: true, size: 20 }),
      ]),
    ],
  });

  // Tables can't go in children array directly — wrap in a section block.
  // We return mixed array using `as any` since docx sections accept both
  // Paragraph and Table as children via the ISectionOptions union type.
  const sectionChildren: (Paragraph | Table)[] = [
    children[0]!,
    spacer(),
    metaTable,
    spacer(),
  ];

  // 3. Overall summary section
  sectionChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Risk Summary: ', bold: true }),
        new TextRun({ text: analysis.summary }),
      ],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: '475569', space: 4 } },
      children: [],
    }),
    spacer(),
  );

  // 4. Clause blocks, sorted by severity
  sorted.forEach((risk, idx) => {
    const block = buildClauseBlock(risk);
    sectionChildren.push(...block);

    // k. Thick rule after each block except the last
    if (idx < sorted.length - 1) {
      sectionChildren.push(thickRule(), spacer());
    }
  });

  // 5. Footer text paragraph (in body, before doc footer)
  sectionChildren.push(
    spacer(),
    new Paragraph({
      children: [
        new TextRun({
          text: `Low-risk clauses not shown. Reviewed ${analysis.clauses.length} clauses total. ` +
            'This document was generated by LEX AI and requires review by a qualified Indian lawyer before use.',
          color: '666666',
          italics: true,
          size: 18,
        }),
      ],
    }),
  );

  // 6. Page number footer
  const pageFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        footers: { default: pageFooter },
        children: sectionChildren,
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
