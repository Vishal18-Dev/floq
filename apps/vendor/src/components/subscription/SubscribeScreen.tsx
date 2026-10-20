import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { formatINR } from '@floq/utils';
import { palette, fonts, borders, spacing } from '../../theme';
import { api, SubscriptionStatus } from '../../services/api';
import { useT } from '../../i18n';
import { Kicker, PrimaryBar } from '../common/ui';
import { UpiQr } from '../sell/UpiQr';

type Plan = 'monthly' | 'annual';

export function SubscribeScreen({
  subscription,
  onSubmitted,
}: {
  subscription: SubscriptionStatus;
  onSubmitted: () => void;
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
      : `${subscription.daysLeft} ${t('trialDaysLeft')}`;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.submitSubscriptionPayment(plan, ref.trim() || undefined);
      setPending(true);
      onSubmitted();
    } catch (e: any) {
      alert(e?.message || 'Could not submit. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <View style={styles.pendingWrap}>
        <Text style={styles.pendingTick}>✓</Text>
        <Text style={styles.pendingTitle}>{t('paymentPending')}</Text>
        <Text style={styles.pendingSub}>
          FLOQ will verify your payment and activate your account shortly. You can close and reopen the app to check.
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onSubmitted}>
          <Text style={styles.refreshText}>REFRESH</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.head}>
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

      {/* Pay-to QR */}
      <View style={styles.qrBlock}>
        <Text style={styles.scanLabel}>{bi('scanToPay').primary}{bi('scanToPay').secondary ? ` · ${bi('scanToPay').secondary}` : ''}</Text>
        <View style={{ marginVertical: spacing.md }}>
          <UpiQr upiId={subscription.collectionUpiId} name={subscription.collectionUpiName} amount={amount} note={`FLOQ ${plan}`} />
        </View>
        <Text style={styles.payee}>{subscription.collectionUpiId || '—'}</Text>
        <Text style={styles.amountLine}>{formatINR(amount)}</Text>
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
  headline: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, letterSpacing: -0.6, color: palette.ink, marginTop: 6 },
  plans: { flexDirection: 'row', gap: borders.rule, backgroundColor: palette.divider, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  plan: { flex: 1, backgroundColor: palette.bg, paddingVertical: 20, alignItems: 'center' },
  planActive: { backgroundColor: palette.ink },
  planName: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, letterSpacing: 1, color: palette.ink },
  planPrice: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 34, letterSpacing: -1, color: palette.ink, marginTop: 6 },
  planUnit: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[600] },
  planTextActive: { color: palette.onAccent },
  qrBlock: { alignItems: 'center', paddingVertical: 22 },
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
});
