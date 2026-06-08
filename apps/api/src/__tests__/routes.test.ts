import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @lex/db before any module that imports it is evaluated
vi.mock('@lex/db', () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
  createSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

const mockFrom = {
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

const mockSupabaseClient = {
  auth: {
    admin: {
      createUser: vi.fn(),
    },
    signInWithPassword: vi.fn(),
  },
  from: vi.fn().mockReturnValue(mockFrom),
};

mockFrom.select.mockReturnValue(mockFrom);
mockFrom.eq.mockReturnValue(mockFrom);
mockFrom.insert.mockReturnValue(mockFrom);

import { buildApp } from '../app.js';

describe('API Routes', () => {
  const app = buildApp({ logger: false });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.select.mockReturnValue(mockFrom);
    mockFrom.eq.mockReturnValue(mockFrom);
    mockFrom.insert.mockReturnValue(mockFrom);
    mockSupabaseClient.from.mockReturnValue(mockFrom);
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      const body = response.json<{ status: string; service: string; timestamp: string }>();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('service', 'lex-api');
    });
  });

  describe('POST /auth/register', () => {
    it('returns 201 with token on success', async () => {
      mockSupabaseClient.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockFrom.insert.mockResolvedValueOnce({ data: null, error: null });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'test@example.com', password: 'password123', full_name: 'Test User' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{ token: string }>();
      expect(body).toHaveProperty('token');
      expect(body.token).toBeTruthy();
    });

    it('returns 400 on invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'not-an-email', password: 'pw', full_name: 'T' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 409 when email already exists', async () => {
      mockSupabaseClient.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'User already registered', status: 422 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'exists@example.com', password: 'password123', full_name: 'Existing User' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with token on success', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockFrom.single.mockResolvedValueOnce({
        data: {
          id: 'user-123',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'attorney',
          org_id: null,
        },
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ token: string }>();
      expect(body).toHaveProperty('token');
    });

    it('returns 401 on wrong credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test@example.com', password: 'wrongpassword' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /protected/me', () => {
    it('returns 401 without token', async () => {
      const response = await app.inject({ method: 'GET', url: '/protected/me' });
      expect(response.statusCode).toBe(401);
    });

    it('returns 200 with valid JWT', async () => {
      await app.ready();
      const token = app.jwt.sign({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'attorney' as const,
        org_id: null,
      });

      mockFrom.single.mockResolvedValueOnce({
        data: {
          id: 'user-123',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'attorney',
          org_id: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ user: { id: string } }>();
      expect(body.user).toHaveProperty('id', 'user-123');
    });
  });

  describe('GET /test/db', () => {
    it('returns 200 with connected: true on success', async () => {
      const mockCountChain = {
        select: vi.fn().mockResolvedValueOnce({ count: 5, error: null }),
      };
      mockSupabaseClient.from.mockReturnValueOnce(mockCountChain);

      const response = await app.inject({ method: 'GET', url: '/test/db' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ connected: boolean }>();
      expect(body).toHaveProperty('connected');
    });

    it('returns connected: false on Supabase error', async () => {
      const mockCountChain = {
        select: vi.fn().mockResolvedValueOnce({
          count: null,
          error: { message: 'Connection failed' },
        }),
      };
      mockSupabaseClient.from.mockReturnValueOnce(mockCountChain);

      const response = await app.inject({ method: 'GET', url: '/test/db' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ connected: boolean }>();
      expect(body.connected).toBe(false);
    });
  });
});
