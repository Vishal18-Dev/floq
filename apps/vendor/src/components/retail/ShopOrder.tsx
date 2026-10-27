import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Product, CreditCustomer, Order } from '@floq/types';
import { palette, fonts } from '../../theme';
import { INR, entries, cartLines, cartTotal, Cart, RetailCharge } from '../../services/retail';

// ponytail: fixed 15-day wholesale credit term for the beta; make it a store
// setting if merchants want 7/15/30 like the design's enum.
const CREDIT_DAYS = 15;

type Terms = 'now' | 'credit';

export function ShopOrder({
  products,
  customers,
  onCharge,
}: {
  products: Product[];
  customers: CreditCustomer[];
  onCharge: (charge: RetailCharge) => Promise<Order>;
}) {
  const shops = useMemo(() => customers.filter((c) => c.kind === 'SHOP'), [customers]);
  const packEntries = useMemo(() => entries(products).filter((e) => !e.loose), [products]);

  const [custId, setCustId] = useState<string | null>(shops[0]?.id ?? null);
  const [picker, setPicker] = useState(false);
  const [cases, setCases] = useState<Record<string, number>>({}); // packKey -> cases
  const [terms, setTerms] = useState<Terms>('credit');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ invoice: string; cust: string; total: number; credit: boolean } | null>(null);

  const cust = shops.find((c) => c.id === custId) || null;

  // Units cart = cases × caseQty, priced at wholesale.
  const unitsCart: Cart = {};
  for (const e of packEntries) {
    const cs = cases[e.key] || 0;
    if (cs > 0) unitsCart[e.key] = cs * (e.pack?.caseQty || 1);
  }
  const lines = cartLines(products, unitsCart, true);
  const total = cartTotal(lines);
  const live = total > 0;

  const newOwes = (cust?.owes || 0) + (terms === 'credit' ? total : 0);
  const over = cust ? newOwes - cust.creditLimit : 0;

  const setCase = (key: string, n: number) => setCases((c) => ({ ...c, [key]: Math.max(0, n) }));

  const send = async () => {
    if (!live || !cust || busy) return;
    setBusy(true);
    try {
      const items = packEntries
        .filter((e) => (cases[e.key] || 0) > 0)
        .map((e) => ({
          key: e.key,
          packId: e.key,
          productId: e.product.id,
          sellUnit: 'UNIT' as const,
          quantity: (cases[e.key] || 0) * (e.pack?.caseQty || 1),
          loose: false,
        }));
      const charge: RetailCharge = {
        items,
        method: terms === 'credit' ? 'CREDIT' : 'UPI',
        creditCustomerId: terms === 'credit' ? cust.id : undefined,
        isWholesale: true,
      };
      const order = await onCharge(charge);
      setDone({ invoice: order.invoiceNumber || '—', cust: cust.name, total, credit: terms === 'credit' });
      setCases({});
    } catch (e: any) {
      alert(e?.message || 'Could not send the invoice');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <TouchableOpacity style={styles.doneWrap} activeOpacity={1} onPress={() => setDone(null)}>
        <Text style={styles.doneTag}>Invoice {done.invoice}</Text>
        <View style={{ marginTop: 'auto', gap: 8 }}>
          <Text style={styles.doneCust}>{done.cust}</Text>
          <Text style={styles.doneTotal}>{INR(done.total)}</Text>
          <Text style={styles.doneNote}>
            {done.credit
              ? `Sent on WhatsApp. Due in ${CREDIT_DAYS} days — floq will remind them.`
              : 'Sent on WhatsApp. Marked paid.'}
          </Text>
          <Text style={styles.doneNote}>Stock is already reduced.</Text>
        </View>
        <Text style={styles.doneTap}>Tap to start another shop order</Text>
      </TouchableOpacity>
    );
  }

  if (shops.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No shops yet</Text>
        <Text style={styles.emptySub}>Add a shop account from the Dues tab, then sell to it by the case here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Customer */}
      <TouchableOpacity style={styles.custBar} onPress={() => setPicker(true)} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.custName}>{cust?.name || 'Pick a shop'}</Text>
          {cust ? <Text style={styles.custLine}>Owes {INR(cust.owes)} · limit {INR(cust.creditLimit)}</Text> : null}
        </View>
        <Text style={styles.custChange}>Change</Text>
      </TouchableOpacity>

      {/* Wholesale rows */}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}>
        {packEntries.map((e) => {
          const cs = cases[e.key] || 0;
          const units = cs * (e.pack?.caseQty || 1);
          const short = units > e.stock;
          return (
            <View key={e.key} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName}>{e.name}</Text>
                <Text style={styles.rowTerms}>Case of {e.pack?.caseQty ?? 1} · {INR(e.pack?.wholesalePrice ?? e.pack?.price ?? 0)} each</Text>
                {cs > 0 ? <Text style={styles.rowAmount}>{units} units · {INR(units * (e.pack?.wholesalePrice ?? e.pack?.price ?? 0))}</Text> : null}
                {short ? <Text style={styles.shortChip}>Only {e.stock} in stock</Text> : null}
              </View>
              <TouchableOpacity style={styles.stepDown} onPress={() => setCase(e.key, cs - 1)}><Text style={styles.stepGlyph}>–</Text></TouchableOpacity>
              <View style={{ width: 44, alignItems: 'center' }}>
                <Text style={styles.caseN}>{cs}</Text>
                <Text style={styles.caseLabel}>cases</Text>
              </View>
              <TouchableOpacity style={styles.stepUp} onPress={() => setCase(e.key, cs + 1)}><Text style={styles.stepGlyph}>+</Text></TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Terms + send */}
      <View style={styles.footer}>
        <View style={styles.termsToggle}>
          {(['now', 'credit'] as Terms[]).map((tm) => {
            const on = terms === tm;
            return (
              <TouchableOpacity key={tm} style={[styles.termSeg, on && styles.termSegOn]} onPress={() => setTerms(tm)}>
                <Text style={[styles.termText, on && styles.termTextOn]}>{tm === 'now' ? 'Paid now' : `${CREDIT_DAYS} days credit`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.creditLine, over > 0 && terms === 'credit' && live && styles.creditLineWarn]}>
          {!live
            ? 'Add cases to build the order.'
            : terms === 'now'
            ? 'Paid now — nothing added to their dues.'
            : over > 0
            ? `Over their credit limit by ${INR(over)}. Ask for part payment first.`
            : `After this order they owe ${INR(newOwes)} of ${INR(cust?.creditLimit || 0)}.`}
        </Text>
        <TouchableOpacity style={[styles.sendBtn, (!live || busy) && styles.sendBtnOff]} disabled={!live || busy} onPress={send} activeOpacity={0.85}>
          <Text style={[styles.sendLabel, (!live || busy) && styles.sendLabelOff]}>{busy ? '…' : 'Send invoice'}</Text>
          <Text style={[styles.sendTotal, (!live || busy) && styles.sendLabelOff]}>{INR(total)}</Text>
        </TouchableOpacity>
      </View>

      {picker ? (
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPicker(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Which shop?</Text>
            {shops.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.pickRow, s.id === custId && styles.pickRowOn]}
                onPress={() => { setCustId(s.id); setPicker(false); setCases({}); }}
              >
                <Text style={styles.pickName}>{s.name}</Text>
                <Text style={styles.pickOwes}>Owes {INR(s.owes)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  custBar: { backgroundColor: palette.card, margin: 12, marginBottom: 0, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  custName: { fontFamily: fonts.semibold, fontSize: 18, color: palette.ink },
  custLine: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  custChange: { fontFamily: fonts.semibold, fontSize: 14, color: palette.link },
  row: { backgroundColor: palette.card, padding: 12, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  rowTerms: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  rowAmount: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink, marginTop: 2 },
  shortChip: { alignSelf: 'flex-start', marginTop: 4, fontFamily: fonts.semibold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: palette.accentRamp[100], color: palette.accentRamp[600], overflow: 'hidden' },
  stepDown: { width: 44, height: 44, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.dividerFaint },
  stepUp: { width: 44, height: 44, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.dividerFaint },
  stepGlyph: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.ink },
  caseN: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink },
  caseLabel: { fontFamily: fonts.body, fontSize: 12, color: palette.neutral[600] },
  footer: { backgroundColor: palette.card, borderTopWidth: 1, borderTopColor: palette.surface, padding: 16, gap: 10 },
  termsToggle: { flexDirection: 'row', backgroundColor: palette.bg, padding: 4, gap: 4 },
  termSeg: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  termSegOn: { backgroundColor: palette.card },
  termText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  termTextOn: { fontFamily: fonts.heading, fontWeight: '800' },
  creditLine: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600], lineHeight: 18 },
  creditLineWarn: { color: palette.accentRamp[600], fontFamily: fonts.semibold },
  sendBtn: { minHeight: 64, backgroundColor: palette.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  sendBtnOff: { backgroundColor: palette.surface },
  sendLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  sendLabelOff: { color: palette.neutral[600] },
  sendTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.onHighlight },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(28,27,26,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.bg, padding: 16, gap: 8 },
  sheetGrip: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.surface, alignSelf: 'center' },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink, marginBottom: 4 },
  pickRow: { minHeight: 52, backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  pickRowOn: { borderWidth: 2, borderColor: palette.highlight },
  pickName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  pickOwes: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 15, color: palette.neutral[600], textAlign: 'center', lineHeight: 22 },
  doneWrap: { flex: 1, backgroundColor: palette.highlight, padding: 24, paddingVertical: 32 },
  doneTag: { alignSelf: 'flex-start', fontFamily: fonts.semibold, fontSize: 14, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: palette.ink, color: palette.highlight },
  doneCust: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink },
  doneTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 56, color: palette.ink, letterSpacing: -1.5 },
  doneNote: { fontFamily: fonts.body, fontSize: 16, color: palette.ink, lineHeight: 22 },
  doneTap: { marginTop: 'auto', fontFamily: fonts.body, fontSize: 14, color: palette.ink, opacity: 0.8 },
});
