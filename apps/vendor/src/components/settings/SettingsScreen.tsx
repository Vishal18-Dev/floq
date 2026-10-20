import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { palette, fonts, borders, spacing } from '../../theme';
import { useStoreStore } from '../../store/useStoreStore';
import { SubscriptionStatus } from '../../services/api';
import { voiceService } from '../../services/voice';
import { SECONDARY_LANGUAGE_LABELS } from '../../i18n';
import type { SecondaryLanguage } from '../../i18n/strings';
import { Kicker } from '../common/ui';

const LANGS: SecondaryLanguage[] = ['none', 'ta', 'hi', 'mr'];

function subLabel(s: SubscriptionStatus): string {
  if (s.status === 'active') return s.plan === 'exempt' ? 'Active · Complimentary' : 'Active';
  if (s.status === 'trial') return 'Free trial';
  return 'Subscription ended';
}
function subDetail(s: SubscriptionStatus): string {
  if (s.status === 'trial') return `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`;
  if (s.status === 'active') {
    if (s.plan === 'exempt' || !s.currentPeriodEnd) return 'Thanks for being an early FLOQ merchant';
    const d = new Date(s.currentPeriodEnd);
    const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s.plan === 'annual' ? 'Yearly' : 'Monthly'} · renews ${date}`;
  }
  return 'Subscribe to keep making sales';
}

export function SettingsScreen({ onManageItems, onManageSubscription, onLogout, onBack }: { onManageItems: () => void; onManageSubscription: () => void; onLogout: () => void; onBack: () => void }) {
  const store = useStoreStore((s) => s.store);
  const settings = useStoreStore((s) => s.settings);
  const subscription = useStoreStore((s) => s.subscription);
  const updateSettings = useStoreStore((s) => s.updateSettings);

  const [upiId, setUpiId] = useState(settings?.upiId || '');
  const [saving, setSaving] = useState(false);

  const setLang = async (lang: SecondaryLanguage) => {
    try { await updateSettings({ secondaryLanguage: lang }); } catch {}
  };
  const toggleVoice = async () => {
    const next = !(settings?.voiceEnabled ?? true);
    voiceService.updateConfig({ enabled: next });
    try { await updateSettings({ voiceEnabled: next }); } catch {}
  };
  const saveUpi = async () => {
    setSaving(true);
    try { await updateSettings({ upiId: upiId.trim() }); Alert.alert('Saved', 'UPI ID updated.'); }
    catch (e: any) { Alert.alert('Could not save', e?.message || 'Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.head}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>{store?.name || 'Settings'}</Text>
        <Text style={styles.sub}>{store?.mode === 'RETAIL' ? 'Retail store' : 'Food counter'} · {store?.phone || ''}</Text>
      </View>

      {/* Subscription */}
      {subscription ? (
        <>
          <View style={styles.section}><Kicker>SUBSCRIPTION</Kicker></View>
          <TouchableOpacity style={styles.subRow} onPress={onManageSubscription} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subStatus}>{subLabel(subscription)}</Text>
              <Text style={styles.subDetail}>{subDetail(subscription)}</Text>
            </View>
            <Text style={styles.subCta}>{subscription.status === 'expired' ? 'SUBSCRIBE →' : 'VIEW PLANS →'}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {/* Language */}
      <View style={styles.section}><Kicker>SECOND LANGUAGE</Kicker></View>
      <View style={styles.langRow}>
        {LANGS.map((l) => (
          <TouchableOpacity key={l} style={[styles.langChip, settings?.secondaryLanguage === l && styles.langChipActive]} onPress={() => setLang(l)}>
            <Text style={[styles.langText, settings?.secondaryLanguage === l && styles.langTextActive]}>{SECONDARY_LANGUAGE_LABELS[l]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Voice (food only) */}
      {store?.mode !== 'RETAIL' && (
        <TouchableOpacity style={styles.row} onPress={toggleVoice}>
          <View><Text style={styles.rowLabel}>Voice call-outs</Text><Text style={styles.rowSub}>Announce “token ready” aloud</Text></View>
          <View style={[styles.switch, (settings?.voiceEnabled ?? true) && styles.switchOn]}>
            <Text style={styles.switchText}>{(settings?.voiceEnabled ?? true) ? 'ON' : 'OFF'}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* UPI */}
      <View style={styles.section}><Kicker>UPI ID (FOR QR)</Kicker></View>
      <View style={styles.upiRow}>
        <TextInput style={styles.input} value={upiId} onChangeText={setUpiId} placeholder="name@bank" placeholderTextColor={palette.neutral[500]} autoCapitalize="none" />
        <TouchableOpacity style={styles.saveBtn} onPress={saveUpi} disabled={saving}><Text style={styles.saveText}>{saving ? '…' : 'SAVE'}</Text></TouchableOpacity>
      </View>
      {!upiId ? <Text style={styles.warn}>No UPI ID set — the UPI QR is hidden until you add one. Cash still works.</Text> : null}

      {/* Manage items */}
      <TouchableOpacity style={styles.bigRow} onPress={onManageItems}>
        <Text style={styles.bigRowText}>MANAGE ITEMS & PRICES →</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logout} onPress={() => Alert.alert('Log out?', 'You will need your PIN to log back in.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: onLogout }])}>
        <Text style={styles.logoutText}>LOG OUT</Text>
      </TouchableOpacity>

      <Text style={styles.version}>FLOQ Merchant · beta</Text>
      <Text style={styles.build}>{buildLine()}</Text>
    </ScrollView>
  );
}

// Version + live OTA update id — read this out to support to identify the exact
// build/update a merchant is running. `updateId` is null on the embedded bundle
// (no over-the-air update applied yet).
function buildLine(): string {
  const version = Constants.expoConfig?.version || '1.0.0';
  let update = 'embedded';
  try {
    if (Updates.updateId) update = Updates.updateId.slice(0, 8);
  } catch {}
  const channel = (() => { try { return Updates.channel || 'dev'; } catch { return 'dev'; } })();
  return `v${version} · ${channel} · ${update}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  head: { padding: 16, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  back: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[700], marginBottom: 10 },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 26, letterSpacing: -0.5, color: palette.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[700], marginTop: 2 },
  section: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  langChip: { borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 12, paddingVertical: 10 },
  langChipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  langText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.ink },
  langTextActive: { color: palette.onAccent },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, borderWidth: borders.rule, borderColor: palette.divider, padding: 14 },
  subStatus: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },
  subDetail: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[700], marginTop: 2 },
  subCta: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 12, letterSpacing: 0.5, color: palette.accent },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginTop: 12, borderTopWidth: borders.rule, borderBottomWidth: borders.rule, borderColor: palette.divider },
  rowLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[700], marginTop: 2 },
  switch: { borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 12, paddingVertical: 6 },
  switchOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  switchText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 12, color: palette.ink },
  upiRow: { flexDirection: 'row', gap: borders.rule, paddingHorizontal: 16, alignItems: 'stretch' },
  input: { flex: 1, borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.semibold, fontSize: 15, color: palette.ink, backgroundColor: palette.surface },
  saveBtn: { backgroundColor: palette.ink, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, color: palette.onAccent },
  warn: { fontFamily: fonts.body, fontSize: 12, color: palette.accentRamp[700], paddingHorizontal: 16, paddingTop: 8 },
  bigRow: { margin: 16, borderWidth: borders.rule, borderColor: palette.divider, paddingVertical: 16, alignItems: 'center' },
  bigRowText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, letterSpacing: 0.5, color: palette.ink },
  logout: { marginHorizontal: 16, backgroundColor: palette.accent, paddingVertical: 16, alignItems: 'center' },
  logoutText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, letterSpacing: 1, color: palette.onAccent },
  version: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[500], textAlign: 'center', paddingTop: 24 },
  build: { fontFamily: fonts.body, fontSize: 11, color: palette.neutral[500], textAlign: 'center', paddingBottom: 24, paddingTop: 2 },
});
