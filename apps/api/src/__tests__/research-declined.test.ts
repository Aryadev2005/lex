import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── @lex/db mock (must be first, before app import) ───────────────────────────
vi.mock('@lex/db', () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
  createSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

// ── OpenAI mock ───────────────────────────────────────────────────────────────
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
    chat: { completions: { create: mockCreate } },
  }));
  (MockOpenAI as any)._mockCreate = mockCreate;
  return { default: MockOpenAI };
});

// ── research.service.js — partial mock: only saveDeclinedQuery is a spy ───────
vi.mock('../modules/research/research.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/research/research.service.js')>();
  return {
    ...actual,
    saveDeclinedQuery: vi.fn().mockResolvedValue(undefined),
  };
});

// ── rag.js mock — gives us control over hybridSearch ─────────────────────────
vi.mock('../lib/rag.js', () => ({
  hybridSearch: vi.fn(),
}));

// ── Supabase client stub ──────────────────────────────────────────────────────
const mockFrom = {
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
};

const mockRpc = vi.fn();

const mockSupabaseClient = {
  auth: {
    admin: { createUser: vi.fn() },
    signInWithPassword: vi.fn(),
  },
  from: vi.fn().mockReturnValue(mockFrom),
  rpc: mockRpc,
};

mockFrom.select.mockReturnValue(mockFrom);
mockFrom.eq.mockReturnValue(mockFrom);
mockFrom.insert.mockReturnValue(mockFrom);
mockFrom.upsert.mockReturnValue(mockFrom);

// ── Imports (after all vi.mock declarations) ──────────────────────────────────
import { buildApp } from '../app.js';
import { saveDeclinedQuery } from '../modules/research/research.service.js';
import { hybridSearch } from '../lib/rag.js';

// ── Test data ─────────────────────────────────────────────────────────────────

const LOW_SCORE_CHUNKS = [
  {
    chunk_id: 'c1',
    document_id: 'd1',
    content: 'Some legal content.',
    citation: 'Test v State',
    court: 'Delhi High Court',
    jurisdiction: 'IN',
    year: 2020,
    section_path: [],
    legal_tags: [],
    vector_score: 0.30,
    rrf_score: 0.4,
  },
  {
    chunk_id: 'c2',
    document_id: 'd2',
    content: 'More legal content.',
    citation: 'Another v Case',
    court: 'Bombay High Court',
    jurisdiction: 'IN',
    year: 2019,
    section_path: [],
    legal_tags: [],
    vector_score: 0.30,
    rrf_score: 0.35,
  },
  {
    chunk_id: 'c3',
    document_id: 'd3',
    content: 'Yet more legal content.',
    citation: 'Third v Case',
    court: 'Supreme Court of India',
    jurisdiction: 'IN',
    year: 2018,
    section_path: [],
    legal_tags: [],
    vector_score: 0.30,
    rrf_score: 0.3,
  },
];

// ── Part A: saveDeclinedQuery unit tests ──────────────────────────────────────

