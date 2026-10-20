import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { UserSession } from '@floq/types';

const TOKEN_KEY = 'floq_merchant_jwt_token';
const SESSION_KEY = 'floq_merchant_user_session';
const PIN_KEY = 'floq_merchant_unlock_pin';

export class AuthStorage {
  public async saveSession(session: UserSession): Promise<void> {
    const sessionStr = JSON.stringify(session);
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(TOKEN_KEY, session.token);
      await AsyncStorage.setItem(SESSION_KEY, sessionStr);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, session.token);
      await SecureStore.setItemAsync(SESSION_KEY, sessionStr);
    }
  }

  public async getSession(): Promise<UserSession | null> {
    try {
      let sessionStr: string | null = null;
      if (Platform.OS === 'web') {
        sessionStr = await AsyncStorage.getItem(SESSION_KEY);
      } else {
        sessionStr = await SecureStore.getItemAsync(SESSION_KEY);
      }

      if (!sessionStr) return null;
      const session: UserSession = JSON.parse(sessionStr);

      // Check token expiration
      if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
        await this.clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  public async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return AsyncStorage.getItem(TOKEN_KEY);
      }
      return SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public async clearSession(): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(SESSION_KEY);
      await AsyncStorage.removeItem(PIN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(PIN_KEY);
    }
  }

  // Local quick-unlock PIN (device-only). Stored in the OS keystore; the server
  // JWT remains the real credential — this is a convenience lock.
  private pinStore = Platform.OS === 'web'
    ? { get: (k: string) => AsyncStorage.getItem(k), set: (k: string, v: string) => AsyncStorage.setItem(k, v) }
    : { get: (k: string) => SecureStore.getItemAsync(k), set: (k: string, v: string) => SecureStore.setItemAsync(k, v) };

  public async setUnlockPin(pin: string): Promise<void> {
    await this.pinStore.set(PIN_KEY, pin);
  }
  public async getUnlockPin(): Promise<string | null> {
    try { return await this.pinStore.get(PIN_KEY); } catch { return null; }
  }
  public async hasUnlockPin(): Promise<boolean> {
    return !!(await this.getUnlockPin());
  }
}

export const authStorage = new AuthStorage();
