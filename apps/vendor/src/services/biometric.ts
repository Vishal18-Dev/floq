import * as LocalAuthentication from 'expo-local-authentication';

/** Device has fingerprint/Face hardware AND the user has enrolled one. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Prompt fingerprint/Face. Returns true on success. */
export async function authenticateBiometric(): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock FLOQ',
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Use PIN',
    });
    return res.success;
  } catch {
    return false;
  }
}
