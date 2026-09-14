import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DailySalesSummary } from '@floq/types';
import { formatINR } from '@floq/utils';
import { palette, fonts, borders } from '../../theme';
import { useT } from '../../i18n';
import { Kicker, PrimaryBar, EmptyState } from '../common/ui';
import { HistoryModal } from './HistoryModal';

interface Props {
  dailySummary: DailySalesSummary | null;
  onCloseDay: () => Promise<void>;
  onManageItems: () => void;
}

export const DayScreen: React.FC<Props> = ({ dailySummary, onCloseDay, onManageItems }) => {
  const { t, bi } = useT();
  const [closing, setClosing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const revenue = dailySummary?.revenue ?? 0;
  const orders = dailySummary?.orders ?? 0;
  const cash = dailySummary?.cashRevenue ?? 0;
  const upi = dailySummary?.upiRevenue ?? 0;
  const top = dailySummary?.topProducts ?? [];
  const maxQty = top.reduce((m, p) => Math.max(m, p.quantity), 0) || 1;

  const confirmClose = () => {
    Alert.alert(
      'Close the day?',
      'This records today’s totals. Any open tokens carry over to tomorrow. You can keep selling after.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close day',
          style: 'destructive',
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
      ]
    );
  };

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.hero}>
        <Kicker>{bi('todaysSales').primary}{bi('todaysSales').secondary ? ` · ${bi('todaysSales').secondary}` : ''}</Kicker>
        <Text style={styles.revenue}>{formatINR(revenue)}</Text>
        <Text style={styles.orders}>{orders} {t('orders')}</Text>
      </View>

      <View style={styles.split}>
        <View style={styles.splitCell}>
          <Kicker>{bi('cash').primary}{bi('cash').secondary ? ` · ${bi('cash').secondary}` : ''}</Kicker>
          <Text style={styles.splitAmt}>{formatINR(cash)}</Text>
        </View>
        <View style={styles.splitCell}>
          <Kicker>{bi('upi').primary}</Kicker>
          <Text style={styles.splitAmt}>{formatINR(upi)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Kicker>{bi('topItems').primary}</Kicker>
      </View>
      {top.length === 0 ? (
        <EmptyState title={t('noSalesYet')} subtitle={t('firstOrderHint')} />
      ) : (
        top.map((p) => (
          <View key={p.productId + p.name} style={styles.topRow}>
            <Text style={styles.topQty}>{p.quantity}</Text>
            <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.round((p.quantity / maxQty) * 100)}%` }]} /></View>
            <Text style={styles.topAmt}>{formatINR(p.revenue)}</Text>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.manage} onPress={onManageItems} activeOpacity={0.7}>
        <Text style={styles.manageText}>MANAGE ITEMS & PRICES →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.manage} onPress={() => setHistoryOpen(true)} activeOpacity={0.7}>
        <Text style={styles.manageText}>{bi('viewHistory').primary}{bi('viewHistory').secondary ? ` · ${bi('viewHistory').secondary}` : ''} →</Text>
      </TouchableOpacity>

      <View style={{ padding: 16 }}>
        <PrimaryBar
          tone="outline"
          minHeight={64}
          label={closing ? '…' : bi('closeTheDay').primary}
          sub={bi('closeTheDay').secondary || undefined}
          disabled={closing}
          onPress={confirmClose}
        />
      </View>

      <HistoryModal visible={historyOpen} onClose={() => setHistoryOpen(false)} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  hero: { padding: 16, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  revenue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 52, letterSpacing: -2.5, color: palette.ink, marginTop: 4, lineHeight: 56 },
  orders: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[700] },
  split: { flexDirection: 'row', gap: borders.rule, backgroundColor: palette.divider, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  splitCell: { flex: 1, backgroundColor: palette.bg, padding: 14 },
  splitAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, letterSpacing: -0.6, color: palette.ink, marginTop: 4 },
  section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: borders.hair, borderBottomColor: palette.dividerFaint },
  topQty: { width: 34, fontFamily: fonts.heading, fontWeight: '800', fontSize: 17, color: palette.ink },
  topName: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: palette.ink },
  barTrack: { width: 60, height: 8, backgroundColor: palette.neutral[200] },
  barFill: { height: 8, backgroundColor: palette.accent },
  topAmt: { width: 70, textAlign: 'right', fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, color: palette.ink },
  manage: { margin: 16, borderWidth: borders.rule, borderColor: palette.divider, paddingVertical: 16, alignItems: 'center' },
  manageText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, letterSpacing: 0.5, color: palette.ink },
});
