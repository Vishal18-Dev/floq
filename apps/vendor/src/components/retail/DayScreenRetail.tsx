import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { DailySalesSummary, Product, CreditCustomer } from '@floq/types';
import { palette, fonts } from '../../theme';
import { HeroCard } from '../common/ui';
import { INR, entries, daysLeft, isOverdue, customerDays, retailPrefs } from '../../services/retail';

export function DayScreenRetail({
  summary,
  products,
  customers,
  onCloseDay,
}: {
  summary: DailySalesSummary | null;
  products: Product[];
  customers: CreditCustomer[];
  onCloseDay: () => void;
}) {
  const revenue = summary?.revenue || 0;
  const bills = summary?.orders || 0;
  const profit = summary?.grossProfit || 0;
  const collected = summary?.duesCollected || 0;
  const splits = [
    { label: 'Cash', value: summary?.cashRevenue || 0 },
    { label: 'UPI', value: summary?.upiRevenue || 0 },
    { label: 'On credit', value: summary?.creditRevenue || 0 },
  ];
  const top = summary?.topProducts || [];
  const maxRev = Math.max(1, ...top.map((t) => t.revenue));

  const { lowDays: LOW_DAYS, termDays } = retailPrefs();
  // Insights, computed client-side from live stock and the credit book.
  const low = entries(products)
    .filter((e) => daysLeft(e) <= LOW_DAYS)
    .sort((a, b) => daysLeft(a) - daysLeft(b));
  const overdue = customers.filter(isOverdue).sort((a, b) => b.owes - a.owes);
  const insights: string[] = [];
  if (low[0]) {
    insights.push(
      `${low[0].name} has about ${Math.max(0, daysLeft(low[0]))} days left at this pace.${
        low.length > 1 ? ` ${low.length - 1} more items are close.` : ''
      } Reorder today.`
    );
  }
  if (overdue.length) {
    insights.push(
      `${INR(overdue.reduce((s, c) => s + c.owes, 0))} has been owed for over ${termDays} days by ${overdue
        .map((c) => c.name)
        .join(' and ')}. A reminder in the morning gets paid fastest.`
    );
  }
  if (!insights.length) insights.push(`Stock and dues look fine for the next ${LOW_DAYS} days.`);

  const confirmClose = () =>
    Alert.alert('Close the day?', 'This snapshots today’s totals. You can still see them in history.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Close the day', onPress: onCloseDay },
    ]);

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <HeroCard>
          <View>
            <Text style={styles.label}>Today's sales</Text>
            <Text style={styles.total}>{INR(revenue)}</Text>
            <View style={styles.subRow}>
              <Text style={styles.sub}>{bills} {bills === 1 ? 'bill' : 'bills'}</Text>
              <Text style={styles.profitChip}>profit {INR(profit)}</Text>
            </View>
          </View>
          <View style={styles.splitRow}>
            {splits.map((s) => (
              <View key={s.label} style={styles.splitCard}>
                <Text style={styles.splitLabel}>{s.label}</Text>
                <Text style={styles.splitValue}>{INR(s.value)}</Text>
              </View>
            ))}
          </View>
        </HeroCard>

        <View style={styles.collectedCard}>
          <Text style={styles.collectedLabel}>Dues collected today</Text>
          <Text style={styles.collectedValue}>{INR(collected)}</Text>
        </View>

        {top.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Best sellers</Text>
            {top.map((t) => (
              <View key={t.productId + t.name} style={{ gap: 4 }}>
                <View style={styles.bestRow}>
                  <Text style={styles.bestName} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.bestAmt}>{INR(t.revenue)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round((t.revenue / maxRev) * 100)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.insightCard}>
          <Text style={styles.insightKicker}>Before tomorrow</Text>
          {insights.map((text, i) => (
            <Text key={i} style={[styles.insightText, i > 0 && styles.insightBorder]}>{text}</Text>
          ))}
          <Text style={styles.insightFoot}>Based on your recent sales and dues.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.closeBtn} onPress={confirmClose} activeOpacity={0.85}>
          <Text style={styles.closeText}>Close the day</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: '#D9CCB0' },
  total: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 46, lineHeight: 52, color: palette.bg, letterSpacing: -1, marginTop: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: '#D9CCB0' },
  profitChip: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.ink, backgroundColor: palette.highlight, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 2 },
  splitRow: { flexDirection: 'row', gap: 8 },
  splitCard: { borderRadius: 14, flex: 1, backgroundColor: 'rgba(255,246,227,0.08)', borderWidth: 1, borderColor: 'rgba(255,246,227,0.12)', paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  splitLabel: { fontFamily: fonts.semibold, fontSize: 13, color: '#D9CCB0' },
  splitValue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, color: palette.bg },
  collectedCard: { borderRadius: 14, backgroundColor: palette.successBg, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collectedLabel: { fontFamily: fonts.semibold, fontSize: 16, color: palette.success },
  collectedValue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.success },
  card: { borderRadius: 14, backgroundColor: palette.card, padding: 14, gap: 10 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink },
  bestRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  bestName: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: palette.ink },
  bestAmt: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  barTrack: { height: 8, backgroundColor: palette.bg },
  barFill: { height: 8, backgroundColor: palette.highlight },
  insightCard: { borderRadius: 14, backgroundColor: palette.ink, padding: 16, gap: 8 },
  insightKicker: { fontFamily: fonts.semibold, fontSize: 16, color: palette.highlight },
  insightText: { fontFamily: fonts.body, fontSize: 16, color: palette.bg, lineHeight: 22, paddingTop: 8 },
  insightBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,246,227,0.16)' },
  insightFoot: { fontFamily: fonts.body, fontSize: 14, color: palette.surface },
  footer: { padding: 16 },
  closeBtn: { borderRadius: 14, minHeight: 60, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
});
