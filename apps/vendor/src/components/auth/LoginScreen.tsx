import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { palette, fonts, borders, spacing } from '../../theme';
import { Numpad, PrimaryBar, Kicker } from '../common/ui';

const PIN_LEN = 4;

export function LoginScreen() {
  const [step, setStep] = useState<'PHONE' | 'PIN'>('PHONE');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const { loginWithPin, isLoading, error, clearError } = useAuthStore();

  const onPhoneKey = (d: string) => {
    if (phone.length >= 10) return;
    setPhone(phone + d);
  };
  const onPinKey = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
  };

  const handleLogin = async () => {
    try {
      clearError();
      await loginWithPin(phone, pin);
    } catch {
      setPin('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Brand */}
      <View style={styles.brand}>
        <Text style={styles.wordmark}>FLOQ</Text>
        <View style={styles.rule} />
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
          </View>
          <Numpad onKey={onPhoneKey} onBackspace={() => setPhone(phone.slice(0, -1))} />
          <PrimaryBar
            label="NEXT →"
            disabled={phone.length !== 10}
            onPress={() => {
              clearError();
              setStep('PIN');
            }}
          />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.displayArea}>
            <Kicker>ENTER YOUR PIN</Kicker>
            <View style={styles.pinDots}>
              {Array.from({ length: Math.max(PIN_LEN, pin.length) }).map((_, i) => (
                <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
              ))}
            </View>
            <Text style={styles.phoneHint}>+91 {phone}</Text>
          </View>
          <Numpad onKey={onPinKey} onBackspace={() => setPin(pin.slice(0, -1))} />
          {isLoading ? (
            <View style={styles.loadingBar}>
              <ActivityIndicator color={palette.onAccent} />
            </View>
          ) : (
            <PrimaryBar label="LOG IN →" disabled={pin.length < PIN_LEN} onPress={handleLogin} />
          )}
          <Text
            style={styles.changeNumber}
            onPress={() => {
              setStep('PHONE');
              setPin('');
              clearError();
            }}
          >
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
  rule: { width: 56, height: 6, backgroundColor: palette.accent, marginTop: 10 },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: palette.neutral[700], marginTop: 12 },
  body: { flex: 1, justifyContent: 'flex-end' },
  displayArea: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, flex: 1, justifyContent: 'center' },
  bigValue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 40, letterSpacing: -1, color: palette.ink, marginTop: 10 },
  pinDots: { flexDirection: 'row', gap: 16, marginTop: 20 },
  pinDot: { width: 20, height: 20, borderWidth: borders.rule, borderColor: palette.divider },
  pinDotFilled: { backgroundColor: palette.accent, borderColor: palette.accent },
  phoneHint: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600], marginTop: 18 },
  errorBox: { marginHorizontal: spacing.xxl, backgroundColor: palette.accentRamp[100], borderLeftWidth: 4, borderLeftColor: palette.accent, padding: 12 },
  errorText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.accentRamp[800] },
  loadingBar: { minHeight: 78, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  changeNumber: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[700], textAlign: 'center', paddingVertical: 16 },
});
