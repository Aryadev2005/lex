import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock js-cookie
vi.mock('js-cookie', () => ({
  default: {
    set: vi.fn(),
    remove: vi.fn(),
    get: vi.fn(),
  },
}));

import Cookies from 'js-cookie';
import { useAuthStore } from '../store/authStore';
import type { User } from '@lex/types';

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test Lawyer',
  role: 'attorney',
  org_id: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({ user: null, token: null, isAuthed: false, _hasHydrated: false });
    vi.clearAllMocks();
  });

  it('starts with no auth state', () => {
    const { user, token, isAuthed } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(token).toBeNull();
    expect(isAuthed).toBe(false);
  });

  it('setAuth updates user, token, and isAuthed', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-jwt-token');

    const { user, token, isAuthed } = useAuthStore.getState();
    expect(user).toEqual(mockUser);
    expect(token).toBe('test-jwt-token');
    expect(isAuthed).toBe(true);
  });

  it('setAuth writes the token cookie', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-jwt-token');
    expect(Cookies.set).toHaveBeenCalledWith('auth_token', 'test-jwt-token', expect.any(Object));
  });

  it('clearAuth resets state', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-jwt-token');
    useAuthStore.getState().clearAuth();

    const { user, token, isAuthed } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(token).toBeNull();
    expect(isAuthed).toBe(false);
  });

  it('clearAuth removes the cookie', () => {
    useAuthStore.getState().setAuth(mockUser, 'test-jwt-token');
    useAuthStore.getState().clearAuth();
    expect(Cookies.remove).toHaveBeenCalledWith('auth_token');
  });

  it('_hasHydrated starts false', () => {
    const { _hasHydrated } = useAuthStore.getState();
    expect(_hasHydrated).toBe(false);
  });

  it('setHasHydrated(true) sets _hasHydrated to true', () => {
    useAuthStore.getState().setHasHydrated(true);
    expect(useAuthStore.getState()._hasHydrated).toBe(true);
  });
});
