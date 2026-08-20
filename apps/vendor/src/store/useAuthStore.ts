import { create } from 'zustand';
import { UserSession } from '@floq/types';
import { api } from '../services/api';
import { authStorage } from '../services/authStorage';
import { realtimeClient } from '../services/realtimeClient';

interface AuthState {
  session: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithOTP: (phone: string, otp: string) => Promise<UserSession>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  restoreSession: async () => {
    try {
      set({ isLoading: true, error: null });
      const session = await authStorage.getSession();

      if (session) {
        api.setAuthToken(session.token);
        if (session.storeIds && session.storeIds[0]) {
          api.setStoreContext(session.merchantId, session.storeIds[0]);
        }

        api.setUnauthorizedCallback(() => {
          get().logout();
        });

        set({ session, isAuthenticated: true, isLoading: false });
        realtimeClient.connect();
      } else {
        set({ session: null, isAuthenticated: false, isLoading: false });
      }
    } catch (err: any) {
      set({ session: null, isAuthenticated: false, isLoading: false });
    }
  },

  loginWithOTP: async (phone: string, otp: string) => {
    try {
      set({ isLoading: true, error: null });
      const session = await api.verifyOTP(phone, otp);
      await authStorage.saveSession(session);

      api.setUnauthorizedCallback(() => {
        get().logout();
      });

      set({ session, isAuthenticated: true, isLoading: false });
      realtimeClient.connect();
      return session;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Login failed' });
      throw err;
    }
  },

  logout: async () => {
    realtimeClient.disconnect();
    await authStorage.clearSession();
    api.setAuthToken(null);
    set({ session: null, isAuthenticated: false, isLoading: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
