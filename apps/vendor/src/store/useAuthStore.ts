import { create } from 'zustand';
import { UserSession } from '@floq/types';
import { api, SignupPayload } from '../services/api';
import { authStorage } from '../services/authStorage';
import { realtimeClient } from '../services/realtimeClient';

/** Thrown by loginWithOtp when the verified number has no account yet, so the
 *  UI can route into the onboarding wizard carrying the idToken + phone. */
export class NeedsOnboardingError extends Error {
  constructor(public idToken: string, public phone: string) {
    super('NEEDS_ONBOARDING');
  }
}

interface AuthState {
  session: UserSession | null;
  isAuthenticated: boolean;
  isLocked: boolean; // session valid but app needs PIN/biometric to open
  needsPinSetup: boolean; // authenticated but no local unlock PIN yet
  isLoading: boolean;
  error: string | null;
  loginWithPin: (phone: string, pin: string) => Promise<UserSession>;
  loginWithOtp: (idToken: string, phone: string) => Promise<UserSession>;
  signup: (payload: SignupPayload) => Promise<UserSession>;
  unlock: (pin: string) => Promise<boolean>;
  unlockBiometric: () => void;
  setUnlockPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

/** Persist a fresh session and flip the store to authenticated. */
async function applySession(set: any, get: any, session: UserSession) {
  await authStorage.saveSession(session);
  api.setUnauthorizedCallback(() => get().logout());
  // Just authenticated → unlocked for this run.
  set({ session, isAuthenticated: true, isLocked: false, isLoading: false, error: null });
  realtimeClient.connect();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  isLocked: false,
  needsPinSetup: false,
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
        api.setUnauthorizedCallback(() => get().logout());

        // Every app open requires a quick unlock when a PIN is set; if none
        // exists yet (first run after OTP), route to PIN setup instead.
        const hasPin = await authStorage.hasUnlockPin();
        set({ session, isAuthenticated: true, isLocked: hasPin, needsPinSetup: !hasPin, isLoading: false });
        realtimeClient.connect();
      } else {
        set({ session: null, isAuthenticated: false, isLocked: false, needsPinSetup: false, isLoading: false });
      }
    } catch (err: any) {
      set({ session: null, isAuthenticated: false, isLocked: false, needsPinSetup: false, isLoading: false });
    }
  },

  unlock: async (pin: string) => {
    const stored = await authStorage.getUnlockPin();
    if (stored && pin === stored) {
      set({ isLocked: false });
      return true;
    }
    return false;
  },

  unlockBiometric: () => set({ isLocked: false }),

  setUnlockPin: async (pin: string) => {
    await authStorage.setUnlockPin(pin);
    set({ needsPinSetup: false, isLocked: false });
  },

  loginWithPin: async (phone: string, pin: string) => {
    try {
      set({ isLoading: true, error: null });
      const session = await api.login(phone, pin);
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

  loginWithOtp: async (idToken: string, phone: string) => {
    try {
      set({ isLoading: true, error: null });
      const session = await api.loginWithFirebase(idToken);
      await applySession(set, get, session);
      // Returning user with no local PIN yet → have them set one.
      if (!(await authStorage.hasUnlockPin())) set({ needsPinSetup: true });
      return session;
    } catch (err: any) {
      set({ isLoading: false });
      // New number → route to onboarding instead of surfacing an error.
      if (err?.code === 'NEEDS_ONBOARDING' || err?.status === 404) {
        throw new NeedsOnboardingError(idToken, phone);
      }
      set({ error: err.message || 'Login failed' });
      throw err;
    }
  },

  signup: async (payload: SignupPayload) => {
    try {
      set({ isLoading: true, error: null });
      const session = await api.signup(payload);
      await applySession(set, get, session);
      // Reuse the PIN set in the wizard as the device unlock PIN.
      await authStorage.setUnlockPin(payload.pin);
      set({ needsPinSetup: false });
      return session;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Could not create account' });
      throw err;
    }
  },

  logout: async () => {
    realtimeClient.disconnect();
    await authStorage.clearSession();
    api.setAuthToken(null);
    set({ session: null, isAuthenticated: false, isLocked: false, needsPinSetup: false, isLoading: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
