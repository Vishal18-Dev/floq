import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Order, OrderStatus } from '@floq/types';
import { formatINR, getElapsedMinutes } from '@floq/utils';
import { palette, fonts } from '../../theme';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/strings';
import { Icon } from '../common/Icon';

interface Props {
  orders: Order[];
  typicalPrepMinutes: number;
  onAdvance: (orderId: string, current: OrderStatus) => void;
}

const WAITING: OrderStatus[] = ['NEW', 'ACCEPTED'];

function actionFor(status: OrderStatus): StringKey {
  if (status === 'NEW') return 'accept';
  if (status === 'ACCEPTED') return 'startPreparing';
  if (status === 'PREPARING') return 'markReady';
  return 'handOver';
}

// Live queue — design 4b. One list: ready on top, then late, preparing, new.
// State is always a word plus a colour.
export const LiveQueueScreen: React.FC<Props> = ({ orders, typicalPrepMinutes, onAdvance }) => {
  const { bi, localFont } = useT();
  const [announce, setAnnounce] = useState<string | null>(null);
  const annT = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(annT.current), []);

  const startedAt = (o: Order) => o.preparingAt || o.acceptedAt || o.createdAt;
  const isLate = (o: Order) => o.status !== 'READY' && getElapsedMinutes(startedAt(o)) >= typicalPrepMinutes;
  const rank = (o: Order) => (o.status === 'READY' ? 0 : isLate(o) ? 1 : o.status === 'PREPARING' ? 2 : 3);
  const active = orders
    .filter((o) => ['NEW', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status))
    .sort((a, b) => rank(a) - rank(b) || a.ticketNumber.localeCompare(b.ticketNumber, undefined, { numeric: true }));

  const advance = (o: Order) => {
    if (o.status === 'PREPARING') {
      clearTimeout(annT.current);
      setAnnounce(`Token ${o.ticketNumber} is ready.`);
      annT.current = setTimeout(() => setAnnounce(null), 4000);
    }
    onAdvance(o.id, o.status);
  };

  // Batch: the item most waiting tokens share, if more than one needs it.
  const waiting = active.filter((o) => WAITING.includes(o.status));
  const tally: Record<string, { name: string; q: number; tokens: string[] }> = {};
  waiting.forEach((o) =>
    o.items.forEach((i) => {
      const key = i.productId || i.productNameSnapshot;
      const t = tally[key] || (tally[key] = { name: i.productNameSnapshot, q: 0, tokens: [] });
      t.q += i.quantity;
      if (!t.tokens.includes(o.ticketNumber)) t.tokens.push(o.ticketNumber);
    })
  );
  const bestKey = Object.keys(tally).filter((k) => tally[k].tokens.length > 1).sort((a, b) => tally[b].q - tally[a].q)[0];
  const best = bestKey ? tally[bestKey] : null;

  const readyN = active.filter((o) => o.status === 'READY').length;
  const lateN = active.filter(isLate).length;
  const summary = active.length === 0 ? 'Nothing waiting' : `${active.length} waiting · ${readyN} ready${lateN ? ` · ${lateN} running late` : ''}`;
  const local = bi('liveTokens').secondary;

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title}>Live queue</Text>
        {local ? <Text style={[styles.muted14, { fontFamily: localFont() }]}>{local}</Text> : null}
        <Text style={styles.summary}>{summary}</Text>
      </View>

      {announce ? (
        <View style={styles.announce} accessibilityLiveRegion="polite">
          <Icon name="volume-2" size={20} color={palette.highlight} />
          <Text style={styles.announceText}>{announce}</Text>
        </View>
      ) : null}

      {best ? (
        <TouchableOpacity
          style={styles.batch}
          onPress={() => waiting.filter((o) => o.items.some((i) => (i.productId || i.productNameSnapshot) === bestKey)).forEach((o) => onAdvance(o.id, o.status))}
        >
          <Icon name="sparkles" size={20} color={palette.link} />
          <View style={{ flex: 1 }}>
            <Text style={styles.batchTitle}>Make {best.q} {best.name.toLowerCase()} together</Text>
            <Text style={styles.muted14}>Tokens {best.tokens.join(', ')} all need it</Text>
          </View>
          <Text style={styles.batchCta}>Start all</Text>
        </TouchableOpacity>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        {active.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Queue is clear.</Text>
            <Text style={styles.summary}>New orders appear here.</Text>
          </View>
        ) : (
          active.map((o) => {
            const late = isLate(o);
            const ready = o.status === 'READY';
            const chip = late ? 'Running late' : ready ? 'Ready' : o.status === 'PREPARING' ? 'Preparing' : 'New';
            const chipStyle = late ? styles.chipLate : ready ? styles.chipReady : o.status === 'PREPARING' ? styles.chipPrep : styles.chipNew;
            const k = actionFor(o.status);
            return (
              <View key={o.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.token}>{o.ticketNumber}</Text>
                  <Text style={[styles.chip, chipStyle]}>{chip}</Text>
                  <View style={styles.time}>
                    <Icon name="clock" size={16} color={late ? palette.accentRamp[600] : palette.neutral[600]} />
                    <Text style={[styles.timeText, late && styles.timeLate]}>{getElapsedMinutes(startedAt(o))} min</Text>
                  </View>
                </View>
                <View style={styles.cardMid}>
                  <Text style={styles.items}>{o.items.map((i) => `${i.quantity} ${i.productNameSnapshot}`).join(', ')}</Text>
                  <Text style={styles.amount}>{formatINR(o.total)}{o.payMethod ? ` · ${o.payMethod === 'UPI' ? 'UPI' : 'Cash'}` : ''}</Text>
                </View>
                <TouchableOpacity style={[styles.btn, ready && styles.btnReady]} activeOpacity={0.85} onPress={() => advance(o)}>
                  <Text style={styles.btnText}>{bi(k).primary}</Text>
                  {bi(k).secondary ? <Text style={[styles.muted14, { color: palette.ink, fontFamily: localFont() }]}>{bi(k).secondary}</Text> : null}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  head: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, lineHeight: 34, color: palette.ink },
  summary: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600], marginTop: 6 },
  muted14: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  announce: { borderRadius: 14, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: palette.ink, flexDirection: 'row', alignItems: 'center', gap: 12 },
  announceText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.bg },
  batch: { borderRadius: 14, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: palette.card, borderWidth: 1.5, borderColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  batchTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: palette.ink },
  batchCta: { fontFamily: fonts.semibold, fontSize: 14, color: palette.link },
  list: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  empty: { paddingVertical: 40, paddingHorizontal: 8, gap: 4 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink },
  card: { borderRadius: 14, backgroundColor: palette.card, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  token: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, lineHeight: 34, color: palette.ink },
  chip: { fontFamily: fonts.semibold, fontSize: 14, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden', color: palette.ink },
  chipNew: { borderRadius: 8, borderWidth: 1.5, borderColor: palette.neutral[600], backgroundColor: palette.bg },
  chipPrep: { borderRadius: 8, backgroundColor: palette.surface },
  chipReady: { borderRadius: 8, backgroundColor: palette.highlight },
  chipLate: { backgroundColor: palette.accentRamp[100], color: palette.accentRamp[600] },
  time: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  timeLate: { fontFamily: fonts.heading, fontWeight: '800', color: palette.accentRamp[600] },
  cardMid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  items: { flex: 1, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: palette.ink },
  amount: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  btn: { borderRadius: 14, minHeight: 52, backgroundColor: palette.bg, justifyContent: 'center', paddingHorizontal: 16 },
  btnReady: { borderRadius: 14, backgroundColor: palette.highlight },
  btnText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },
});
