import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Linking, Alert } from 'react-native';
import { formatINR } from '@floq/utils';
import { palette, fonts, borders, spacing } from '../../theme';
import { api, SubscriptionStatus } from '../../services/api';
import { useT } from '../../i18n';
import { Kicker, PrimaryBar } from '../common/ui';
import { UpiQr, buildUpiUri } from '../sell/UpiQr';

type Plan = 'monthly' | 'annual';

export function SubscribeScreen({
  subscription,
  onSubmitted,
  onClose,
}: {
  subscription: SubscriptionStatus;
  onSubmitted: () => void;
  onClose?: () => void;
}) {
  const { t, bi } = useT();
  const [plan, setPlan] = useState<Plan>('monthly');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const amount = plan === 'annual' ? subscription.prices.annual : subscription.prices.monthly;

  const headline =
    subscription.status === 'expired'
      ? t('subscriptionEnded')
      : subscription.status === 'active'
      ? 'Your subscription is active'
      : `${subscription.daysLeft} ${t('trialDaysLeft')}`;

  // Open the amount in the user's own UPI app (GPay/PhonePe/Paytm chooser) —
  // you can't scan a QR on the same phone that's showing it.
  const openUpiApp = async () => {
    if (!subscription.collectionUpiId) return;
    const uri = buildUpiUri({ upiId: subscription.collectionUpiId, name: subscription.collectionUpiName || 'FLOQ', amount, note: `FLOQ ${plan}` });
    try {
      await Linking.openURL(uri);
    } catch {
      Alert.alert('No UPI app found', 'Install GPay, PhonePe or Paytm — or scan the QR from another phone.');
    }
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.submitSubscriptionPayment(plan, ref.trim() || undefined);
      setPending(true);
      onSubmitted();
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  // While awaiting manual activation, quietly poll so the screen flips to
  // "active" on its own — no restart, no manual refresh.
  useEffect(() => {
    if (!pending || subscription.status === 'active') return;
    const id = setInterval(() => onSubmitted(), 15000);
    return () => clearInterval(id);
  }, [pending, subscription.status, onSubmitted]);

  if (pending) {
    const activated = subscription.status === 'active';
    return (
      <View style={styles.pendingWrap}>
        <Text style={styles.pendingTick}>✓</Text>
        <Text style={styles.pendingTitle}>{activated ? "You're all set" : t('paymentPending')}</Text>
        <Text style={styles.pendingSub}>
          {activated
            ? 'Your subscription is now active. Thank you!'
            : "We'll confirm your payment and activate your account, usually within a few hours. Keep using FLOQ in the meantime — this updates on its own, no need to restart."}
        </Text>
        <TouchableOpacity
          style={[styles.refreshBtn, activated && styles.refreshBtnActive]}
          onPress={() => (activated ? (onClose ? onClose() : setPending(false)) : onSubmitted())}
        >
          <Text style={[styles.refreshText, activated && styles.refreshTextActive]}>
            {activated ? 'CONTINUE' : onClose ? 'DONE' : 'CHECK AGAIN'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.head}>
        {onClose ? <TouchableOpacity onPress={onClose}><Text style={styles.back}>← Back</Text></TouchableOpacity> : null}
        <Kicker>FLOQ {bi('subscribe').primary}</Kicker>
        <Text style={styles.headline}>{headline}</Text>
      </View>

      {/* Plan toggle */}
      <View style={styles.plans}>
        {(['monthly', 'annual'] as Plan[]).map((p) => {
          const active = plan === p;
          const price = p === 'annual' ? subscription.prices.annual : subscription.prices.monthly;
          return (
            <TouchableOpacity key={p} style={[styles.plan, active && styles.planActive]} onPress={() => setPlan(p)} activeOpacity={0.8}>
              <Text style={[styles.planName, active && styles.planTextActive]}>
                {p === 'annual' ? bi('annualPlan').primary : bi('monthlyPlan').primary}
              </Text>
              <Text style={[styles.planPrice, active && styles.planTextActive]}>{formatINR(price)}</Text>
              <Text style={[styles.planUnit, active && styles.planTextActive]}>
                {p === 'annual' ? t('perYear') : t('perMonth')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Pay via a UPI app on this phone */}
      <TouchableOpacity style={styles.payBtn} onPress={openUpiApp} activeOpacity={0.85} disabled={!subscription.collectionUpiId}>
        <Text style={styles.payBtnText}>PAY {formatINR(amount)} VIA UPI APP</Text>
        <Text style={styles.payBtnSub}>GPay · PhonePe · Paytm · any UPI app</Text>
      </TouchableOpacity>

      {/* Or scan from another phone */}
      <View style={styles.qrBlock}>
        <Text style={styles.scanLabel}>OR SCAN FROM ANOTHER PHONE</Text>
        <View style={{ marginVertical: spacing.md }}>
          <UpiQr upiId={subscription.collectionUpiId} name={subscription.collectionUpiName} amount={amount} note={`FLOQ ${plan}`} />
        </View>
        <Text style={styles.payee}>{subscription.collectionUpiId || '—'}</Text>
      </View>

      {/* Reference + confirm */}
      <View style={styles.refBlock}>
        <TextInput
          style={styles.input}
          value={ref}
          onChangeText={setRef}
          placeholder={t('enterUpiRef')}
          placeholderTextColor={palette.neutral[500]}
          autoCapitalize="characters"
        />
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <PrimaryBar label={busy ? '…' : bi('iHavePaid').primary} sub={bi('iHavePaid').secondary || undefined} disabled={busy} onPress={submit} />
      </View>
      <Text style={styles.note}>
        Pay the exact amount, then tap “{bi('iHavePaid').primary}”. We verify manually and activate your account, usually within a few hours.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  head: { padding: 16, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  back: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[700], marginBottom: 10 },
  headline: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, letterSpacing: -0.6, color: palette.ink, marginTop: 6 },
  plans: { flexDirection: 'row', gap: borders.rule, backgroundColor: palette.divider, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  plan: { flex: 1, backgroundColor: palette.bg, paddingVertical: 20, alignItems: 'center' },
  planActive: { backgroundColor: palette.ink },
  planName: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, letterSpacing: 1, color: palette.ink },
  planPrice: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 34, letterSpacing: -1, color: palette.ink, marginTop: 6 },
  planUnit: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[600] },
  planTextActive: { color: palette.onAccent },
  payBtn: { margin: 16, backgroundColor: palette.accent, paddingVertical: 18, alignItems: 'center' },
  payBtnText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, letterSpacing: 0.3, color: palette.onAccent },
  payBtnSub: { fontFamily: fonts.body, fontSize: 12, color: palette.onAccent, opacity: 0.85, marginTop: 3 },
  qrBlock: { alignItems: 'center', paddingVertical: 14 },
  scanLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 12, letterSpacing: 1, color: palette.neutral[700] },
  payee: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink, marginTop: 4 },
  amountLine: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 28, letterSpacing: -0.8, color: palette.accent, marginTop: 2 },
  refBlock: { paddingHorizontal: 16, paddingBottom: 12 },
  input: { borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.semibold, fontSize: 15, color: palette.ink, backgroundColor: palette.surface },
  note: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[600], paddingHorizontal: 16, paddingTop: 12, lineHeight: 18 },
  // pending
  pendingWrap: { flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 30 },
  pendingTick: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 64, color: palette.accent },
  pendingTitle: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.ink, textAlign: 'center', marginTop: 10 },
  pendingSub: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[700], textAlign: 'center', marginTop: 10, lineHeight: 20 },
  refreshBtn: { marginTop: 24, borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 28, paddingVertical: 14 },
  refreshText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, letterSpacing: 1, color: palette.ink },
  refreshBtnActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  refreshTextActive: { color: palette.onAccent },
});