describe('saveDeclinedQuery (unit)', () => {
  it('inserts into agent_sessions with correct shape', async () => {
    // Get the REAL implementation (bypasses the partial mock above)
    const { saveDeclinedQuery: realFn } =
      await vi.importActual<typeof import('../modules/research/research.service.js')>(
        '../modules/research/research.service.js',
      );

    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupa = { from: vi.fn().mockReturnValue({ insert: mockInsert }) };

    await realFn(mockSupa as any, 'user-42', 'org-1', 'test query', 'IN', 0.35, 3);

    expect(mockSupa.from).toHaveBeenCalledWith('agent_sessions');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_type: 'research_declined',
        status: 'declined',
        total_tokens: 0,
        user_id: 'user-42',
        org_id: 'org-1',
        input_query: 'test query',
      }),
    );

    // Verify final_output fields
    const [callArg] = mockInsert.mock.calls[0] as [Record<string, unknown>];
    const output = callArg['final_output'] as Record<string, unknown>;
    expect(output['reason']).toBe('insufficient_grounded_sources');
    expect(output['top_similarity']).toBe(0.35);
    expect(output['chunks_found']).toBe(3);
    expect(output['threshold']).toBe(0.50);

    // Verify input_metadata
    const meta = callArg['input_metadata'] as Record<string, unknown>;
    expect(meta['jurisdiction']).toBe('IN');
  });

  it('stores null jurisdiction when undefined', async () => {
    const { saveDeclinedQuery: realFn } =
      await vi.importActual<typeof import('../modules/research/research.service.js')>(
        '../modules/research/research.service.js',
      );

    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupa = { from: vi.fn().mockReturnValue({ insert: mockInsert }) };

    await realFn(mockSupa as any, 'user-1', null, 'query', undefined, 0, 0);

    const [callArg] = mockInsert.mock.calls[0] as [Record<string, unknown>];
    const meta = callArg['input_metadata'] as Record<string, unknown>;
    expect(meta['jurisdiction']).toBeNull();
  });

  it('does not throw when insert fails (error resilience)', async () => {
    const { saveDeclinedQuery: realFn } =
      await vi.importActual<typeof import('../modules/research/research.service.js')>(
        '../modules/research/research.service.js',
      );

    const mockInsert = vi.fn().mockRejectedValue(new Error('DB connection failed'));
    const mockSupa = { from: vi.fn().mockReturnValue({ insert: mockInsert }) };

    // Must resolve (not throw) even when the DB call fails
    await expect(
      realFn(mockSupa as any, 'u', null, 'q', undefined, 0, 0),
    ).resolves.toBeUndefined();
  });
});

// ── Part B: Research route declined path (end-to-end via app.inject) ──────────

describe('Research route — declined path', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.select.mockReturnValue(mockFrom);
    mockFrom.eq.mockReturnValue(mockFrom);
    mockFrom.insert.mockReturnValue(Promise.resolve({ data: null, error: null }));
    mockFrom.upsert.mockReturnValue(Promise.resolve({ data: null, error: null }));
    mockSupabaseClient.from.mockReturnValue(mockFrom);
    (saveDeclinedQuery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('returns 200 SSE with insufficient_sources when all chunks below threshold', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@lex.dev',
      role: 'attorney' as const,
      org_id: null,
    });

    vi.mocked(hybridSearch).mockResolvedValueOnce(LOW_SCORE_CHUNKS);

    const response = await app.inject({
      method: 'POST',
      url: '/api/research/query',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        query: 'What is the scope of Article 21 of the Indian Constitution?',
        jurisdiction: 'IN',
      },
    });

    // SSE is always 200
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/event-stream/);

    // Must contain the declined event
    expect(response.body).toContain('"type":"insufficient_sources"');

    // Must NOT contain any generated tokens
    expect(response.body).not.toContain('"type":"token"');
  });

  it('calls saveDeclinedQuery after responding with insufficient_sources', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@lex.dev',
      role: 'attorney' as const,
      org_id: null,
    });

    vi.mocked(hybridSearch).mockResolvedValueOnce(LOW_SCORE_CHUNKS);

    await app.inject({
      method: 'POST',
      url: '/api/research/query',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        query: 'What is the scope of Article 21 of the Indian Constitution?',
        jurisdiction: 'IN',
      },
    });

    // Fire-and-forget — flush microtasks before asserting
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(saveDeclinedQuery).toHaveBeenCalledTimes(1);
    expect(saveDeclinedQuery).toHaveBeenCalledWith(
      expect.anything(),         // supabase client
      'user-123',                // userId
      null,                      // orgId
      expect.stringContaining('Article 21'),  // query
      'IN',                      // jurisdiction
      0.30,                      // topSimilarity (max of all 0.30 scores)
      3,                         // chunkCount (all 3 low-score chunks)
    );
  });

  it('passes topSimilarity = 0 when hybridSearch returns empty array', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-456',
      email: 'test2@lex.dev',
      role: 'attorney' as const,
      org_id: null,
    });

    vi.mocked(hybridSearch).mockResolvedValueOnce([]);

    await app.inject({
      method: 'POST',
      url: '/api/research/query',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: 'What is the scope of Article 21 of the Indian Constitution?' },
    });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(saveDeclinedQuery).toHaveBeenCalledWith(
      expect.anything(),
      'user-456',
      null,
      expect.any(String),
      undefined,  // no jurisdiction provided
      0,          // topSimilarity = 0 because chunks is empty
      0,          // chunkCount = 0
    );
  });
});
