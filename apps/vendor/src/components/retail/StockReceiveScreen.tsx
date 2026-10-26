import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Product } from '@floq/types';
import { palette, fonts } from '../../theme';
import { api } from '../../services/api';
import { entries } from '../../services/retail';
import { useCatalogStore } from '../../store/useCatalogStore';

/** Manual stock-arrived flow: type what came in per SKU (the photograph-the-bill
 *  OCR version is a post-beta follow-up). */
export function StockReceiveScreen({ products, onBack, onDone }: { products: Product[]; onBack: () => void; onDone: () => void }) {
  const all = useMemo(() => entries(products), [products]);
  const applyReceipt = useCatalogStore((s) => s.applyStockReceipt);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const kept = all
    .map((e) => ({ e, n: Number(qty[e.key]) || 0 }))
    .filter((x) => x.n > 0);

  const submit = async () => {
    if (!kept.length || busy) return;
    setBusy(true);
    try {
      // Loose received in kg → grams; packs in units.
      const lines = kept.map(({ e, n }) =>
        e.loose ? { productId: e.product.id, qty: Math.round(n * 1000) } : { packId: e.key, qty: n }
      );
      await api.receiveStock(lines);
      applyReceipt(kept.map(({ e, n }) => ({ key: e.key, qty: e.loose ? Math.round(n * 1000) : n, loose: e.loose })));
      onDone();
    } catch (err: any) {
      Alert.alert('Could not add stock', err?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Stock</Text></TouchableOpacity>
      <Text style={styles.title}>Stock arrived</Text>
      <Text style={styles.sub}>Type how much came in. Leave the rest blank.</Text>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}>
        {all.map((e) => (
          <View key={e.key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{e.name}</Text>
              <Text style={styles.unit}>{e.loose ? 'add kg' : 'add units'}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={qty[e.key] || ''}
              onChangeText={(v) => setQty((q) => ({ ...q, [e.key]: v }))}
              placeholder="0"
              placeholderTextColor={palette.neutral[500]}
              keyboardType="numeric"
            />
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.addBtn, (!kept.length || busy) && styles.addBtnOff]} disabled={!kept.length || busy} onPress={submit} activeOpacity={0.85}>
          <Text style={[styles.addText, (!kept.length || busy) && styles.addTextOff]}>
            {busy ? '…' : kept.length ? `Add ${kept.length} ${kept.length === 1 ? 'line' : 'lines'} to stock` : 'Nothing to add'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  back: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingTop: 8 },
  backText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  title: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, color: palette.ink, paddingHorizontal: 16, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600], paddingHorizontal: 16, marginTop: 4 },
  row: { backgroundColor: palette.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  unit: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  input: { width: 88, minHeight: 48, backgroundColor: palette.bg, paddingHorizontal: 12, fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink, textAlign: 'center', borderWidth: 1, borderColor: palette.dividerFaint },
  footer: { padding: 16 },
  addBtn: { minHeight: 60, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  addBtnOff: { backgroundColor: palette.surface },
  addText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  addTextOff: { color: palette.neutral[600] },
});
