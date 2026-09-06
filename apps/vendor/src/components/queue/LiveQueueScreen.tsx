import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Order, OrderStatus } from '@floq/types';
import { formatINR, formatElapsedTime, getElapsedMinutes } from '@floq/utils';
import { palette, fonts, borders } from '../../theme';
import { useT } from '../../i18n';
import { Kicker, EmptyState } from '../common/ui';
import type { StringKey } from '../../i18n/strings';

interface Props {
  orders: Order[];
  typicalPrepMinutes: number;
  onAdvance: (orderId: string, current: OrderStatus) => void;
}

const LANES: { key: string; titleKey: StringKey; statuses: OrderStatus[] }[] = [
  { key: 'new', titleKey: 'laneNew', statuses: ['NEW', 'ACCEPTED'] },
  { key: 'prep', titleKey: 'lanePreparing', statuses: ['PREPARING'] },
  { key: 'ready', titleKey: 'laneReady', statuses: ['READY'] },
];

function actionFor(status: OrderStatus): { key: StringKey } {
  if (status === 'NEW') return { key: 'accept' };
  if (status === 'ACCEPTED') return { key: 'startPreparing' };
  if (status === 'PREPARING') return { key: 'markReady' };
  return { key: 'handOver' };
}

export const LiveQueueScreen: React.FC<Props> = ({ orders, typicalPrepMinutes, onAdvance }) => {
  const { bi, t } = useT();
  const active = orders.filter((o) => ['NEW', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status));

  const itemsText = (o: Order) => o.items.map((i) => `${i.quantity}× ${i.productNameSnapshot}`).join(', ');

  if (active.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Queue is clear" subtitle="New orders will appear here as you charge them." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen}>
      {LANES.map((lane) => {
        const laneOrders = active.filter((o) => lane.statuses.includes(o.status));
        return (
          <View key={lane.key} style={styles.lane}>
            <View style={styles.laneHead}>
              <Kicker>{bi(lane.titleKey).primary}{bi(lane.titleKey).secondary ? ` · ${bi(lane.titleKey).secondary}` : ''}</Kicker>
              <Text style={styles.laneCount}>{laneOrders.length}</Text>
            </View>
            {laneOrders.length === 0 ? (
              <Text style={styles.laneEmpty}>—</Text>
            ) : (
              laneOrders.map((o) => {
                const mins = getElapsedMinutes(o.preparingAt || o.acceptedAt || o.createdAt);
                const late = mins >= typicalPrepMinutes && o.status !== 'READY';
                const action = actionFor(o.status);
                return (
                  <View key={o.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.token}>{o.ticketNumber}</Text>
                      <Text style={[styles.elapsed, late && styles.elapsedLate]}>{formatElapsedTime(o.preparingAt || o.acceptedAt || o.createdAt)}</Text>
                      <Text style={styles.amount}>{formatINR(o.total)}</Text>
                    </View>
                    <Text style={styles.items} numberOfLines={2}>{itemsText(o)}</Text>
                    {late ? (
                      <Text style={styles.late}>{bi('runningLate').primary}{bi('runningLate').secondary ? ` · ${bi('runningLate').secondary}` : ''}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.advanceBtn, o.status === 'READY' && styles.advanceReady]}
                      activeOpacity={0.85}
                      onPress={() => onAdvance(o.id, o.status)}
                    >
                      <Text style={[styles.advanceText, o.status === 'READY' && styles.advanceTextReady]}>{bi(action.key).primary}</Text>
                      {bi(action.key).secondary ? <Text style={[styles.advanceSub, o.status === 'READY' && styles.advanceTextReady]}>{bi(action.key).secondary}</Text> : null}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  lane: { borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  laneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: borders.hair, borderBottomColor: palette.dividerFaint },
  laneCount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 14, color: palette.neutral[700] },
  laneEmpty: { paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: palette.neutral[500] },
  card: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: borders.hair, borderBottomColor: palette.dividerFaint, gap: 9 },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  token: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 34, letterSpacing: -1.5, color: palette.ink, lineHeight: 34 },
  elapsed: { fontFamily: fonts.semibold, fontSize: 13, color: palette.neutral[700] },
  elapsedLate: { color: palette.accent },
  amount: { marginLeft: 'auto', fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, color: palette.neutral[700] },
  items: { fontFamily: fonts.body, fontSize: 14, color: palette.ink },
  late: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 11, letterSpacing: 0.5, color: palette.accentRamp[700] },
  advanceBtn: { borderWidth: borders.rule, borderColor: palette.divider, paddingVertical: 12, alignItems: 'center' },
  advanceReady: { backgroundColor: palette.accent, borderColor: palette.accent },
  advanceText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 17, letterSpacing: 0.5, color: palette.ink },
  advanceSub: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[700] },
  advanceTextReady: { color: palette.onAccent },
});
