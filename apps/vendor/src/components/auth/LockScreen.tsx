import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { biometricAvailable, authenticateBiometric } from '../../services/biometric';
import { palette, fonts, borders, spacing } from '../../theme';
import { Numpad, Kicker } from '../common/ui';

const PIN_LEN = 4;

/** Quick unlock on every app open: PIN or fingerprint/Face. */
export function LockScreen({ storeName }: { storeName?: string }) {
  const { unlock, unlockBiometric, logout } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [hasBio, setHasBio] = useState(false);

  const tryBiometric = useCallback(async () => {
    if (await authenticateBiometric()) unlockBiometric();
  }, [unlockBiometric]);

  useEffect(() => {
    (async () => {
      const ok = await biometricAvailable();
      setHasBio(ok);
      if (ok) tryBiometric(); // auto-prompt on open
    })();
  }, [tryBiometric]);

  const onKey = async (d: string) => {
    setError(false);
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length >= PIN_LEN) {
      const ok = await unlock(next);
      if (!ok) {
        setError(true);
        setTimeout(() => setPin(''), 400);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>FLOQ</Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>{storeName || 'Counter POS'}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.displayArea}>
          <Kicker>{error ? 'WRONG PIN — TRY AGAIN' : 'ENTER PIN TO UNLOCK'}</Kicker>
          <View style={styles.pinDots}>
            {Array.from({ length: Math.max(PIN_LEN, pin.length) }).map((_, i) => (
              <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled, error && styles.pinDotError]} />
            ))}
          </View>
          {hasBio ? (
            <TouchableOpacity onPress={tryBiometric} style={styles.bioBtn}>
              <Text style={styles.bioText}>Use fingerprint / Face →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Numpad onKey={onKey} onBackspace={() => setPin(pin.slice(0, -1))} />
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signout}>Forgot PIN? Sign out & use OTP</Text>
        </TouchableOpacity>
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
  pinDotError: { borderColor: palette.accent },
  bioBtn: { marginTop: 28 },
  bioText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.accent },
  signout: { fontFamily: fonts.semibold, fontSize: 13, color: palette.neutral[600], textAlign: 'center', paddingVertical: 16 },
});
