import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { palette, fonts, borders, spacing } from '../../theme';
import { Numpad, Kicker, PrimaryBar } from '../common/ui';

const PIN_LEN = 4;

/** First run after OTP login (existing merchant): set a quick-unlock PIN. */
export function SetUnlockPinScreen() {
  const { setUnlockPin } = useAuthStore();
  const [step, setStep] = useState<'SET' | 'CONFIRM'>('SET');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onKey = (d: string) => {
    setError(null);
    setPin((p) => (p + d).slice(0, 6));
  };

  const next = async () => {
    if (step === 'SET') {
      setFirst(pin);
      setPin('');
      setStep('CONFIRM');
      return;
    }
    if (pin !== first) {
      setError('PINs did not match — start again');
      setPin('');
      setFirst('');
      setStep('SET');
      return;
    }
    await setUnlockPin(pin); // unlocks + clears needsPinSetup
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>FLOQ</Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>Set a PIN to open the app quickly</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.displayArea}>
          <Kicker>{step === 'SET' ? 'CHOOSE A 4-DIGIT PIN' : 'CONFIRM YOUR PIN'}</Kicker>
          <View style={styles.pinDots}>
            {Array.from({ length: Math.max(PIN_LEN, pin.length) }).map((_, i) => (
              <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <Numpad onKey={onKey} onBackspace={() => setPin(pin.slice(0, -1))} />
        <PrimaryBar label={step === 'SET' ? 'NEXT →' : 'SAVE PIN →'} disabled={pin.length < PIN_LEN} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  brand: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  wordmark: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 56, letterSpacing: -3, color: palette.ink },
  rule: { width: 56, height: 6, backgroundColor: palette.accent, marginTop: 10 },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: palette.neutral[700], marginTop: 12 },
  body: { flex: 1, justifyContent: 'flex-end' },
  displayArea: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, flex: 1, justifyContent: 'center' },
  pinDots: { flexDirection: 'row', gap: 16, marginTop: 20 },
  pinDot: { width: 20, height: 20, borderWidth: borders.rule, borderColor: palette.divider },
  pinDotFilled: { backgroundColor: palette.accent, borderColor: palette.accent },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: palette.accent, marginTop: 16 },
});
