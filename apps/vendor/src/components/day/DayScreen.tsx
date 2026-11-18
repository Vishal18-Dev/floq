import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DailySalesSummary } from '@floq/types';
import { formatINR } from '@floq/utils';
import { palette, fonts } from '../../theme';
import { useT } from '../../i18n';
import { HistoryModal } from './HistoryModal';

interface Props {
  dailySummary: DailySalesSummary | null;
  onCloseDay: () => Promise<void>;
  onManageItems: () => void;
}

// Day — design 4c. Real totals only: cash/UPI split and best sellers.
export const DayScreen: React.FC<Props> = ({ dailySummary, onCloseDay, onManageItems }) => {
  const { t, bi, localFont } = useT();
  const [closing, setClosing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const revenue = dailySummary?.revenue ?? 0;
  const orders = dailySummary?.orders ?? 0;
  const top = (dailySummary?.topProducts ?? []).slice(0, 5);
  const maxQty = top.reduce((m, p) => Math.max(m, p.quantity), 0) || 1;
  const localSales = bi('todaysSales').secondary;
  const localClose = bi('closeTheDay').secondary;

  const confirmClose = () => {
    Alert.alert('Close the day?', 'This records today’s totals. Any open tokens carry over to tomorrow. You can keep selling after.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close day',
        onPress: async () => {
          setClosing(true);
          try {
            await onCloseDay();
            Alert.alert('Day closed', 'Today’s totals are saved.');
          } catch (e: any) {
            Alert.alert('Could not close', e?.message || 'Try again.');
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View>
          <Text style={styles.label16}>
            {bi('todaysSales').primary}
            {localSales ? <Text style={{ fontFamily: localFont() }}> · {localSales}</Text> : null}
          </Text>
          <Text style={styles.revenue}>{formatINR(revenue)}</Text>
          <Text style={styles.muted16}>{orders} {t('orders')}</Text>
        </View>

        <View style={styles.split}>
          <View style={styles.splitCard}>
            <Text style={styles.label14}>{bi('cash').primary}</Text>
            <Text style={styles.splitAmt}>{formatINR(dailySummary?.cashRevenue ?? 0)}</Text>
          </View>
          <View style={styles.splitCard}>
            <Text style={styles.label14}>{bi('upi').primary}</Text>
            <Text style={styles.splitAmt}>{formatINR(dailySummary?.upiRevenue ?? 0)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Best sellers</Text>
          {top.length === 0 ? (
            <Text style={styles.muted16}>{t('noSalesYet')}. {t('firstOrderHint')}</Text>
          ) : (
            top.map((p) => (
              <View key={p.productId + p.name} style={{ gap: 4 }}>
                <View style={styles.topRow}>
                  <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.topName}>
                    <Text style={{ fontFamily: fonts.semibold }}>{p.quantity}</Text>
                    <Text style={{ color: palette.neutral[600] }}> · {formatINR(p.revenue)}</Text>
                  </Text>
                </View>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.round((p.quantity / maxQty) * 100)}%` }]} /></View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.linkRow} onPress={onManageItems}>
            <Text style={styles.linkText}>Menu and prices</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkRow, styles.rule]} onPress={() => setHistoryOpen(true)}>
            <Text style={styles.linkText}>{bi('viewHistory').primary}</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <TouchableOpacity style={[styles.closeBtn, closing && { opacity: 0.5 }]} disabled={closing} onPress={confirmClose}>
          <Text style={styles.closeLabel}>{closing ? '…' : bi('closeTheDay').primary}</Text>
          {localClose ? <Text style={[styles.closeSub, { fontFamily: localFont() }]}>{localClose}</Text> : null}
        </TouchableOpacity>
      </View>

      <HistoryModal visible={historyOpen} onClose={() => setHistoryOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 },
  label16: { fontFamily: fonts.semibold, fontSize: 16, color: palette.neutral[600] },
  label14: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[600] },
  muted16: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  revenue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 44, lineHeight: 48, marginTop: 4, color: palette.ink },
  split: { flexDirection: 'row', gap: 8 },
  splitCard: { borderRadius: 14, flex: 1, backgroundColor: palette.card, padding: 14, gap: 2 },
  splitAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.ink },
  card: { borderRadius: 14, backgroundColor: palette.card, padding: 14, gap: 10 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, color: palette.ink },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  topName: { fontFamily: fonts.body, fontSize: 16, color: palette.ink, flexShrink: 1 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: palette.bg },
  barFill: { height: 8, borderRadius: 4, backgroundColor: palette.highlight },
  linkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rule: { borderTopWidth: 1, borderTopColor: palette.surface },
  linkText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  chev: { fontFamily: fonts.semibold, fontSize: 22, color: palette.neutral[600] },
  closeBtn: { borderRadius: 14, minHeight: 60, backgroundColor: palette.highlight, justifyContent: 'center', paddingHorizontal: 18 },
  closeLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, lineHeight: 24, color: palette.onHighlight },
  closeSub: { fontSize: 14, color: palette.onHighlight },
});
