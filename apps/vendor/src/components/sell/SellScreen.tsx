import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Category, DailySalesSummary, Order, PaymentMethod, Product, StoreSettings } from '@floq/types';
import { formatINR } from '@floq/utils';
import { palette, fonts } from '../../theme';
import { HapticFeedback } from '../../services/haptics';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/strings';
import { Numpad, EmptyState } from '../common/ui';
import { Icon } from '../common/Icon';
import { UpiQr } from './UpiQr';

export interface ChargeLine {
  productId?: string;
  name?: string;
  unitPrice?: number;
  quantity: number;
}

interface Props {
  products: Product[];
  categories: Category[];
  dailySummary: DailySalesSummary | null;
  settings: StoreSettings | null;
  onCharge: (lines: ChargeLine[], method: PaymentMethod) => Promise<Order>;
  onToggleAvailability: (id: string, isAvailable: boolean) => void;
}

type Phase = 'SELL' | 'PAY' | 'CASH' | 'UPI' | 'TICKET';
type CartItem = { product: Product; quantity: number };

// Food counter Sell — design 4a. White tiles on Milk, Marigold for the one
// primary action, pay sheet → cash / UPI → token.
export const SellScreen: React.FC<Props> = ({ products, dailySummary, settings, onCharge, onToggleAvailability }) => {
  const { bi, t, lang, localFont } = useT();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [padMode, setPadMode] = useState(false);
  const [stockMode, setStockMode] = useState(false);
  const [padAmount, setPadAmount] = useState('');
  const [phase, setPhase] = useState<Phase>('SELL');
  const [pendingLines, setPendingLines] = useState<ChargeLine[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [tender, setTender] = useState(0);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [lastChange, setLastChange] = useState(0);
  const [lastMethod, setLastMethod] = useState<PaymentMethod>('CASH');
  const [busy, setBusy] = useState(false);

  const local = (k: StringKey) => bi(k).secondary;
  const lf = { fontFamily: localFont() };
  const revenue = dailySummary?.revenue ?? 0;
  const orders = dailySummary?.orders ?? 0;
  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);

  const addToCart = (p: Product) => {
    HapticFeedback.light();
    setCart((prev) => {
      const i = prev.findIndex((c) => c.product.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  };
  const dec = (id: string) =>
    setCart((prev) => {
      const i = prev.findIndex((c) => c.product.id === id);
      if (i < 0) return prev;
      if (prev[i].quantity > 1) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity - 1 };
        return next;
      }
      return prev.filter((c) => c.product.id !== id);
    });

  const startCharge = (lines: ChargeLine[], total: number, count: number) => {
    if (total <= 0) return;
    setPendingLines(lines);
    setPendingTotal(total);
    setPendingCount(count);
    setTender(0);
    setPhase('PAY');
  };
  const startChargeFromCart = () =>
    startCharge(cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })), cartTotal, cart.reduce((s, c) => s + c.quantity, 0));
  const startChargeFromPad = () => {
    const amt = parseInt(padAmount || '0', 10);
    startCharge([{ name: 'Quick sale', unitPrice: amt, quantity: 1 }], amt, 1);
  };

  const confirmCharge = async (method: PaymentMethod) => {
    if (busy) return;
    setBusy(true);
    try {
      const order = await onCharge(pendingLines, method);
      setLastOrder(order);
      setLastMethod(method);
      setLastChange(method === 'CASH' && tender > pendingTotal ? tender - pendingTotal : 0);
      setCart([]);
      setPadAmount('');
      setTender(0);
      setPhase('TICKET');
    } catch (e: any) {
      // Surface failure without losing the cart.
      setPhase('SELL');
      alert(e?.message || 'Could not complete the sale. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Token ----
  if (phase === 'TICKET' && lastOrder) {
    const dismiss = () => { setLastOrder(null); setLastChange(0); setPhase('SELL'); };
    const items = lastOrder.items?.map((i) => `${i.quantity} ${i.productNameSnapshot}`).join(', ');
    return (
      <Pressable style={styles.ticket} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Tap to keep selling">
        <Text style={styles.paidChip}>Paid · {(lastOrder.payMethod || lastMethod) === 'UPI' ? 'UPI' : 'Cash'} {formatINR(lastOrder.total)}</Text>
        <View style={{ marginTop: 'auto' }}>
          <Text style={styles.ticketLabel}>{bi('token').primary}{local('token') ? ` · ${local('token')}` : ''}</Text>
          <Text style={styles.ticketToken}>{lastOrder.ticketNumber}</Text>
          {items ? <Text style={styles.ticketItems}>{items}</Text> : null}
          {lastChange > 0 ? <Text style={styles.ticketChange}>Cash received. Give back {formatINR(lastChange)}.</Text> : null}
        </View>
        <View style={{ marginTop: 'auto' }}>
          <Text style={styles.ticketHint}>{bi('tapToKeepSelling').primary}</Text>
          {local('tapToKeepSelling') ? <Text style={[styles.ticketHintLocal, lf]}>{local('tapToKeepSelling')}</Text> : null}
        </View>
      </Pressable>
    );
  }

  // ---- Cash: what did they give? ----
  if (phase === 'CASH') {
    const change = tender ? tender - pendingTotal : 0;
    return (
      <View style={styles.full}>
        <BackRow onPress={() => setPhase('PAY')} />
        <View>
          <Text style={styles.h1}>What did they give?</Text>
          <Text style={styles.muted}>Bill {formatINR(pendingTotal)}</Text>
        </View>
        <View style={styles.tenderGrid}>
          {tenderOptions(pendingTotal).map((amt, i) => {
            const on = tender === amt;
            return (
              <TouchableOpacity key={amt} style={[styles.tender, on && styles.tenderOn]} onPress={() => { HapticFeedback.light(); setTender(amt); }} accessibilityState={{ selected: on }}>
                <Text style={[styles.tenderText, on && styles.tenderTextOn]}>{i === 0 ? `Exact ${formatINR(amt)}` : formatINR(amt)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {tender ? (
          <View style={styles.changeBox}>
            <Text style={styles.changeCaption}>{change === 0 ? 'Exact amount' : 'Give back'}</Text>
            <Text style={styles.changeAmount}>{change === 0 ? 'No change' : formatINR(change)}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={[styles.primary, { marginTop: 'auto' }, !tender && styles.primaryOff]} disabled={!tender || busy} onPress={() => confirmCharge('CASH')}>
          <Text style={[styles.primaryLabel, !tender && styles.primaryLabelOff]}>{busy ? '…' : bi('cashReceived').primary}</Text>
          {local('cashReceived') ? <Text style={[styles.primarySub, lf, !tender && styles.primaryLabelOff]}>{local('cashReceived')}</Text> : null}
        </TouchableOpacity>
      </View>
    );
  }

  // ---- UPI: scan & pay ----
  if (phase === 'UPI') {
    return (
      <View style={styles.full}>
        <BackRow onPress={() => setPhase('PAY')} />
        <View style={styles.upiHead}>
          <View>
            <Text style={styles.h1}>Scan & pay</Text>
            {local('showToCustomer') ? <Text style={[styles.muted, lf]}>{local('showToCustomer')}</Text> : null}
          </View>
          <Text style={styles.upiAmt}>{formatINR(pendingTotal)}</Text>
        </View>
        <View style={styles.qrCard}>
          <UpiQr upiId={settings?.upiId} name={settings?.upiName} amount={pendingTotal} note="floq sale" />
          <Text style={styles.muted}>{settings?.upiId || 'No UPI ID — add one in Settings'}</Text>
        </View>
        <View style={styles.upiStatus}>
          <Icon name="clock" size={20} color={palette.neutral[600]} />
          <Text style={styles.upiStatusText}>Check the paid screen on their phone</Text>
        </View>
        <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => confirmCharge('UPI')}>
          <Text style={styles.primaryLabel}>{busy ? '…' : bi('paymentReceived').primary}</Text>
          <Text style={styles.primarySub}>Only if the customer shows a paid screen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const amt = parseInt(padAmount || '0', 10);
  const chargeTotal = padMode ? amt : cartTotal;
  const live = chargeTotal > 0;

  return (
    <View style={styles.screen}>
      {/* Today + tools */}
      <View style={styles.top}>
        <View style={styles.todayRow}>
          <Text style={styles.todayLabel}>{bi('today').primary}</Text>
          <Text style={styles.todayAmt}>{formatINR(revenue)}</Text>
          <Text style={styles.todayLabel}>· {orders} {t('orders')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {!padMode ? (
            <TouchableOpacity style={[styles.toolBtn, stockMode && styles.toolBtnOn]} onPress={() => { HapticFeedback.light(); setStockMode((s) => !s); }}>
              <Text style={[styles.toolText, stockMode && styles.toolTextOn]}>{stockMode ? 'Done' : 'Mark sold out'}</Text>
            </TouchableOpacity>
          ) : null}
          {!stockMode ? (
            <TouchableOpacity style={styles.toolBtn} onPress={() => { HapticFeedback.light(); setPadMode((m) => !m); setPadAmount(''); }}>
              <Text style={styles.toolText}>{padMode ? 'Items' : 'Amount'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {stockMode ? <Text style={styles.stockHint}>Tap an item to mark it sold out. Tap again to bring it back.</Text> : null}

      {padMode ? (
        <View style={{ flex: 1 }}>
          <View style={styles.padDisplay}>
            <Text style={styles.muted}>{bi('amount').primary}</Text>
            <Text style={styles.padAmount}>{formatINR(amt)}</Text>
          </View>
          <Numpad onKey={(d) => setPadAmount((padAmount + d).slice(0, 7))} onBackspace={() => setPadAmount(padAmount.slice(0, -1))} minHeight={200} />
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1 }}><EmptyState title="No items yet" subtitle="Add your menu from Settings → Menu and prices." /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
          {products.map((p) => {
            const qty = cart.find((c) => c.product.id === p.id)?.quantity || 0;
            const out = !p.isAvailable;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.tile, qty > 0 && styles.tileIn, stockMode && styles.tileStock, out && styles.tileOut]}
                activeOpacity={0.7}
                onPress={() => {
                  if (stockMode) { HapticFeedback.medium(); onToggleAvailability(p.id, out); }
                  else if (!out) addToCart(p);
                }}
                onLongPress={() => { HapticFeedback.medium(); onToggleAvailability(p.id, out); }}
              >
                <View style={styles.tileTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tileName} numberOfLines={2}>{p.name}</Text>
                    {p.nameLocal && lang !== 'none' ? <Text style={[styles.tileLocal, lf]} numberOfLines={1}>{p.nameLocal}</Text> : null}
                  </View>
                  {qty > 0 ? <View style={styles.qtyBadge}><Text style={styles.qtyText}>{qty}</Text></View> : null}
                </View>
                <View style={styles.tileBottom}>
                  <Text style={styles.tilePrice}>{formatINR(p.price)}</Text>
                  {out ? <Text style={styles.soldOut}>Sold out</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Cart + Charge */}
      <View style={styles.cartBox}>
        {!padMode && cart.length === 0 ? (
          <View>
            <Text style={styles.cartHint}>{bi('tapItemsToStart').primary}</Text>
            {local('tapItemsToStart') ? <Text style={[styles.cartHintLocal, lf]}>{local('tapItemsToStart')}</Text> : null}
          </View>
        ) : null}
        {!padMode && cart.length > 0 ? (
          <ScrollView style={{ maxHeight: 112 }}>
            {cart.map((c) => (
              <View key={c.product.id} style={styles.cartLine}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => dec(c.product.id)} accessibilityLabel={`One less ${c.product.name}`}>
                  <Icon name="minus" size={20} color={palette.ink} />
                </TouchableOpacity>
                <Text style={styles.cartQty}>{c.quantity}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => addToCart(c.product)} accessibilityLabel={`One more ${c.product.name}`}>
                  <Icon name="plus" size={20} color={palette.ink} />
                </TouchableOpacity>
                <Text style={styles.cartName} numberOfLines={1}>{c.product.name}</Text>
                <Text style={styles.cartAmt}>{formatINR(c.product.price * c.quantity)}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!padMode && cart.length > 0 ? (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setCart([])}>
              <Text style={styles.clearText}>{bi('clear').primary}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.charge, !live && styles.primaryOff]}
            activeOpacity={0.85}
            disabled={!live}
            onPress={() => { HapticFeedback.medium(); padMode ? startChargeFromPad() : startChargeFromCart(); }}
          >
            <View>
              <Text style={[styles.primaryLabel, !live && styles.primaryLabelOff]}>{bi('charge').primary}</Text>
              {local('charge') ? <Text style={[styles.primarySub, lf, !live && styles.primaryLabelOff]}>{local('charge')}</Text> : null}
            </View>
            <Text style={[styles.chargeTotal, !live && styles.primaryLabelOff]}>{formatINR(chargeTotal)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pay sheet */}
      {phase === 'PAY' ? (
        <View style={styles.scrim}>
          <Pressable style={{ flex: 1 }} onPress={() => setPhase('SELL')} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <View style={styles.grip} />
            <View>
              <Text style={styles.muted}>{bi('amountDue').primary} · {pendingCount} {pendingCount === 1 ? 'item' : 'items'}</Text>
              <Text style={styles.dueAmt}>{formatINR(pendingTotal)}</Text>
            </View>
            <PayOption icon="banknote" k="cash" onPress={() => setPhase('CASH')} />
            <PayOption icon="qr-code" k="upiQr" onPress={() => setPhase('UPI')} />
            <TouchableOpacity style={styles.sheetBack} onPress={() => setPhase('SELL')}>
              <Text style={styles.sheetBackText}>{bi('back').primary}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
};

function PayOption({ icon, k, onPress }: { icon: 'banknote' | 'qr-code'; k: StringKey; onPress: () => void }) {
  const { bi, localFont } = useT();
  return (
    <TouchableOpacity style={styles.payOpt} activeOpacity={0.85} onPress={() => { HapticFeedback.medium(); onPress(); }}>
      <Icon name={icon} size={28} color={palette.ink} />
      <View>
        <Text style={styles.payOptLabel}>{bi(k).primary}</Text>
        {bi(k).secondary ? <Text style={[styles.muted, { fontFamily: localFont() }]}>{bi(k).secondary}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function BackRow({ onPress }: { onPress: () => void }) {
  const { bi } = useT();
  return (
    <TouchableOpacity style={styles.backRow} onPress={onPress}>
      <Text style={styles.backText}>← {bi('back').primary}</Text>
    </TouchableOpacity>
  );
}

// Exact first, then the next round notes, at most four (design 4a).
function tenderOptions(total: number): number[] {
  const out: number[] = [];
  for (const v of [total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, 200, 500, 2000]) {
    if (v >= total && v > 0 && !out.includes(v) && out.length < 4) out.push(v);
  }
  return out;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  full: { flex: 1, backgroundColor: palette.bg, padding: 16, gap: 16 },
  muted: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  h1: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, lineHeight: 34, color: palette.ink },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  todayRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  todayLabel: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  todayAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },
  toolBtn: { borderRadius: 8, minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: palette.card, borderWidth: 1.5, borderColor: palette.surface },
  toolBtnOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  toolText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink },
  toolTextOn: { color: palette.bg },
  stockHint: { borderRadius: 14, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: palette.ink, color: palette.bg, fontFamily: fonts.body, fontSize: 14, lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tile: { borderRadius: 14, width: '48.8%', minHeight: 104, backgroundColor: palette.card, padding: 14, gap: 8 },
  tileIn: { borderWidth: 2, borderColor: palette.highlight, padding: 12 },
  tileStock: { borderWidth: 1.5, borderColor: palette.neutral[600], padding: 12.5 },
  tileOut: { opacity: 0.45 },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  tileName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: palette.ink },
  tileLocal: { fontSize: 14, lineHeight: 18, color: palette.neutral[600] },
  qtyBadge: { borderRadius: 8, minWidth: 30, height: 30, paddingHorizontal: 4, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.onHighlight },
  tileBottom: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tilePrice: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink },
  soldOut: { borderRadius: 8, fontFamily: fonts.semibold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.ink, color: palette.bg, overflow: 'hidden' },

  padDisplay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  padAmount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 56, letterSpacing: -2, color: palette.ink, marginTop: 8 },

  cartBox: { backgroundColor: palette.card, borderTopWidth: 1, borderTopColor: palette.surface, paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  cartHint: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: palette.neutral[600] },
  cartHintLocal: { fontSize: 14, lineHeight: 18, color: palette.neutral[600] },
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  stepBtn: { borderRadius: 8, width: 48, height: 48, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' },
  cartQty: { width: 24, textAlign: 'center', fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, color: palette.ink },
  cartName: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: palette.ink },
  cartAmt: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  clearBtn: { minHeight: 60, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1.5, borderColor: palette.surface },
  clearText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  charge: { borderRadius: 14, flex: 1, minHeight: 60, backgroundColor: palette.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  chargeTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 28, color: palette.onHighlight },

  primary: { borderRadius: 14, minHeight: 64, backgroundColor: palette.highlight, justifyContent: 'center', paddingHorizontal: 18 },
  primaryOff: { backgroundColor: palette.surface },
  primaryLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, lineHeight: 24, color: palette.onHighlight },
  primaryLabelOff: { color: palette.neutral[600] },
  primarySub: { fontFamily: fonts.body, fontSize: 14, color: palette.onHighlight },

  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,27,26,0.45)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: palette.bg, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 12 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.surface, alignSelf: 'center' },
  dueAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 44, lineHeight: 48, color: palette.ink },
  payOpt: { borderRadius: 14, minHeight: 84, backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18 },
  payOptLabel: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, color: palette.ink },
  sheetBack: { minHeight: 48, justifyContent: 'center' },
  sheetBackText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.neutral[600] },

  backRow: { minHeight: 48, justifyContent: 'center' },
  backText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  tenderGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tender: { borderRadius: 14, width: '48.8%', minHeight: 72, backgroundColor: palette.card, justifyContent: 'center', paddingHorizontal: 18 },
  tenderOn: { backgroundColor: palette.ink },
  tenderText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.ink },
  tenderTextOn: { color: palette.bg },
  changeBox: { borderRadius: 14, backgroundColor: palette.successBg, paddingHorizontal: 18, paddingVertical: 16 },
  changeCaption: { fontFamily: fonts.semibold, fontSize: 14, color: palette.success },
  changeAmount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 36, lineHeight: 40, color: palette.success },

  upiHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  upiAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 36, color: palette.ink },
  qrCard: { borderRadius: 14, flex: 1, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 },
  upiStatus: { borderRadius: 14, minHeight: 48, backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  upiStatusText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.neutral[600] },

  ticket: { flex: 1, backgroundColor: palette.highlight, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  paidChip: { borderRadius: 8, alignSelf: 'flex-start', fontFamily: fonts.semibold, fontSize: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: palette.successBg, color: palette.success, overflow: 'hidden' },
  ticketLabel: { fontFamily: fonts.semibold, fontSize: 20, color: palette.onHighlight },
  ticketToken: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 160, lineHeight: 160, letterSpacing: -4, color: palette.onHighlight },
  ticketItems: { fontFamily: fonts.body, fontSize: 18, lineHeight: 24, marginTop: 8, color: palette.onHighlight },
  ticketChange: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, marginTop: 12, color: palette.onHighlight },
  ticketHint: { fontFamily: fonts.body, fontSize: 16, color: palette.onHighlight },
  ticketHintLocal: { fontSize: 14, color: palette.onHighlight },
});
