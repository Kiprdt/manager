import { create } from 'zustand';
import { AuthUser, AuthResponse } from '@life-app/shared';
import { apiClient, getAuthToken, setAuthToken } from '../lib/api-client';

type AuthStatus = 'loading' | 'authed' | 'anon';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',

  init: async () => {
    if (!getAuthToken()) {
      set({ status: 'anon', user: null });
      return;
    }
    try {
      const { user } = await apiClient.get<{ user: AuthUser | null }>('/api/auth/me');
      if (user) set({ user, status: 'authed' });
      else set({ user: null, status: 'anon' });
    } catch {
      setAuthToken(null);
      set({ user: null, status: 'anon' });
    }
  },

  login: async (email, password) => {
    const res = await apiClient.post<AuthResponse>('/api/auth/login', { email, password });
    setAuthToken(res.token);
    set({ user: res.user, status: 'authed' });
  },

  register: async (email, password, name) => {
    const res = await apiClient.post<AuthResponse>('/api/auth/register', { email, password, name });
    setAuthToken(res.token);
    set({ user: res.user, status: 'authed' });
  },

  logout: () => {
    setAuthToken(null);
    set({ user: null, status: 'anon' });
  },
}));
