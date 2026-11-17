import * as LocalAuthentication from 'expo-local-authentication';

export type BioKind = 'face' | 'finger';

/** Which unlock the phone offers, or null if no hardware / nothing enrolled. */
export async function biometricKind(): Promise<BioKind | null> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    return !finger && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'face' : 'finger';
  } catch {
    return null;
  }
}

/** Prompt fingerprint/Face. 'cancel' = the user chose "Use PIN"; 'fail' = the OS
 *  gave up (too many misses / locked out). Device-credential fallback is
 *  disabled so cancelling returns to our own app PIN, not the phone lock. */
export async function authenticateBiometric(subtitle?: string): Promise<'ok' | 'cancel' | 'fail'> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock floq',
      promptSubtitle: subtitle,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    if (res.success) return 'ok';
    return ['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback'].includes(res.error) ? 'cancel' : 'fail';
  } catch {
    return 'fail';
  }
}
