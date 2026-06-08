import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthState } from '../store/authStore';

// Mock the authStore before importing api (api does a lazy import)
vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

const mockGetState = vi.mocked(useAuthStore.getState);

function makeState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    user: null,
    token: null,
    isAuthed: false,
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
    ...overrides,
  } as AuthState;
}

describe('api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('makes GET requests to the correct URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );
    mockGetState.mockReturnValue(makeState());

    await api.get('/health');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('attaches Authorization header when token is present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );
    mockGetState.mockReturnValue(makeState({ token: 'my-jwt-token' }));

    await api.get('/protected/me');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      }),
    );
  });

  it('does NOT attach Authorization header when token is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    mockGetState.mockReturnValue(makeState({ token: null }));

    await api.get('/health');

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const headers = (callArgs?.[1] as RequestInit)?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws an error on non-OK responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    );
    mockGetState.mockReturnValue(makeState());

    await expect(api.get('/missing')).rejects.toThrow('Not found');
  });

  it('calls clearAuth on 401 responses', async () => {
    const clearAuth = vi.fn();
    mockGetState.mockReturnValue(makeState({ token: 'bad-token', clearAuth }));
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );

    await expect(api.get('/protected/me')).rejects.toThrow('Unauthorized');
    expect(clearAuth).toHaveBeenCalled();
  });

  it('sends POST body as JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'abc' }), { status: 200 }),
    );
    mockGetState.mockReturnValue(makeState());

    await api.post('/auth/login', { email: 'a@b.com', password: 'pw' });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
      }),
    );
  });
});
