import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Product, Category } from '@floq/types';
import { palette, fonts } from '../../theme';
import { entries, daysLeft, reorderSuggest, fmtG, Entry } from '../../services/retail';
import { NewProductScreen } from './NewProductScreen';
import { StockReceiveScreen } from './StockReceiveScreen';

const LOW_DAYS = 5;

type View_ = 'list' | 'receive' | 'newproduct';

export function StockScreen({
  products,
  categories,
  onReload,
}: {
  products: Product[];
  categories: Category[];
  /** Refresh the catalogue after a product add / stock receipt. */
  onReload: () => void;
}) {
  const [view, setView] = useState<View_>('list');
  const all = useMemo(() => entries(products), [products]);
  const [off, setOff] = useState<Record<string, boolean>>({}); // unticked low items

  if (view === 'receive') {
    return <StockReceiveScreen products={products} onBack={() => setView('list')} onDone={() => { onReload(); setView('list'); }} />;
  }
  if (view === 'newproduct') {
    return <NewProductScreen categories={categories} onBack={() => setView('list')} onSaved={() => { onReload(); setView('list'); }} />;
  }

  const supplierFor = (e: Entry) => categories.find((c) => c.id === e.product.categoryId)?.supplier || 'your supplier';

  const low = all.filter((e) => daysLeft(e) <= LOW_DAYS).sort((a, b) => daysLeft(a) - daysLeft(b));
  const ok = all.filter((e) => daysLeft(e) > LOW_DAYS);
  const selected = low.filter((e) => !off[e.key]);
  const suppliers = Array.from(new Set(selected.map(supplierFor)));

  const placeOrder = async () => {
    if (!selected.length) return;
    const lines = selected
      .map((e) => {
        const s = reorderSuggest(e);
        return `• ${e.name} — ${s.n} ${s.unit}${s.n > 1 ? 's' : ''}`;
      })
      .join('\n');
    const text = encodeURIComponent(`Order from floq:\n${lines}`);
    try {
      await Linking.openURL(`whatsapp://send?text=${text}`);
    } catch {
      Alert.alert('WhatsApp not available', 'Install WhatsApp to send reorders, or call your supplier.');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Stock</Text>
        <Text style={styles.summary}>
          {low.length ? `${low.length} running low` : 'Nothing running low'} · {all.length} products
        </Text>
        <View style={styles.headBtns}>
          <TouchableOpacity style={styles.headBtn} onPress={() => setView('receive')}>
            <Text style={styles.headBtnText}>Stock arrived</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headBtn} onPress={() => setView('newproduct')}>
            <Text style={styles.headBtnText}>+ New product</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}>
        {low.length > 0 ? (
          <>
            <Text style={styles.section}>Running low · tick what to reorder</Text>
            {low.map((e) => {
              const on = !off[e.key];
              const s = reorderSuggest(e);
              const d = daysLeft(e);
              return (
                <TouchableOpacity
                  key={e.key}
                  style={styles.lowRow}
                  activeOpacity={0.7}
                  onPress={() => setOff((o) => ({ ...o, [e.key]: !o[e.key] }))}
                >
                  <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.boxTick}>✓</Text> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lowName}>{e.name}</Text>
                    <Text style={styles.lowSuggest}>
                      Order {s.n} {s.unit}{s.n > 1 ? 's' : ''} · {supplierFor(e)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.lowLeft}>{e.loose ? fmtG(e.stock) : `${e.stock} left`}</Text>
                    <Text style={styles.daysChip}>{d <= 0 ? 'Out today' : `About ${d} ${d === 1 ? 'day' : 'days'}`}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        <Text style={[styles.section, { paddingTop: 8 }]}>Enough for now</Text>
        <View style={styles.okCard}>
          {ok.map((e) => (
            <View key={e.key} style={styles.okRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.okName}>{e.name}</Text>
                {e.pack?.expiryNote ? <Text style={styles.expChip}>{e.pack.expiryNote}</Text> : null}
              </View>
              <Text style={styles.okLeft}>{e.loose ? fmtG(e.stock) : String(e.stock)}</Text>
              <Text style={styles.okDays}>{daysLeft(e) >= 999 ? '—' : `${daysLeft(e)} days`}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.foot}>Days left are estimated from recent sales.</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.orderBtn, !selected.length && styles.orderBtnOff]}
          disabled={!selected.length}
          activeOpacity={0.85}
          onPress={placeOrder}
        >
          <Text style={[styles.orderLabel, !selected.length && styles.orderLabelOff]}>
            {selected.length ? `Order ${selected.length} ${selected.length === 1 ? 'item' : 'items'}` : 'Nothing to order'}
          </Text>
          <Text style={[styles.orderSub, !selected.length && styles.orderLabelOff]}>
            {selected.length ? `WhatsApp to ${suppliers.join(', ')}` : 'Tick items above to reorder'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  head: { padding: 16, gap: 10 },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, color: palette.ink, letterSpacing: -0.5 },
  summary: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  headBtns: { flexDirection: 'row', gap: 8 },
  headBtn: { flex: 1, minHeight: 48, backgroundColor: palette.card, borderWidth: 1.5, borderColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  headBtnText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  section: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[600] },
  lowRow: { backgroundColor: palette.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 32, height: 32, borderWidth: 1.5, borderColor: palette.neutral[600], alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: palette.highlight, borderColor: palette.highlight },
  boxTick: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.onHighlight },
  lowName: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  lowSuggest: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  lowLeft: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, color: palette.ink },
  daysChip: { fontFamily: fonts.semibold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: palette.accentRamp[100], color: palette.accentRamp[600], overflow: 'hidden' },
  okCard: { backgroundColor: palette.card, paddingHorizontal: 14 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderBottomWidth: 1, borderBottomColor: palette.surface },
  okName: { fontFamily: fonts.body, fontSize: 16, color: palette.ink },
  expChip: { alignSelf: 'flex-start', fontFamily: fonts.semibold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2, backgroundColor: palette.accentRamp[100], color: palette.accentRamp[600], overflow: 'hidden' },
  okLeft: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  okDays: { width: 64, textAlign: 'right', fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  foot: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[600], paddingTop: 4 },
  footer: { padding: 16, backgroundColor: palette.card, borderTopWidth: 1, borderTopColor: palette.surface },
  orderBtn: { minHeight: 64, backgroundColor: palette.highlight, justifyContent: 'center', paddingHorizontal: 18 },
  orderBtnOff: { backgroundColor: palette.surface },
  orderLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  orderLabelOff: { color: palette.neutral[600] },
  orderSub: { fontFamily: fonts.body, fontSize: 14, color: palette.onHighlight },
});
