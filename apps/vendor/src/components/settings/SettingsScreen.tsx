import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { palette, fonts } from '../../theme';
import { useStoreStore } from '../../store/useStoreStore';
import { useCatalogStore } from '../../store/useCatalogStore';
import { SubscriptionStatus } from '../../services/api';
import { voiceService } from '../../services/voice';
import { INR, entries, daysLeft, retailPrefs } from '../../services/retail';
import type { SecondaryLanguage } from '../../i18n/strings';
import type { ServicePrefs, StoreSettings } from '@floq/types';

// Settings — design 5g. Opened from the store name in the header. Every row
// here changes something real; rows the design sketches that have nothing
// behind them yet (bill printer, scale, GST invoices, WhatsApp reminders…) are
// left out rather than shown as dead switches.

const LANGS: [SecondaryLanguage, string][] = [['ta', 'தமிழ்'], ['hi', 'हिन्दी'], ['mr', 'मराठी'], ['none', 'English only']];
const LANG_NAME: Record<SecondaryLanguage, string> = { ta: 'Tamil', hi: 'Hindi', mr: 'Marathi', none: '' };
const TERMS = [7, 15, 30];
const LIMITS = [1000, 2000, 5000];

function subLabel(s: SubscriptionStatus): string {
  if (s.status === 'active') return s.plan === 'exempt' ? 'Active · Complimentary' : 'Active';
  if (s.status === 'trial') return 'Free trial';
  return 'Subscription ended';
}
function subDetail(s: SubscriptionStatus): string {
  if (s.status === 'trial') return `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`;
  if (s.status === 'active') {
    if (s.plan === 'exempt' || !s.currentPeriodEnd) return 'Thanks for being an early floq merchant';
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
  const products = useCatalogStore((s) => s.products);
  const retail = store?.mode === 'RETAIL';

  const [upiOpen, setUpiOpen] = useState(false);
  const [upiId, setUpiId] = useState(settings?.upiId || '');
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(toastT.current), []);

  const flash = (msg: string) => {
    clearTimeout(toastT.current);
    setToast(msg);
    toastT.current = setTimeout(() => setToast(null), 2600);
  };
  const save = async (updates: Partial<StoreSettings>, msg: string) => {
    try { await updateSettings(updates); flash(msg); }
    catch (e: any) { Alert.alert('Could not save', e?.message || 'Try again.'); }
  };
  const savePrefs = (p: Partial<ServicePrefs>, msg: string) => save({ servicePrefs: { ...settings?.servicePrefs, ...p } }, msg);

  const lang = (settings?.secondaryLanguage || 'none') as SecondaryLanguage;
  const { lowDays, termDays } = retailPrefs();
  const limit = settings?.defaultCreditLimit ?? 2000;
  const creditOn = settings?.creditEnabled !== false;
  const voiceOn = settings?.voiceEnabled ?? true;
  const lowCount = entries(products).filter((e) => daysLeft(e) <= lowDays).length;
  const due = new Date(Date.now() + termDays * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const saveUpi = async () => {
    const v = upiId.trim();
    if (v && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v)) { Alert.alert('Check the UPI ID', 'It looks like name@bank.'); return; }
    await save({ upiId: v }, v ? 'UPI ID saved. It shows on every bill QR.' : 'UPI ID removed.');
    setUpiOpen(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back to Sell">
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      {toast ? <Text accessibilityLiveRegion="polite" style={styles.toast}>{toast}</Text> : null}

      <ScrollView contentContainerStyle={styles.body}>
        {/* Store profile */}
        <View style={[styles.card, styles.profile]}>
          <View style={styles.initial}><Text style={styles.initialText}>{(store?.name || 'f').trim().charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{store?.name || 'Your store'}</Text>
            {store?.phone ? <Text style={styles.sub}>Owner · {store.phone}</Text> : null}
            <Text style={styles.sub}>{retail ? 'Shop' : 'Food counter'}{store?.city ? ` · ${store.city}` : ''}</Text>
          </View>
        </View>

        {/* Store */}
        <Section label="STORE">
          <View style={styles.rowCol}>
            <RowText title="Bill and screen language" sub="English always shows. Product names and bills add this language." />
            <Segmented
              label="Bill and screen language"
              options={LANGS.map(([v, l]) => ({ value: v, label: l }))}
              value={lang}
              onChange={(v) => save({ secondaryLanguage: v }, v === 'none' ? 'Bills and screens now show English only.' : `Bills and screens now show English and ${LANG_NAME[v]}.`)}
            />
          </View>
          <TouchableOpacity style={[styles.row, styles.rule]} onPress={() => setUpiOpen((o) => !o)} accessibilityRole="button">
            <RowText title="UPI for payments" sub={settings?.upiId ? `${settings.upiId} · shows on every bill QR` : 'Not set — the UPI QR is hidden. Cash still works.'} />
            {settings?.upiId ? <Text style={styles.chipOk}>Set</Text> : <Text style={styles.chipWarn}>Add</Text>}
            <Text style={styles.chev}>{upiOpen ? '⌄' : '›'}</Text>
          </TouchableOpacity>
          {upiOpen ? (
            <View style={styles.upiEdit}>
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="name@bank"
                placeholderTextColor={palette.neutral[500]}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="UPI ID"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveUpi}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
            </View>
          ) : null}
          {!retail ? (
            <Switch
              title="Voice call-outs"
              sub={voiceOn ? 'Announces “Token 36 is ready” aloud' : 'Off — call tokens yourself'}
              on={voiceOn}
              onPress={() => { voiceService.updateConfig({ enabled: !voiceOn }); save({ voiceEnabled: !voiceOn }, !voiceOn ? 'Voice call-outs on.' : 'Voice call-outs off.'); }}
            />
          ) : null}
        </Section>

        {/* Credit (retail) */}
        {retail ? (
          <Section label="CREDIT (UDHAAR)">
            <Switch
              title="Give credit"
              sub={creditOn ? 'On credit shows when you charge, and Dues tracks it' : 'Off — cash and UPI only, Dues is hidden'}
              on={creditOn}
              first
              onPress={() => save({ creditEnabled: !creditOn }, !creditOn ? 'Credit is on. Dues is back in the menu.' : 'Credit is off. Dues is hidden.')}
            />
            {creditOn ? (
              <>
                <View style={[styles.rowCol, styles.rule]}>
                  <RowText title="Pay back within" sub={`For new credit bills and shop orders. Credit given today is due ${due}.`} />
                  <Segmented
                    label="Credit term"
                    options={TERMS.map((v) => ({ value: v, label: `${v} days` }))}
                    value={termDays}
                    onChange={(v) => savePrefs({ creditTermDays: v }, `New credit is now due in ${v} days.`)}
                  />
                </View>
                <View style={[styles.rowCol, styles.rule]}>
                  <RowText title="Limit for new customers" sub="Each customer keeps their own limit once added." />
                  <Segmented
                    label="Default credit limit"
                    options={LIMITS.map((v) => ({ value: v, label: INR(v) }))}
                    value={limit}
                    onChange={(v) => save({ defaultCreditLimit: v }, `New customers start with a ${INR(v)} limit.`)}
                  />
                </View>
              </>
            ) : null}
          </Section>
        ) : null}

        {/* Stock (retail) */}
        {retail ? (
          <Section label="STOCK">
            <View style={styles.row}>
              <RowText
                title="Low-stock warning"
                sub={`Warn when an item has under ${lowDays} days left. ${lowCount ? (lowCount === 1 ? '1 item is' : `${lowCount} items are`) + ' low right now.' : 'Nothing is low right now.'}`}
              />
              <View style={styles.stepper}>
                <StepBtn label="−" a11y="Fewer days" disabled={lowDays <= 2} onPress={() => savePrefs({ lowStockDays: lowDays - 1 }, `Low-stock warning at ${lowDays - 1} days.`)} />
                <Text style={styles.stepVal} accessibilityLiveRegion="polite">{lowDays} days</Text>
                <StepBtn label="+" a11y="More days" disabled={lowDays >= 14} onPress={() => savePrefs({ lowStockDays: lowDays + 1 }, `Low-stock warning at ${lowDays + 1} days.`)} />
              </View>
            </View>
          </Section>
        ) : null}

        {/* Account */}
        <Section label="TEAM AND ACCOUNT">
          {subscription ? (
            <NavRow first title={`Subscription · ${subLabel(subscription)}`} sub={subDetail(subscription)} onPress={onManageSubscription} />
          ) : null}
          <NavRow first={!subscription} title={retail ? 'Products and prices' : 'Menu and prices'} sub="Add, edit or remove items" onPress={onManageItems} />
        </Section>

        <View style={{ gap: 2 }}>
          <TouchableOpacity
            style={styles.logout}
            onPress={() => Alert.alert('Log out of this phone?', 'You will need your PIN to log back in.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: onLogout }])}
          >
            <Text style={styles.logoutText}>Log out of this phone</Text>
          </TouchableOpacity>
          <Text style={styles.foot}>Bills on this phone are synced. {buildLine()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function RowText({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg} accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            style={[styles.segBtn, on && styles.segBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) onChange(o.value); }}
          >
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Switch({ title, sub, on, onPress, first }: { title: string; sub: string; on: boolean; onPress: () => void; first?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, !first && styles.rule]} onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <RowText title={title} sub={sub} />
      <View style={[styles.track, on ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
      </View>
    </TouchableOpacity>
  );
}

function NavRow({ title, sub, onPress, first }: { title: string; sub: string; onPress: () => void; first?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, !first && styles.rule]} onPress={onPress} accessibilityRole="button">
      <RowText title={title} sub={sub} />
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );
}

function StepBtn({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.stepBtn, disabled && { opacity: 0.6 }]} disabled={disabled} onPress={onPress} accessibilityLabel={a11y}>
      <Text style={[styles.stepText, disabled && { color: palette.neutral[500] }]}>{label}</Text>
    </TouchableOpacity>
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
  return `floq v${version} · ${channel} · ${update}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: fonts.semibold, fontSize: 24, color: palette.ink },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 26, color: palette.ink },
  toast: { borderRadius: 18, marginHorizontal: 16, marginTop: 4, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: palette.successBg, color: palette.success, fontFamily: fonts.semibold, fontSize: 16 },
  body: { padding: 16, paddingTop: 8, gap: 18, paddingBottom: 24 },
  card: { borderRadius: 18, backgroundColor: palette.card },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  initial: { borderRadius: 12, width: 52, height: 52, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.onHighlight },
  profileName: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink },
  sectionLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, letterSpacing: 0.3, color: palette.link, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 64 },
  rowCol: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  rule: { borderTopWidth: 1, borderTopColor: palette.surface },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  sub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18, color: palette.neutral[600] },
  chev: { fontFamily: fonts.semibold, fontSize: 22, color: palette.neutral[600] },
  chipOk: { borderRadius: 12, fontFamily: fonts.semibold, fontSize: 13, color: palette.success, backgroundColor: palette.successBg, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  chipWarn: { fontFamily: fonts.semibold, fontSize: 13, color: palette.accentRamp[600], backgroundColor: palette.accentRamp[100], paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  upiEdit: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  input: { borderRadius: 18, flex: 1, minHeight: 48, backgroundColor: palette.bg, paddingHorizontal: 12, fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  saveBtn: { borderRadius: 18, minHeight: 48, paddingHorizontal: 18, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.onHighlight },
  seg: { borderRadius: 12, flexDirection: 'row', padding: 4, gap: 4, backgroundColor: palette.surface },
  segBtn: { borderRadius: 12, flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segBtnOn: { backgroundColor: palette.card, shadowColor: palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 2, elevation: 1 },
  segText: { fontFamily: fonts.body, fontSize: 16, color: palette.ink },
  segTextOn: { fontFamily: fonts.heading, fontWeight: '800' },
  track: { width: 52, height: 32, borderRadius: 16, justifyContent: 'center' },
  trackOn: { backgroundColor: palette.ink },
  trackOff: { backgroundColor: palette.surface, borderWidth: 2, borderColor: palette.neutral[600] },
  knob: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
  knobOn: { left: 24, backgroundColor: palette.highlight },
  knobOff: { left: 2, backgroundColor: palette.neutral[600] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { borderRadius: 12, width: 44, height: 44, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.ink },
  stepVal: { minWidth: 56, textAlign: 'center', fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },
  logout: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  logoutText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.accentRamp[600] },
  foot: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18, color: palette.neutral[600], paddingHorizontal: 4 },
});
