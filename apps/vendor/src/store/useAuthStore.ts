import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@react-native-firebase/auth';
import { UserSession } from '@floq/types';
import { api } from '../services/api';
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
  /** Finish the onboarding wizard with a fresh session (self-serve or join).
   *  Flips the app to authenticated and routes into PIN setup. */
  completeOnboarding: (session: UserSession) => Promise<void>;
  /** Check the quick-unlock PIN. triesLeft hits 0 after MAX_UNLOCK_TRIES misses. */
  unlock: (pin: string) => Promise<{ ok: boolean; triesLeft: number }>;
  unlockBiometric: () => void;
  setUnlockPin: (pin: string, bioOn?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  /** Delete the account on the server, wipe this phone's local data, sign out. */
  deleteAccount: () => Promise<void>;
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

export const MAX_UNLOCK_TRIES = 5;

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
    const tries = await authStorage.getUnlockTries();
    if (tries >= MAX_UNLOCK_TRIES) return { ok: false, triesLeft: 0 };
    const stored = await authStorage.getUnlockPin();
    if (stored && pin === stored) {
      await authStorage.setUnlockTries(0);
      set({ isLocked: false });
      return { ok: true, triesLeft: MAX_UNLOCK_TRIES };
    }
    await authStorage.setUnlockTries(tries + 1);
    return { ok: false, triesLeft: MAX_UNLOCK_TRIES - tries - 1 };
  },

  unlockBiometric: () => {
    authStorage.setUnlockTries(0).catch(() => {});
    set({ isLocked: false });
  },

  setUnlockPin: async (pin: string, bioOn = true) => {
    await authStorage.setUnlockPin(pin);
    await authStorage.setUnlockTries(0);
    await authStorage.setBioEnabled(bioOn);
    // Also register it on the server so phone + PIN login works on another
    // device. Best-effort: a quick-unlock PIN is set even if the sync fails.
    try { await api.setPin(pin); } catch { /* non-fatal — local unlock still set */ }
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

  completeOnboarding: async (session: UserSession) => {
    await applySession(set, get, session);
    // No device unlock PIN yet → route into PIN setup before the counter opens.
    if (!(await authStorage.hasUnlockPin())) set({ needsPinSetup: true });
  },

  logout: async () => {
    realtimeClient.disconnect();
    await authStorage.clearSession();
    api.setAuthToken(null);
    set({ session: null, isAuthenticated: false, isLocked: false, needsPinSetup: false, isLoading: false, error: null });
  },

  deleteAccount: async () => {
    await api.deleteAccount();
    await AsyncStorage.clear().catch(() => {});
    await getAuth().signOut().catch(() => {});
    await get().logout();
  },

  clearError: () => set({ error: null }),
}));
