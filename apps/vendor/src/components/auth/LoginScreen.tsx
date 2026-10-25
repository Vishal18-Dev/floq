import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView, Image } from 'react-native';
import { useAuthStore, NeedsOnboardingError } from '../../store/useAuthStore';
import { sendOtp, confirmOtp, OtpConfirmation } from '../../services/firebaseOtp';
import { palette, fonts, borders, spacing } from '../../theme';
import { Numpad, PrimaryBar, Kicker } from '../common/ui';

const OTP_LEN = 6;

/** Phone-OTP login. Existing numbers land straight in; a new number calls
 *  onNeedsOnboarding with the verified token + phone to start the wizard. */
export function LoginScreen({ onNeedsOnboarding }: { onNeedsOnboarding: (idToken: string, phone: string) => void }) {
  const [step, setStep] = useState<'PHONE' | 'CODE'>('PHONE');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<OtpConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loginWithOtp } = useAuthStore();

  const doSend = async () => {
    setBusy(true);
    setError(null);
    try {
      const conf = await sendOtp(phone);
      setConfirmation(conf);
      setStep('CODE');
    } catch (e: any) {
      setError(e?.message || 'Could not send the code. Check the number and try again.');
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    if (!confirmation) return;
    setBusy(true);
    setError(null);
    try {
      const idToken = await confirmOtp(confirmation, code);
      await loginWithOtp(idToken, phone);
      // success → App re-renders authenticated
    } catch (e: any) {
      if (e instanceof NeedsOnboardingError) {
        onNeedsOnboarding(e.idToken, e.phone);
        return;
      }
      setCode('');
      setError(e?.message || 'Wrong code — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brand}>
        <Image source={require('../../../assets/floq_logo_horizontal.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>Counter POS</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {step === 'PHONE' ? (
        <View style={styles.body}>
          <View style={styles.displayArea}>
            <Kicker>YOUR PHONE NUMBER</Kicker>
            <Text style={styles.bigValue}>{phone ? `+91 ${phone}` : '+91'}</Text>
            <Text style={styles.sub}>We'll text you a one-time code</Text>
          </View>
          <Numpad onKey={(d) => phone.length < 10 && setPhone(phone + d)} onBackspace={() => setPhone(phone.slice(0, -1))} />
          {busy ? (
            <View style={styles.loadingBar}><ActivityIndicator color={palette.onAccent} /></View>
          ) : (
            <PrimaryBar label="SEND CODE →" disabled={phone.length !== 10} onPress={doSend} />
          )}
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.displayArea}>
            <Kicker>ENTER THE CODE</Kicker>
            <Text style={styles.bigValue}>{code || '••••••'}</Text>
            <Text style={styles.sub}>Sent to +91 {phone}</Text>
          </View>
          <Numpad onKey={(d) => code.length < OTP_LEN && setCode(code + d)} onBackspace={() => setCode(code.slice(0, -1))} />
          {busy ? (
            <View style={styles.loadingBar}><ActivityIndicator color={palette.onAccent} /></View>
          ) : (
            <PrimaryBar label="VERIFY →" disabled={code.length < OTP_LEN} onPress={doVerify} />
          )}
          <Text style={styles.changeNumber} onPress={() => { setStep('PHONE'); setCode(''); setError(null); setConfirmation(null); }}>
            ← Change number
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  brand: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  wordmark: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 56, letterSpacing: -3, color: palette.ink },
  logo: { width: 168, height: 50, marginBottom: 4 },
  rule: { width: 56, height: 6, backgroundColor: palette.accent, marginTop: 10 },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: palette.neutral[700], marginTop: 12 },
  body: { flex: 1, justifyContent: 'flex-end' },
  displayArea: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, flex: 1, justifyContent: 'center' },
  bigValue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 40, letterSpacing: -1, color: palette.ink, marginTop: 10 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600], marginTop: 14 },
  errorBox: { marginHorizontal: spacing.xxl, backgroundColor: palette.accentRamp[100], borderLeftWidth: 4, borderLeftColor: palette.accentRamp[600], padding: 12 },
  errorText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.accentRamp[800] },
  loadingBar: { minHeight: 78, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  changeNumber: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[700], textAlign: 'center', paddingVertical: 16 },
});
