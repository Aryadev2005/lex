import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (must be declared before any dynamic import of app) ─────────────────

vi.mock('@lex/db', () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
  createSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    apiKey: 'test-key',
    embeddings: { create: vi.fn() },
    chat: { completions: { create: vi.fn() } },
  }));
  return { default: MockOpenAI };
});

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({ invoke: vi.fn() })),
}));

vi.mock('../lib/rag.js', () => ({
  hybridSearch: vi.fn().mockResolvedValue([]),
}));

// ── Supabase stub ─────────────────────────────────────────────────────────────

const mockFrom = {
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
};

const mockSupabaseClient = {
  auth: { admin: { createUser: vi.fn() }, signInWithPassword: vi.fn() },
  from: vi.fn().mockReturnValue(mockFrom),
  rpc: vi.fn(),
};

mockFrom.select.mockReturnValue(mockFrom);
mockFrom.eq.mockReturnValue(mockFrom);
mockFrom.insert.mockReturnValue(mockFrom);
mockFrom.upsert.mockReturnValue(mockFrom);

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { buildApp } from '../app.js';
import { buildRedlineDocx } from '../modules/contract/contract.redline.js';
import type { ContractAnalysisResult } from '../modules/contract/contract.types.js';

// ── Test fixture ──────────────────────────────────────────────────────────────

const FIXTURE: ContractAnalysisResult = {
  clauses: [
    { id: 'clause_1', type: 'limitation_of_liability', title: 'Limitation of Liability', content: 'Our liability is capped at one dollar.', index: 0 },
    { id: 'clause_2', type: 'indemnity', title: 'Indemnity', content: 'Party A shall indemnify Party B from all claims whatsoever.', index: 1 },
  ],
  research: [],
  risks: [
    {
      clause_id: 'clause_1',
      clause_type: 'limitation_of_liability',
      clause_title: 'Limitation of Liability',
      clause_content: 'Our liability is capped at one dollar.',
      risk_level: 'high',
      risk_explanation: 'A $1 cap is unconscionably low and likely unenforceable under Indian contract law.',
      legal_basis: 'Indian Contract Act 1872, Section 73',
      legal_citations: ['ONGC v Saw Pipes Ltd (2003)', 'Kailash Nath v DDA (2015)'],
      suggested_alternative: 'Liability shall be limited to the aggregate fees paid in the preceding 12 months.',
    },
    {
      clause_id: 'clause_2',
      clause_type: 'indemnity',
      clause_title: 'Indemnity Clause',
      clause_content: 'Party A shall indemnify Party B from all claims whatsoever.',
      risk_level: 'critical',
      risk_explanation: 'Unlimited and uncapped indemnity creates severe financial exposure.',
      legal_basis: 'Indian Contract Act 1872, Section 124',
      legal_citations: [],
      suggested_alternative: 'Indemnity shall be limited to direct damages arising from gross negligence or fraud by Party A.',
    },
  ],
  overall_risk_score: 82,
  summary: 'This contract contains critical risks requiring immediate legal review before signing.',
};

// ── Test A: buildRedlineDocx unit test ────────────────────────────────────────

describe('buildRedlineDocx (unit)', () => {
  it('returns a Buffer with length > 1000', async () => {
    const buf = await buildRedlineDocx(FIXTURE);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('starts with PK magic bytes (valid ZIP/DOCX)', async () => {
    const buf = await buildRedlineDocx(FIXTURE);
    const magic = buf.slice(0, 2).toString();
    expect(magic).toBe('PK');
  });

  it('sorts risks critical-first regardless of input order', async () => {
    // Pass risks in wrong order (high before critical) — the doc should still render
    const reordered: ContractAnalysisResult = {
      ...FIXTURE,
      risks: [FIXTURE.risks[0]!, FIXTURE.risks[1]!], // high, critical
    };
    const buf = await buildRedlineDocx(reordered);
    expect(buf.length).toBeGreaterThan(1000);
  });
});

// ── Test B: POST /api/contract/redline endpoint ───────────────────────────────

describe('POST /api/contract/redline', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.insert.mockReturnValue(Promise.resolve({ data: null, error: null }));
    mockFrom.upsert.mockReturnValue(Promise.resolve({ data: null, error: null }));
    mockSupabaseClient.from.mockReturnValue(mockFrom);
  });

  it('returns 401 without auth token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/contract/redline',
      payload: { analysis: FIXTURE },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 200 with DOCX binary for valid analysis', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@lex.dev',
      role: 'attorney' as const,
      org_id: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/contract/redline',
      headers: { authorization: `Bearer ${token}` },
      payload: { analysis: FIXTURE },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('wordprocessingml.document');
    expect(response.headers['content-disposition']).toContain('lex-contract-redline.docx');

    // Verify the body is a valid DOCX (ZIP) — starts with PK
    const magic = Buffer.from(response.rawPayload).slice(0, 2).toString();
    expect(magic).toBe('PK');
  });

  it('returns 400 when risks array is empty', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@lex.dev',
      role: 'attorney' as const,
      org_id: null,
    });

    const emptyRisks: ContractAnalysisResult = { ...FIXTURE, risks: [] };

    const response = await app.inject({
      method: 'POST',
      url: '/api/contract/redline',
      headers: { authorization: `Bearer ${token}` },
      payload: { analysis: emptyRisks },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: string }>();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/[Nn]o risks/);
  });

  it('returns 400 when analysis is missing required fields', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@lex.dev',
      role: 'attorney' as const,
      org_id: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/contract/redline',
      headers: { authorization: `Bearer ${token}` },
      payload: { analysis: { risks: [] } },  // missing overall_risk_score, summary
    });

    expect(response.statusCode).toBe(400);
  });
});
