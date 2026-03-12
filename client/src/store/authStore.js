import { create } from 'zustand';
import { disconnectSocket } from '../lib/socket';
import { getUserProfile } from '../lib/api';

const API_BASE = '/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: true,

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    set({ user, token, refreshToken, isAuthenticated: true, loading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    disconnectSocket();
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false, loading: false });
  },

  updateUser: (updates) => {
    set((state) => ({ user: state.user ? { ...state.user, ...updates } : null }));
  },

  refreshUser: async () => {
    try {
      const data = await getUserProfile();
      if (data.user) {
        set({ user: data.user });
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  },

  // Check stored token on app load
  initialize: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.isValid && data.user) {
        set({ user: data.user, token, isAuthenticated: true, loading: false });
      } else {
        // Try refresh
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem('token', refreshData.token);
            // Re-verify
            const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
              headers: { Authorization: `Bearer ${refreshData.token}` },
            });
            const verifyData = await verifyRes.json();
            if (verifyData.isValid) {
              set({ user: verifyData.user, token: refreshData.token, isAuthenticated: true, loading: false });
              return;
            }
          }
        }
        get().logout();
      }
    } catch (err) {
      console.error('Auth init error:', err);
      set({ loading: false });
    }
  },

  // Register
  register: async (email, password, username) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    get().setAuth(data.user, data.token, data.refreshToken);
    return data;
  },

  // Login
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    get().setAuth(data.user, data.token, data.refreshToken);
    return data;
  },
}));
