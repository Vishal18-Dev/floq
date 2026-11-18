import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image } from 'react-native';
import { useAuthStore, MAX_UNLOCK_TRIES } from '../../store/useAuthStore';
import { authStorage } from '../../services/authStorage';
import { biometricKind, authenticateBiometric, BioKind } from '../../services/biometric';
import { palette, fonts, shadow } from '../../theme';
import { PinDots, PinPad } from '../common/ui';

const PIN_LEN = 4;
const ROLE: Record<string, string> = { OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** 6b Unlock — every app open: fingerprint/face first, PIN as the fallback.
 *  5 wrong PINs lock the PIN; the way back is logging in again with a code. */
export function LockScreen({ storeName }: { storeName?: string }) {
  const { session, unlock, unlockBiometric, logout } = useAuthStore();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [bio, setBio] = useState<BioKind | null>(null);
  const [blocked, setBlocked] = useState<'tries' | 'forgot' | null>(null);
  const busy = useRef(false);

  const who = [storeName, session?.role && ROLE[session.role]].filter(Boolean).join(' · ');
  const firstName = session?.name?.trim().split(/\s+/)[0];

  const tryBio = useCallback(async (kind: BioKind) => {
    const res = await authenticateBiometric(who || undefined);
    if (res === 'ok') return unlockBiometric();
    if (res === 'fail') setNote((kind === 'face' ? 'Face unlock' : 'Fingerprint') + ' didn’t work. Enter your PIN.');
  }, [unlockBiometric, who]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if ((await authStorage.getUnlockTries()) >= MAX_UNLOCK_TRIES) return setBlocked('tries');
      const kind = (await authStorage.getBioEnabled()) ? await biometricKind() : null;
      if (cancelled || !kind) return;
      setBio(kind);
      // Small delay so the activity is fully foregrounded before the OS sheet.
      setTimeout(() => { if (!cancelled) tryBio(kind); }, 500);
    })();
    return () => { cancelled = true; };
  }, [tryBio]);

  const onKey = async (d: string) => {
    if (busy.current || pin.length >= PIN_LEN) return;
    const next = pin + d;
    setPin(next);
    setErr(null);
    if (next.length < PIN_LEN) return;
    busy.current = true;
    const { ok, triesLeft } = await unlock(next);
    busy.current = false;
    if (ok) return;
    if (triesLeft <= 0) return setBlocked('tries');
    setErr(`Wrong PIN. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`);
    setPin('');
  };

  const logo = (w: number) => (
    <Image source={require('../../../assets/floq_wordmark.png')} style={{ width: w, height: w / 2 }} resizeMode="contain" accessibilityLabel="floq" />
  );

  if (blocked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.center}>{logo(96)}</View>
          <View style={{ gap: 6, paddingTop: 24 }}>
            <Text style={styles.blockTitle}>{blocked === 'forgot' ? 'Reset your PIN' : 'PIN locked on this phone'}</Text>
            <Text style={styles.blockBody}>
              {blocked === 'forgot'
                ? 'Log in with a code sent to your number, then choose a new PIN.'
                : '5 wrong PINs. For safety, log in again with a code sent to your number, then choose a new PIN.'}
            </Text>
          </View>
          <Text style={styles.card}>Bills, stock and dues are saved to your store. Nothing is deleted.</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={logout}>
            <Text style={styles.ctaLabel}>Log in again with a code</Text>
            <Text style={styles.ctaLabel}>→</Text>
          </TouchableOpacity>
          {blocked === 'forgot' ? (
            <TouchableOpacity style={styles.linkBtn} onPress={() => setBlocked(null)}>
              <Text style={styles.link}>Back to PIN</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={[styles.center, { gap: 14 }]}>
          {logo(96)}
          <View style={styles.center}>
            <Text style={styles.greeting}>{firstName ? `${greeting()}, ${firstName}` : greeting()}</Text>
            {who ? <Text style={styles.who}>{who}</Text> : null}
          </View>
        </View>
        {note ? <Text style={styles.card}>{note}</Text> : null}
        <View style={[styles.center, { gap: 10, paddingTop: 8 }]}>
          <Text accessibilityLiveRegion="polite" style={[styles.label, err ? styles.labelErr : null]}>{err || 'Enter your PIN'}</Text>
          <PinDots filled={pin.length} error={!!err && !pin} />
        </View>
        <View style={{ flex: 1 }} />
        <PinPad
          onKey={onKey}
          onBackspace={() => setPin(pin.slice(0, -1))}
          bio={bio}
          onBio={() => bio && tryBio(bio)}
        />
        <TouchableOpacity style={styles.linkBtn} onPress={() => setBlocked('forgot')}>
          <Text style={styles.link}>Forgot PIN?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16, gap: 16 },
  center: { alignItems: 'center' },
  greeting: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 26, lineHeight: 30, color: palette.ink, textAlign: 'center' },
  who: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600], marginTop: 2, textAlign: 'center' },
  card: { borderRadius: 14, backgroundColor: palette.card, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: palette.ink },
  label: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  labelErr: { color: palette.accentRamp[600] },
  linkBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  link: { fontFamily: fonts.semibold, fontSize: 16, color: palette.link },
  blockTitle: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 28, lineHeight: 32, color: palette.ink },
  blockBody: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: palette.neutral[600] },
  cta: { borderRadius: 14, ...shadow.cta, minHeight: 60, backgroundColor: palette.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  ctaLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
});
