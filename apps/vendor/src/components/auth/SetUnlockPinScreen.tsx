import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { biometricKind, BioKind } from '../../services/biometric';
import { palette, fonts, borders } from '../../theme';
import { PinDots, PinPad } from '../common/ui';
import { Icon } from '../common/Icon';

const PIN_LEN = 4;

/** Repeats (1111), runs (1234, 9876) and a few common picks. */
export const weakPin = (p: string) =>
  /^(\d)\1{3}$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p) || ['1212', '2000', '1010', '6969'].includes(p);

/** 6a "Lock floq on this phone" — after OTP (signup, login or join): choose a
 *  4-digit PIN, enter it again, and opt into fingerprint/face. */
export function SetUnlockPinScreen() {
  const { setUnlockPin } = useAuthStore();
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState(''); // set → confirming
  const [done, setDone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [bio, setBio] = useState<BioKind | null>(null);
  const [bioOn, setBioOn] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { biometricKind().then(setBio); }, []);

  const onKey = (d: string) => {
    if (done || pin.length >= PIN_LEN) return;
    const p = pin + d;
    setErr(null);
    if (p.length < PIN_LEN) return setPin(p);
    setPin('');
    if (!first) {
      if (weakPin(p)) return setErr('Too easy to guess. Avoid repeats and runs like 1234.');
      return setFirst(p);
    }
    setFirst('');
    if (p === first) return setDone(p);
    setErr('Those PINs didn’t match. Choose your PIN again.');
  };

  const save = async () => {
    if (!done) return setErr('Set your PIN to continue — enter it twice.');
    if (saving) return;
    setSaving(true);
    await setUnlockPin(done, !!bio && bioOn); // unlocks + clears needsPinSetup
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <View style={{ gap: 4 }}>
          <Text style={styles.h1}>Lock floq on this phone</Text>
          <Text style={styles.sub}>You’ll open floq with this every morning. Pick 4 digits that aren’t your UPI or ATM PIN.</Text>
        </View>

        {done ? (
          <View style={styles.doneRow}>
            <Icon name="check-circle" size={22} color={palette.success} />
            <Text style={styles.doneText}>PIN set for this phone</Text>
            <TouchableOpacity style={styles.changeBtn} onPress={() => { setDone(''); setErr(null); }}>
              <Text style={styles.link}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={styles.center}>
              <Text accessibilityLiveRegion="polite" style={[styles.label, err ? styles.labelErr : null]}>
                {err || (first ? 'Enter the same PIN again' : 'Choose a 4-digit PIN')}
              </Text>
              <PinDots filled={pin.length} error={!!err && !pin} />
            </View>
            <PinPad onKey={onKey} onBackspace={() => setPin(pin.slice(0, -1))} />
          </View>
        )}

        {bio ? (
          <TouchableOpacity style={styles.bioRow} activeOpacity={0.85} onPress={() => setBioOn(!bioOn)}
            accessibilityRole="switch" accessibilityState={{ checked: bioOn }}>
            <Icon name={bio === 'face' ? 'scan-face' : 'fingerprint'} size={24} color={palette.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Unlock with {bio === 'face' ? 'face' : 'fingerprint'}</Text>
              <Text style={styles.rowSub}>Uses what’s already saved on this phone. floq never sees it. The PIN stays as a backup.</Text>
            </View>
            <View style={[styles.track, bioOn ? styles.trackOn : styles.trackOff]}>
              <View style={[styles.knob, bioOn ? styles.knobOn : styles.knobOff]} />
            </View>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {done && err ? <Text style={styles.errText}>{err}</Text> : null}
        <TouchableOpacity style={[styles.cta, (!done || saving) && { opacity: 0.6 }]} onPress={save} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={palette.onHighlight} /> : (
            <>
              <Text style={styles.ctaLabel}>Continue</Text>
              <Text style={styles.ctaLabel}>→</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  body: { padding: 16, paddingTop: 24, gap: 16, paddingBottom: 28 },
  h1: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 26, letterSpacing: -0.4, color: palette.ink },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: palette.neutral[600] },
  center: { alignItems: 'center', gap: 12, paddingVertical: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  labelErr: { color: palette.accentRamp[600] },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.successBg, paddingHorizontal: 16, paddingVertical: 8, minHeight: 56 },
  doneText: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: palette.success },
  changeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 16, color: palette.link },
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.card, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18, color: palette.neutral[600] },
  track: { width: 52, height: 32, borderRadius: 16, justifyContent: 'center' },
  trackOn: { backgroundColor: palette.ink },
  trackOff: { backgroundColor: palette.surface, borderWidth: 2, borderColor: palette.neutral[600] },
  knob: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
  knobOn: { left: 24, backgroundColor: palette.highlight },
  knobOff: { left: 2, backgroundColor: palette.neutral[600] },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 8, backgroundColor: palette.bg, borderTopWidth: borders.rule, borderTopColor: palette.dividerFaint },
  errText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.accentRamp[600] },
  cta: { minHeight: 60, backgroundColor: palette.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  ctaLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
});
