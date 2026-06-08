'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import type { User } from '@lex/types';

const COOKIE_NAME = 'auth_token';
const COOKIE_EXPIRES = 7; // days

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthed: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthed: false,

      setAuth: (user, token) => {
        Cookies.set(COOKIE_NAME, token, { expires: COOKIE_EXPIRES, sameSite: 'Lax' });
        set({ user, token, isAuthed: true });
      },

      clearAuth: () => {
        Cookies.remove(COOKIE_NAME);
        set({ user: null, token: null, isAuthed: false });
      },
    }),
    {
      name: 'lex-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthed = !!state.token;
        }
      },
    },
  ),
);
