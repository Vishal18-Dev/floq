import * as LocalAuthentication from 'expo-local-authentication';

/** Device has fingerprint/Face hardware AND the user has enrolled one. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Prompt fingerprint/Face. Returns true on success. Device-credential fallback
 *  is disabled so cancelling returns to our own app PIN, not the phone lock. */
export async function authenticateBiometric(): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock FLOQ',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return res.success;
  } catch {
    return false;
  }
}
