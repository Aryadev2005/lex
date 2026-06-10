import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@lex/db', () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
  createSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

// Mock raw OpenAI client (used by fastify.openai plugin)
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    apiKey: 'test-openai-key',
    embeddings: { create: mockCreate },
    chat: { completions: { create: mockCreate } },
  }));
  (MockOpenAI as any)._mockCreate = mockCreate;
  return { default: MockOpenAI };
});

// Mock ChatOpenAI used inside the graph nodes
vi.mock('@langchain/openai', () => {
  const mockInvoke = vi.fn();
  const MockChatOpenAI = vi.fn().mockImplementation(() => ({
    invoke: mockInvoke,
  }));
  (MockChatOpenAI as any)._mockInvoke = mockInvoke;
  return { ChatOpenAI: MockChatOpenAI };
});

// Mock hybridSearch so we don't need Supabase/embeddings in graph researcher node
vi.mock('../lib/rag.js', () => ({
  hybridSearch: vi.fn().mockResolvedValue([
    {
      chunk_id: 'c1',
      document_id: 'd1',
      content: 'Indian Contract Act 1872 governs indemnity obligations.',
      citation: 'Indian Contract Act 1872',
      court: '',
      jurisdiction: 'IN',
      year: 1872,
      section_path: [],
      legal_tags: [],
      vector_score: 0.7,
      rrf_score: 0.8,
    },
    {
      chunk_id: 'c2',
      document_id: 'd2',
      content: 'Limitation of liability is enforceable subject to reasonableness.',
      citation: 'Commercial Courts Act 2015',
      court: '',
      jurisdiction: 'IN',
      year: 2015,
      section_path: [],
      legal_tags: [],
      vector_score: 0.65,
      rrf_score: 0.75,
    },
  ]),
}));

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
import { ChatOpenAI } from '@langchain/openai';

const MOCK_CLAUSES = [
  {
    id: 'clause_1',
    type: 'indemnity',
    title: 'Indemnity Clause',
    content: 'Party A shall indemnify Party B from all third-party claims arising from this agreement.',
    index: 0,
  },
];

const MOCK_RISKS = [
  {
    clause_id: 'clause_1',
    risk_level: 'medium',
    risk_explanation: 'This broad indemnity exposes Party A to unlimited liability for third-party claims.',
    legal_basis: 'Indian Contract Act 1872, Section 124',
    legal_citations: [],
    suggested_alternative:
      'Indemnity should be capped at the contract value and limited to direct damages caused by Party A\'s gross negligence.',
  },
];

const VALID_DOCUMENT =
  'This Service Agreement ("Agreement") is entered into between Party A and Party B. ' +
  'Party A shall indemnify Party B from all claims. ' +
  'Either party may terminate this agreement with 30 days written notice. ' +
  'Governing law shall be the laws of India. ' +
  'Any dispute shall be resolved by arbitration in New Delhi. ' +
  'Party A warrants that all services will be performed in a professional manner consistent with industry standards.';

function getMockInvoke() {
  return (ChatOpenAI as any)._mockInvoke as ReturnType<typeof vi.fn>;
}

describe('Contract Routes', () => {
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
      url: '/api/contract/analyze',
      payload: { document_text: VALID_DOCUMENT },
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 400 when document_text is too short', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'attorney' as const,
      org_id: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/contract/analyze',
      headers: { authorization: `Bearer ${token}` },
      payload: { document_text: 'too short' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('streams progress and result events for a valid document', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'attorney' as const,
      org_id: null,
    });

    const mockInvoke = getMockInvoke();
    mockInvoke
      .mockResolvedValueOnce({ content: JSON.stringify(MOCK_CLAUSES) })
      .mockResolvedValueOnce({ content: JSON.stringify(MOCK_RISKS) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/contract/analyze',
      headers: { authorization: `Bearer ${token}` },
      payload: { document_text: VALID_DOCUMENT },
    });

    expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    expect(response.body).toContain('"type":"progress"');
    expect(response.body).toContain('"type":"result"');
  });
});
