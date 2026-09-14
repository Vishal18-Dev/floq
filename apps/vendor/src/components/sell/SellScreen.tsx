import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Category, DailySalesSummary, Order, PaymentMethod, Product, StoreSettings } from '@floq/types';
import { formatINR } from '@floq/utils';
import { palette, fonts, borders, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';
import { useT } from '../../i18n';
import { BiText, Kicker, Numpad, PrimaryBar, EmptyState } from '../common/ui';
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
  mode: 'FOOD' | 'RETAIL';
  onCharge: (lines: ChargeLine[], method: PaymentMethod) => Promise<Order>;
  onToggleAvailability: (id: string, isAvailable: boolean) => void;
}

type Phase = 'SELL' | 'PAY' | 'CASH' | 'UPI' | 'TICKET';
type CartItem = { product: Product; quantity: number };

export const SellScreen: React.FC<Props> = ({ products, categories, dailySummary, settings, mode, onCharge, onToggleAvailability }) => {
  const { bi, t, lang } = useT();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [padMode, setPadMode] = useState(false);
  const [padAmount, setPadAmount] = useState('');
  const [phase, setPhase] = useState<Phase>('SELL');
  const [pendingLines, setPendingLines] = useState<ChargeLine[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [tender, setTender] = useState(0);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [lastChange, setLastChange] = useState(0); // cash change to return, retail receipt
  const [busy, setBusy] = useState(false);

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

  const startChargeFromCart = () => {
    if (cartTotal <= 0) return;
    setPendingLines(cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })));
    setPendingTotal(cartTotal);
    setPhase('PAY');
  };

  const startChargeFromPad = () => {
    const amt = parseInt(padAmount || '0', 10);
    if (amt <= 0) return;
    setPendingLines([{ name: 'Quick sale', unitPrice: amt, quantity: 1 }]);
    setPendingTotal(amt);
    setPhase('PAY');
  };

  const confirmCharge = async (method: PaymentMethod) => {
    if (busy) return;
    setBusy(true);
    try {
      const order = await onCharge(pendingLines, method);
      setLastOrder(order);
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

  // ---- Payment overlays ----
  if (phase === 'TICKET' && lastOrder) {
    const dismiss = () => { setLastOrder(null); setLastChange(0); setPhase('SELL'); };
    // RETAIL: a receipt (amount paid + change). Token numbers are a food/kitchen
    // concept — a grocery customer pays and leaves, there is nothing to call out.
    if (mode === 'RETAIL') {
      return (
        <TouchableOpacity activeOpacity={0.9} style={styles.ticket} onPress={dismiss}>
          <Kicker color={palette.onAccent}>{bi('saleComplete').primary}{bi('saleComplete').secondary ? ` · ${bi('saleComplete').secondary}` : ''}</Kicker>
          <Text style={styles.receiptAmount}>{formatINR(lastOrder.total)}</Text>
          <Text style={styles.receiptPaid}>{bi('paid').primary}{bi('paid').secondary ? ` · ${bi('paid').secondary}` : ''}</Text>
          {lastChange > 0 ? (
            <View style={styles.changeStrip}>
              <Text style={styles.changeStripLabel}>{bi('changeToReturn').primary}{bi('changeToReturn').secondary ? ` · ${bi('changeToReturn').secondary}` : ''}</Text>
              <Text style={styles.changeStripAmt}>{formatINR(lastChange)}</Text>
            </View>
          ) : null}
          <Text style={styles.ticketHint}>{bi('tapToKeepSelling').primary}{bi('tapToKeepSelling').secondary ? ` · ${bi('tapToKeepSelling').secondary}` : ''}</Text>
        </TouchableOpacity>
      );
    }
    // FOOD: big token number for the kitchen queue call-out.
    return (
      <TouchableOpacity activeOpacity={0.9} style={styles.ticket} onPress={dismiss}>
        <Kicker color={palette.onAccent}>{t('paid')} · {lastOrder.paymentStatus === 'SUCCESS' ? 'OK' : lastOrder.status}</Kicker>
        <Text style={styles.ticketTokenLabel}>{bi('token').primary}{bi('token').secondary ? ` · ${bi('token').secondary}` : ''}</Text>
        <Text style={styles.ticketToken}>{lastOrder.ticketNumber}</Text>
        <Text style={styles.ticketItems}>{formatINR(lastOrder.total)}</Text>
        <Text style={styles.ticketHint}>{bi('tapToKeepSelling').primary}{bi('tapToKeepSelling').secondary ? ` · ${bi('tapToKeepSelling').secondary}` : ''}</Text>
      </TouchableOpacity>
    );
  }

  if (phase === 'PAY' || phase === 'CASH' || phase === 'UPI') {
    return (
      <View style={styles.overlay}>
        <View style={styles.dueHead}>
          <Kicker>{bi('amountDue').primary}{bi('amountDue').secondary ? ` · ${bi('amountDue').secondary}` : ''}</Kicker>
          <Text style={styles.dueAmount}>{formatINR(pendingTotal)}</Text>
        </View>

        {phase === 'PAY' && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.payCash} activeOpacity={0.85} onPress={() => { HapticFeedback.medium(); setPhase('CASH'); }}>
              <BiText k="cash" style={styles.payBig} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.payUpi} activeOpacity={0.85} onPress={() => { HapticFeedback.medium(); setPhase('UPI'); }}>
              <BiText k="upiQr" style={[styles.payBig, { color: palette.onAccent }]} localStyle={{ color: palette.onAccent, opacity: 0.85 }} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelRow} onPress={() => setPhase('SELL')}>
              <Text style={styles.cancelText}>← {bi('back').primary}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'CASH' && (
          <View style={{ flex: 1 }}>
            <View style={styles.tenderRow}>
              {tenderOptions(pendingTotal).map((amt) => (
                <TouchableOpacity key={amt} style={[styles.tenderChip, tender === amt && styles.tenderChipActive]} onPress={() => { HapticFeedback.light(); setTender(amt); }}>
                  <Text style={[styles.tenderChipText, tender === amt && styles.tenderChipTextActive]}>{amt === pendingTotal ? 'EXACT' : formatINR(amt)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {tender > 0 && tender >= pendingTotal ? (
              <View style={styles.changeBox}>
                <Kicker>CHANGE · वापसी</Kicker>
                <Text style={styles.changeAmount}>{formatINR(tender - pendingTotal)}</Text>
              </View>
            ) : (
              <View style={styles.changeBox}><Text style={styles.changeHint}>Pick the note the customer gave (optional)</Text></View>
            )}
            <View style={{ flex: 1 }} />
            <PrimaryBar label={busy ? '…' : `${bi('cashReceived').primary}`} sub={bi('cashReceived').secondary || undefined} onPress={() => confirmCharge('CASH')} disabled={busy} />
            <TouchableOpacity style={styles.cancelRow} onPress={() => setPhase('PAY')}><Text style={styles.cancelText}>← {bi('back').primary}</Text></TouchableOpacity>
          </View>
        )}

        {phase === 'UPI' && (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.showToCustomer}>{bi('showToCustomer').primary}{bi('showToCustomer').secondary ? ` · ${bi('showToCustomer').secondary}` : ''}</Text>
            <View style={{ marginVertical: spacing.lg }}>
              <UpiQr upiId={settings?.upiId} name={settings?.upiName} amount={pendingTotal} note={`FLOQ sale`} />
            </View>
            <Text style={styles.upiVpa}>{settings?.upiId || '—'}</Text>
            <View style={{ flex: 1 }} />
            <PrimaryBar label={busy ? '…' : bi('paymentReceived').primary} sub={bi('paymentReceived').secondary || undefined} onPress={() => confirmCharge('UPI')} disabled={busy} />
            <TouchableOpacity style={styles.cancelRow} onPress={() => setPhase('PAY')}><Text style={styles.cancelText}>← {bi('back').primary}</Text></TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ---- Quick-charge amount pad ----
  if (padMode) {
    const amt = parseInt(padAmount || '0', 10);
    return (
      <View style={styles.screen}>
        <TodayStrip revenue={revenue} orders={orders} rightLabel="ITEMS" onToggle={() => { setPadMode(false); setPadAmount(''); }} />
        <View style={styles.padDisplay}>
          <BiText k="amount" />
          <Text style={styles.padAmount}>{formatINR(amt)}</Text>
        </View>
        <Numpad onKey={(d) => setPadAmount((padAmount + d).slice(0, 7))} onBackspace={() => setPadAmount(padAmount.slice(0, -1))} minHeight={200} />
        <PrimaryBar label={bi('charge').primary} sub={bi('charge').secondary || undefined} right={formatINR(amt)} disabled={amt <= 0} onPress={startChargeFromPad} />
      </View>
    );
  }

  // ---- Sell grid ----
  return (
    <View style={styles.screen}>
      <TodayStrip revenue={revenue} orders={orders} rightLabel={t('amount')} onToggle={() => setPadMode(true)} />

      {products.length === 0 ? (
        <EmptyState title="No items yet" subtitle="Add products in Business, or ask FLOQ to set up your menu." />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {products.map((p) => {
            const qty = cart.find((c) => c.product.id === p.id)?.quantity || 0;
            const out = !p.isAvailable;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.tile, out && styles.tileOut]}
                activeOpacity={0.7}
                onPress={() => (out ? undefined : addToCart(p))}
                onLongPress={() => { HapticFeedback.medium(); onToggleAvailability(p.id, out); }}
              >
                <View style={styles.tileTop}>
                  <Text style={styles.tileName} numberOfLines={2}>{p.name}</Text>
                  {qty > 0 && <View style={styles.qtyBadge}><Text style={styles.qtyBadgeText}>{qty}</Text></View>}
                </View>
                {p.nameLocal && lang !== 'none' ? <Text style={styles.tileLocal} numberOfLines={1}>{p.nameLocal}</Text> : null}
                <View style={styles.tileBottom}>
                  <Text style={styles.tilePrice}>{formatINR(p.price)}</Text>
                  {out && <View style={styles.soldOut}><Text style={styles.soldOutText}>{t('soldOut')}</Text></View>}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Cart / charge bar */}
      {cart.length === 0 ? (
        <View style={styles.cartHintBar}>
          <Text style={styles.cartHint}>{bi('tapItemsToStart').primary}{bi('tapItemsToStart').secondary ? ` · ${bi('tapItemsToStart').secondary}` : ''}</Text>
        </View>
      ) : (
        <View style={styles.cartBox}>
          <ScrollView style={{ maxHeight: 150 }}>
            {cart.map((c) => (
              <View key={c.product.id} style={styles.cartLine}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => dec(c.product.id)}><Text style={styles.stepText}>−</Text></TouchableOpacity>
                <Text style={styles.cartQty}>{c.quantity}</Text>
                <Text style={styles.cartName} numberOfLines={1}>{c.product.name}</Text>
                <Text style={styles.cartAmt}>{formatINR(c.product.price * c.quantity)}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => addToCart(c.product)}><Text style={styles.stepText}>+</Text></TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={styles.chargeRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={() => setCart([])}><Text style={styles.clearText}>{t('clear')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.chargeBtn} activeOpacity={0.85} onPress={startChargeFromCart}>
              <View>
                <Text style={styles.chargeLabel}>{bi('charge').primary}</Text>
                {bi('charge').secondary ? <Text style={styles.chargeSub}>{bi('charge').secondary}</Text> : null}
              </View>
              <Text style={styles.chargeTotal}>{formatINR(cartTotal)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

function tenderOptions(total: number): number[] {
  const opts = new Set<number>([total]);
  for (const step of [10, 50, 100, 500]) {
    const up = Math.ceil(total / step) * step;
    if (up > total) opts.add(up);
  }
  return Array.from(opts).sort((a, b) => a - b).slice(0, 4);
}

const TodayStrip = ({ revenue, orders, rightLabel, onToggle }: { revenue: number; orders: number; rightLabel: string; onToggle: () => void }) => {
  const { t } = useT();
  return (
    <View style={styles.todayStrip}>
      <View style={styles.todayLeft}>
        <Text style={styles.todayKicker}>{t('today')}</Text>
        <Text style={styles.todayAmount}>{formatINR(revenue)}</Text>
        <Text style={styles.todayOrders}>{orders} {t('orders')}</Text>
      </View>
      <TouchableOpacity style={styles.modeToggle} onPress={() => { HapticFeedback.light(); onToggle(); }}>
        <Text style={styles.modeToggleText}>{rightLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  todayStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  todayLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  todayKicker: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 10, letterSpacing: 1.2, color: palette.neutral[700] },
  todayAmount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, letterSpacing: -0.4, color: palette.ink },
  todayOrders: { fontFamily: fonts.body, fontSize: 11, color: palette.neutral[700] },
  modeToggle: { borderWidth: borders.rule, borderColor: palette.divider, paddingHorizontal: 8, paddingVertical: 6 },
  modeToggleText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 10, letterSpacing: 1, color: palette.ink },

  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: palette.bg },
  // 2px grid lines via borders (a flex `gap` would push two 50% tiles onto
  // separate rows). Right/bottom borders draw the dividers between tiles.
  tile: {
    width: '50%',
    minHeight: 108,
    backgroundColor: palette.bg,
    padding: 12,
    justifyContent: 'space-between',
    borderRightWidth: borders.rule,
    borderBottomWidth: borders.rule,
    borderColor: palette.divider,
  },
  tileOut: { backgroundColor: palette.neutral[200] },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  tileName: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink, flex: 1, letterSpacing: -0.2 },
  tileLocal: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[700], marginTop: 2 },
  tileBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  tilePrice: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, letterSpacing: -0.4, color: palette.ink },
  qtyBadge: { minWidth: 28, height: 28, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  qtyBadgeText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 15, color: palette.onAccent },
  soldOut: { backgroundColor: palette.ink, paddingHorizontal: 6, paddingVertical: 3 },
  soldOutText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 10, letterSpacing: 1, color: palette.bg },

  cartHintBar: { padding: 16, borderTopWidth: borders.rule, borderTopColor: palette.divider },
  cartHint: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[700] },
  cartBox: { borderTopWidth: borders.rule, borderTopColor: palette.divider },
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: borders.hair, borderBottomColor: palette.dividerFaint },
  stepBtn: { width: 44, height: 44, borderWidth: borders.rule, borderColor: palette.divider, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.ink },
  cartQty: { width: 30, textAlign: 'center', fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, color: palette.ink },
  cartName: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: palette.ink },
  cartAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },
  chargeRow: { flexDirection: 'row', gap: borders.rule, backgroundColor: palette.divider },
  clearBtn: { width: 96, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 12, letterSpacing: 1, color: palette.ink },
  chargeBtn: { flex: 1, backgroundColor: palette.accent, minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  chargeLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.onAccent, letterSpacing: 0.3 },
  chargeSub: { fontFamily: fonts.body, fontSize: 13, color: palette.onAccent, opacity: 0.85 },
  chargeTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, color: palette.onAccent, letterSpacing: -0.5 },

  // pad
  padDisplay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  padAmount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 56, letterSpacing: -2, color: palette.ink, marginTop: 8 },

  // overlays
  overlay: { flex: 1, backgroundColor: palette.bg },
  dueHead: { padding: 18, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  dueAmount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 60, letterSpacing: -2.5, color: palette.ink, lineHeight: 62 },
  payCash: { flex: 1, borderBottomWidth: borders.rule, borderBottomColor: palette.divider, justifyContent: 'center', paddingHorizontal: 22 },
  payUpi: { flex: 1, backgroundColor: palette.accent, justifyContent: 'center', paddingHorizontal: 22 },
  payBig: { fontSize: 40, letterSpacing: -0.5 },
  cancelRow: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[700] },
  tenderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: borders.rule, backgroundColor: palette.divider, borderBottomWidth: borders.rule, borderBottomColor: palette.divider },
  tenderChip: { flexGrow: 1, minWidth: '48%', backgroundColor: palette.bg, paddingVertical: 18, alignItems: 'center' },
  tenderChipActive: { backgroundColor: palette.ink },
  tenderChipText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, color: palette.ink },
  tenderChipTextActive: { color: palette.onAccent },
  changeBox: { padding: 18 },
  changeAmount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 44, letterSpacing: -1.5, color: palette.accent },
  changeHint: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[600] },
  showToCustomer: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 12, letterSpacing: 1, color: palette.neutral[700], paddingTop: 18 },
  upiVpa: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink },

  // ticket
  ticket: { flex: 1, backgroundColor: palette.accent, justifyContent: 'center', paddingHorizontal: 26 },
  ticketTokenLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, letterSpacing: 2, color: palette.onAccent, opacity: 0.85, marginTop: 24 },
  ticketToken: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 120, letterSpacing: -5, color: palette.onAccent, lineHeight: 128 },
  ticketItems: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 28, color: palette.onAccent, opacity: 0.9 },
  ticketHint: { fontFamily: fonts.body, fontSize: 14, color: palette.onAccent, opacity: 0.8, marginTop: 30 },
  // retail receipt
  receiptAmount: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 96, letterSpacing: -4, color: palette.onAccent, lineHeight: 100, marginTop: 20 },
  receiptPaid: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, letterSpacing: 1, color: palette.onAccent, opacity: 0.85, marginTop: 4 },
  changeStrip: { marginTop: 28, borderTopWidth: 2, borderTopColor: palette.onAccent, paddingTop: 14 },
  changeStripLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, letterSpacing: 1.5, color: palette.onAccent, opacity: 0.85 },
  changeStripAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 52, letterSpacing: -2, color: palette.onAccent, lineHeight: 56 },
});
