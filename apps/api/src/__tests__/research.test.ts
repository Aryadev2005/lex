import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@lex/db', () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
  createSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

// Mock OpenAI module — must be declared before the dynamic import of app
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate,
    },
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  (MockOpenAI as any)._mockCreate = mockCreate;
  return { default: MockOpenAI };
});

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

import { buildApp } from '../app.js';
import OpenAI from 'openai';

const MOCK_CHUNKS = [
  {
    chunk_id: 'c1',
    document_id: 'd1',
    content: 'The Supreme Court held that fundamental rights cannot be suspended.',
    citation: 'Maneka Gandhi v Union of India',
    court: 'Supreme Court of India',
    jurisdiction: 'IN',
    year: 1978,
    section_path: [],
    legal_tags: ['fundamental rights'],
    similarity: 0.72,
    vector_score: 0.72,
    rrf_score: 0.8,
  },
  {
    chunk_id: 'c2',
    document_id: 'd2',
    content: 'Article 21 protects life and personal liberty against arbitrary state action.',
    citation: 'A.K. Gopalan v State of Madras',
    court: 'Supreme Court of India',
    jurisdiction: 'IN',
    year: 1950,
    section_path: [],
    legal_tags: ['article 21'],
    similarity: 0.68,
    vector_score: 0.68,
    rrf_score: 0.75,
  },
  {
    chunk_id: 'c3',
    document_id: 'd3',
    content: 'Due process of law is an essential component of Article 21.',
    citation: 'Francis Coralie Mullin v Union Territory of Delhi',
    court: 'Supreme Court of India',
    jurisdiction: 'IN',
    year: 1981,
    section_path: [],
    legal_tags: ['due process'],
    similarity: 0.65,
    vector_score: 0.65,
    rrf_score: 0.7,
  },
];

function makeMockOpenAI() {
  return (OpenAI as any)._mockCreate;
}

async function* makeChatStream(tokens: string[]) {
  for (const t of tokens) {
    yield { choices: [{ delta: { content: t } }], usage: null };
  }
  yield { choices: [{ delta: {} }], usage: { prompt_tokens: 100, completion_tokens: 50 } };
}

describe('Research Routes', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.select.mockReturnValue(mockFrom);
    mockFrom.eq.mockReturnValue(mockFrom);
    mockFrom.insert.mockReturnValue(Promise.resolve({ data: null, error: null }));
    mockFrom.upsert.mockReturnValue(Promise.resolve({ data: null, error: null }));
    mockSupabaseClient.from.mockReturnValue(mockFrom);
  });

  it('returns 401 without auth token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/research/query',
      payload: { query: 'What is Article 21 of the Indian Constitution?' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 400 with query too short', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'attorney' as const,
      org_id: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/research/query',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: 'hi' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('streams sources and done events for valid request with chunks above threshold', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'attorney' as const,
      org_id: null,
    });

    const mockCreate = makeMockOpenAI();

    // First call: embeddings
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(3072).fill(0.1) }],
    });

    // supabase.rpc returns 3 chunks above threshold
    mockRpc.mockResolvedValueOnce({ data: MOCK_CHUNKS, error: null });

    // Second call: chat completions stream
    mockCreate.mockResolvedValueOnce(
      makeChatStream(['The ', 'fundamental ', 'rights ', 'are ', 'protected.']),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/research/query',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        query: 'What is the scope of Article 21 of the Indian Constitution?',
        jurisdiction: 'IN',
        match_count: 12,
      },
    });

    expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    expect(response.body).toContain('data:');
    expect(response.body).toContain('"type":"sources"');
    expect(response.body).toContain('"type":"done"');
  });

  it('streams insufficient_sources when all chunks are below threshold', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'attorney' as const,
      org_id: null,
    });

    const mockCreate = makeMockOpenAI();

    // Embedding call
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: new Array(3072).fill(0.1) }],
    });

    // All chunks have vector_score 0.30 — below SIMILARITY_THRESHOLD (0.50)
    const lowScoreChunks = MOCK_CHUNKS.map((c) => ({
      ...c,
      similarity: 0.30,
      vector_score: 0.30,
    }));
    mockRpc.mockResolvedValueOnce({ data: lowScoreChunks, error: null });

    const response = await app.inject({
      method: 'POST',
      url: '/api/research/query',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        query: 'What is the scope of Article 21 of the Indian Constitution?',
      },
    });

    expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    expect(response.body).toContain('"type":"insufficient_sources"');
  });
});
