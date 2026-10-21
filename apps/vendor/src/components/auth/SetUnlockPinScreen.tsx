import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { palette, fonts, borders, spacing } from '../../theme';
import { Numpad, Kicker, PrimaryBar } from '../common/ui';

const PIN_LEN = 4;

/** First run after OTP login (existing merchant): set a quick-unlock PIN.
 *  Single entry — it's a convenience lock, and fingerprint/Face is the fast path. */
export function SetUnlockPinScreen() {
  const { setUnlockPin } = useAuthStore();
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (pin.length < PIN_LEN || saving) return;
    setSaving(true);
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
          <Kicker>CHOOSE A 4-DIGIT PIN</Kicker>
          <View style={styles.pinDots}>
            {Array.from({ length: Math.max(PIN_LEN, pin.length) }).map((_, i) => (
              <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
            ))}
          </View>
          <Text style={styles.hint}>You'll use this (or your fingerprint) each time you open FLOQ.</Text>
        </View>
        <Numpad onKey={(d) => setPin((pin + d).slice(0, 6))} onBackspace={() => setPin(pin.slice(0, -1))} />
        <PrimaryBar label={saving ? '…' : 'SAVE PIN →'} disabled={pin.length < PIN_LEN || saving} onPress={save} />
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
  hint: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[600], marginTop: 18, maxWidth: 300 },
});
