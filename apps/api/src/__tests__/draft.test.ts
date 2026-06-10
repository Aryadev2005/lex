import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@lex/db', () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
  createSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  (MockOpenAI as any)._mockCreate = mockCreate;
  return { default: MockOpenAI };
});

const mockSupabaseClient = {
  auth: {
    admin: { createUser: vi.fn() },
    signInWithPassword: vi.fn(),
  },
  from: vi.fn().mockReturnValue({
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    upsert: vi.fn(),
  }),
  rpc: vi.fn(),
};

import { buildApp } from '../app.js';
import OpenAI from 'openai';

function getMockCreate() {
  return (OpenAI as any)._mockCreate as ReturnType<typeof vi.fn>;
}

async function* makeChatStream(tokens: string[]) {
  for (const t of tokens) {
    yield { choices: [{ delta: { content: t } }], usage: null };
  }
  yield { choices: [{ delta: {} }], usage: { prompt_tokens: 50, completion_tokens: 30 } };
}

const MOCK_SLOT_VALUES = {
  sender_name: 'Ravi Kumar',
  sender_address: '12, Park Street, Mumbai - 400001',
  recipient_name: 'Suresh Sharma',
  recipient_address: '45, MG Road, Pune - 411001',
  subject_matter: 'Recovery of Loan Amount',
  grievance_details: 'The respondent borrowed Rs 2,00,000 on 1st March 2024 and has not repaid.',
  relief_demanded: 'pay the outstanding amount of Rs 2,00,000 with interest',
  time_limit_days: '15',
  advocate_name: 'Adv. Priya Patel',
  date: '01/06/2026',
};

describe('Draft Routes', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/draft/templates returns 200 with 5 templates', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/draft/templates',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { templates: unknown[] };
    expect(body.templates).toHaveLength(5);
    expect(body.templates[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      document_type: expect.any(String),
    });
  });

  it('POST /api/draft/generate without auth returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/draft/generate',
      payload: {
        template_id: 'legal_notice_general',
        situation_description: 'I need to send a legal notice to recover my money from someone.',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /api/draft/generate with invalid template_id returns 404', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'attorney' as const,
      org_id: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/draft/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: 'nonexistent_template',
        situation_description: 'I need to send a legal notice to recover my money from someone.',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /api/draft/generate with valid body streams token and done events', async () => {
    await app.ready();
    const token = app.jwt.sign({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'attorney' as const,
      org_id: null,
    });

    const mockCreate = getMockCreate();

    // First call: slot extraction (non-streaming JSON response)
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(MOCK_SLOT_VALUES) } }],
    });

    // Second call: polish streaming response
    mockCreate.mockResolvedValueOnce(
      makeChatStream(['TO,\n', 'Suresh Sharma\n', 'MG Road, Pune\n']),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/draft/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        template_id: 'legal_notice_general',
        situation_description:
          'Ravi Kumar lent Rs 2,00,000 to Suresh Sharma on 1st March 2024. Suresh has not repaid the amount despite repeated requests.',
      },
    });

    expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    expect(response.body).toContain('"type":"token"');
    expect(response.body).toContain('"type":"done"');
    expect(response.body).toContain('"type":"template"');
  });
});
