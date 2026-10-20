import { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';

// Thin wrapper over Firebase phone auth (RNFirebase v27 modular API). Isolates
// the native module so the rest of the app deals only in
// (phone -> confirmation -> idToken).
export type OtpConfirmation = Awaited<ReturnType<typeof signInWithPhoneNumber>>;

/** Send an OTP to a +91 number. Returns a confirmation handle for the code. */
export async function sendOtp(tenDigitPhone: string): Promise<OtpConfirmation> {
  return signInWithPhoneNumber(getAuth(), `+91${tenDigitPhone}`);
}

/** Confirm the SMS code and return a verified Firebase ID token. */
export async function confirmOtp(confirmation: OtpConfirmation, code: string): Promise<string> {
  const cred = await confirmation.confirm(code);
  if (!cred?.user) throw new Error('Could not verify the code. Try again.');
  return cred.user.getIdToken(true);
}
