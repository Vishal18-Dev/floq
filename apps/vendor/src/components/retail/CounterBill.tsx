import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Product, Category, StoreSettings, CreditCustomer, Order } from '@floq/types';
import { palette, fonts } from '../../theme';
import { useT } from '../../i18n';
import { HapticFeedback } from '../../services/haptics';
import { UpiQr } from '../sell/UpiQr';
import {
  INR,
  fmtG,
  entries,
  entryByKey,
  daysLeft,
  cartLines,
  cartTotal,
  cartCount,
  tenderOptions,
  Cart,
  RetailCharge,
  chargeItemsFromCart,
} from '../../services/retail';

// ponytail: fixed 5-day low-stock threshold; lift to a store setting if a
// merchant wants to tune it.
const LOW_DAYS = 5;

type Flow = null | 'pay' | 'cash' | 'upi' | 'credit' | 'done';

interface Receipt {
  total: number;
  method: 'CASH' | 'UPI' | 'CREDIT';
  customerName?: string;
  change: number;
  lines: { qty: string; label: string; amount: string }[];
}

export function CounterBill({
  products,
  categories,
  settings,
  todayRevenue,
  customers,
  onCharge,
}: {
  products: Product[];
  categories: Category[];
  settings: StoreSettings | null;
  todayRevenue: string;
  customers: CreditCustomer[];
  onCharge: (charge: RetailCharge) => Promise<Order>;
}) {
  const { bi, t, localFont } = useT();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [cart, setCart] = useState<Cart>({});
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow>(null);
  const [tender, setTender] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Receipt | null>(null);

  const lines = useMemo(() => cartLines(products, cart), [products, cart]);
  const total = cartTotal(lines);
  const count = cartCount(cart);
  const allEntries = useMemo(() => entries(products), [products]);

  const setQty = (key: string, q: number) =>
    setCart((c) => {
      const next = { ...c };
      if (q <= 0) delete next[key];
      else next[key] = q;
      return next;
    });

  const catNames = ['All', ...categories.map((c) => c.name)];
  const q = search.trim().toLowerCase();
  const activeCatId = categories.find((c) => c.name === cat)?.id;
  const shelf = products.filter((p) => {
    const inCat = cat === 'All' || p.categoryId === activeCatId;
    const inSearch = !q || p.name.toLowerCase().includes(q) || (p.nameLocal || '').toLowerCase().includes(q);
    return inCat && inSearch;
  });

  const sheetProduct = sheetId ? products.find((p) => p.id === sheetId) : null;

  const commit = async (method: 'CASH' | 'UPI' | 'CREDIT', customer?: CreditCustomer) => {
    if (busy || total <= 0) return;
    setBusy(true);
    try {
      const charge: RetailCharge = {
        items: chargeItemsFromCart(products, cart),
        method,
        creditCustomerId: customer?.id,
        cashTendered: method === 'CASH' && tender ? tender : undefined,
      };
      await onCharge(charge);
      setLast({
        total,
        method,
        customerName: customer?.name,
        change: method === 'CASH' && tender ? Math.max(0, tender - total) : 0,
        lines: lines.map((l) => ({ qty: l.qtyLabel, label: l.label, amount: INR(l.amount) })),
      });
      setCart({});
      setTender(null);
      setFlow('done');
    } catch (e: any) {
      alert(e?.message || 'Could not complete the sale');
    } finally {
      setBusy(false);
    }
  };

  const newBill = () => {
    setLast(null);
    setFlow(null);
  };

  return (
    <View style={styles.wrap}>
      {/* Today strip */}
      <View style={styles.todayRow}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.todayValue}>{todayRevenue}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${allEntries.length} products`}
          placeholderTextColor={palette.neutral[500]}
        />
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsInner}>
        {catNames.map((c) => {
          const on = cat === c;
          return (
            <TouchableOpacity key={c} onPress={() => setCat(c)} style={[styles.chip, on && styles.chipOn]} activeOpacity={0.7}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Shelf */}
      <ScrollView style={styles.shelf} contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}>
        {shelf.length === 0 ? (
          <Text style={styles.emptyShelf}>No products match. Try another search or category.</Text>
        ) : (
          shelf.map((p) => {
            const pe = allEntries.filter((e) => e.product.id === p.id);
            const lowE = pe.filter((e) => daysLeft(e) <= LOW_DAYS).sort((a, b) => a.stock - b.stock)[0];
            const inBill = p.isLoose
              ? cart[p.id]
                ? fmtG(cart[p.id])
                : ''
              : (() => {
                  const n = (p.packs ?? []).reduce((s, k) => s + (cart[k.id] || 0), 0);
                  return n ? `${n} in bill` : '';
                })();
            const priceLabel = p.isLoose
              ? `${INR(p.perKg ?? 0)}/kg`
              : (p.packs ?? []).length > 1
              ? `from ${INR(Math.min(...(p.packs ?? []).map((k) => k.price)))}`
              : INR((p.packs ?? [])[0]?.price ?? 0);
            const sizes = p.isLoose ? 'Sold by weight' : (p.packs ?? []).map((k) => k.size).join(' · ');
            const localName = localNameLine(p, localFont);
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.7}
                onPress={() => { HapticFeedback.light(); setSheetId(p.id); }}
                style={[styles.row, inBill ? styles.rowInBill : null]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName}>{p.name}</Text>
                  {localName}
                  <Text style={styles.rowSizes}>{sizes}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.rowPrice}>{priceLabel}</Text>
                  {lowE ? (
                    <Text style={styles.lowChip}>
                      {lowE.loose ? `${Math.round(lowE.stock / 1000)} kg left` : `${(p.packs ?? []).length > 1 ? lowE.pack!.size + ': ' : ''}${lowE.stock} left`}
                    </Text>
                  ) : null}
                  {inBill ? <Text style={styles.billChip}>{inBill}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Cart footer */}
      <View style={styles.footer}>
        {count === 0 ? (
          <Text style={styles.footerHint}>Tap an item to build the bill</Text>
        ) : (
          <ScrollView style={{ maxHeight: 92 }}>
            {lines.map((l) => (
              <TouchableOpacity key={l.key} style={styles.cartLine} onPress={() => setSheetId(l.entry.product.id)}>
                <Text style={styles.cartQty}>{l.qtyLabel}</Text>
                <Text style={styles.cartLabel} numberOfLines={1}>{l.label}</Text>
                <Text style={styles.cartAmt}>{INR(l.amount)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {count > 0 ? (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setCart({})}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.chargeBtn, total <= 0 && styles.chargeBtnOff]}
            disabled={total <= 0}
            activeOpacity={0.85}
            onPress={() => { HapticFeedback.medium(); setFlow('pay'); }}
          >
            <View>
              <Text style={[styles.chargeLabel, total <= 0 && styles.chargeLabelOff]}>{bi('charge').primary}</Text>
              {bi('charge').secondary ? <Text style={[styles.chargeSub, total <= 0 && styles.chargeLabelOff]}>{bi('charge').secondary}</Text> : null}
            </View>
            <Text style={[styles.chargeTotal, total <= 0 && styles.chargeLabelOff]}>{INR(total)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pack / loose sheet */}
      {sheetProduct ? (
        <PackSheet
          product={sheetProduct}
          cart={cart}
          setQty={setQty}
          onClose={() => setSheetId(null)}
        />
      ) : null}

      {/* Pay flow */}
      {flow === 'pay' ? (
        <PaySheet
          total={total}
          count={count}
          onCash={() => { setTender(null); setFlow('cash'); }}
          onUpi={() => setFlow('upi')}
          onCredit={() => setFlow('credit')}
          onCancel={() => setFlow(null)}
        />
      ) : null}

      {flow === 'cash' ? (
        <CashScreen
          total={total}
          tender={tender}
          setTender={setTender}
          busy={busy}
          onBack={() => setFlow('pay')}
          onConfirm={() => commit('CASH')}
        />
      ) : null}

      {flow === 'upi' ? (
        <UpiScreen
          total={total}
          settings={settings}
          busy={busy}
          onBack={() => setFlow('pay')}
          onConfirm={() => commit('UPI')}
        />
      ) : null}

      {flow === 'credit' ? (
        <CreditScreen
          total={total}
          customers={customers}
          onBack={() => setFlow('pay')}
          onPick={(c) => commit('CREDIT', c)}
        />
      ) : null}

      {flow === 'done' && last ? <DoneScreen receipt={last} onNewBill={newBill} /> : null}
    </View>
  );
}

// Render a product's local-script name line in the right font, or nothing.
function localNameLine(p: Product, localFont: (w?: any) => string) {
  if (!p.nameLocal) return null;
  return <Text style={[styles.rowLocal, { fontFamily: localFont() }]}>{p.nameLocal}</Text>;
}

/* ---------- Pack / loose bottom sheet ---------- */
function PackSheet({
  product,
  cart,
  setQty,
  onClose,
}: {
  product: Product;
  cart: Cart;
  setQty: (key: string, q: number) => void;
  onClose: () => void;
}) {
  const loose = !!product.isLoose;
  const looseQty = loose ? cart[product.id] || 0 : 0;
  const packAmount = (product.packs ?? []).reduce((s, k) => s + (cart[k.id] || 0) * k.price, 0);
  const looseAmount = loose ? Math.round(((product.perKg ?? 0) * looseQty) / 1000) : 0;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetGrip} />
        <Text style={styles.sheetTitle}>{product.name}</Text>

        {!loose ? (
          <View style={{ gap: 8 }}>
            {(product.packs ?? []).map((k) => {
              const qty = cart[k.id] || 0;
              const leftAfter = k.stock - qty;
              const out = k.stock === 0;
              return (
                <View key={k.id} style={styles.packRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.packSize}>{k.size} · {INR(k.price)}</Text>
                    <Text style={[styles.packStock, leftAfter <= 3 && styles.packStockLow]}>
                      {out ? 'Out of stock' : `${leftAfter} left on the shelf`}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.stepDown} onPress={() => setQty(k.id, qty - 1)}>
                    <Text style={styles.stepGlyph}>–</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepQty}>{qty}</Text>
                  <TouchableOpacity
                    style={styles.stepUp}
                    onPress={() => { if (qty < k.stock) setQty(k.id, qty + 1); }}
                  >
                    <Text style={styles.stepGlyph}>+</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={styles.looseHint}>{INR(product.perKg ?? 0)} per kg · {fmtG(product.stockGrams ?? 0)} in stock</Text>
            <View style={styles.chipGrid}>
              {[100, 250, 500, 1000].map((g) => {
                const on = looseQty === g;
                return (
                  <TouchableOpacity key={g} onPress={() => setQty(product.id, g)} style={[styles.weightChip, on && styles.weightChipOn]}>
                    <Text style={[styles.weightChipText, on && styles.weightChipTextOn]}>{fmtG(g)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.looseStepper}>
              <TouchableOpacity style={styles.looseStep} onPress={() => setQty(product.id, Math.max(0, looseQty - 50))}>
                <Text style={styles.looseStepText}>−50 g</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.looseWeight}>{looseQty ? fmtG(looseQty) : '0 g'}</Text>
                <Text style={styles.looseAmt}>{INR(looseAmount)}</Text>
              </View>
              <TouchableOpacity style={styles.looseStep} onPress={() => setQty(product.id, looseQty + 50)}>
                <Text style={styles.looseStepText}>+50 g</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.addToBill} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.addToBillText}>Add to bill</Text>
          <Text style={styles.addToBillAmt}>{INR(loose ? looseAmount : packAmount)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- Pay method sheet ---------- */
function PaySheet({
  total,
  count,
  onCash,
  onUpi,
  onCredit,
  onCancel,
}: {
  total: number;
  count: number;
  onCash: () => void;
  onUpi: () => void;
  onCredit: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.sheetGrip} />
        <Text style={styles.payCaption}>Bill · {count} {count === 1 ? 'line' : 'lines'}</Text>
        <Text style={styles.payTotal}>{INR(total)}</Text>
        <TouchableOpacity style={styles.payOption} onPress={onCash}><Text style={styles.payOptionText}>Cash</Text></TouchableOpacity>
        <TouchableOpacity style={styles.payOption} onPress={onUpi}><Text style={styles.payOptionText}>UPI QR</Text></TouchableOpacity>
        <TouchableOpacity style={styles.payOption} onPress={onCredit}><Text style={styles.payOptionText}>On credit</Text></TouchableOpacity>
        <TouchableOpacity style={styles.payBack} onPress={onCancel}><Text style={styles.payBackText}>Back</Text></TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- Cash tender ---------- */
function CashScreen({
  total,
  tender,
  setTender,
  busy,
  onBack,
  onConfirm,
}: {
  total: number;
  tender: number | null;
  setTender: (v: number) => void;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const options = tenderOptions(total);
  const change = tender ? tender - total : 0;
  return (
    <View style={styles.fullSheet}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <Text style={styles.fullTitle}>What did they give?</Text>
      <Text style={styles.fullSub}>Bill {INR(total)}</Text>
      <View style={styles.tenderGrid}>
        {options.map((v, i) => {
          const on = tender === v;
          return (
            <TouchableOpacity key={v} onPress={() => setTender(v)} style={[styles.tenderBtn, on && styles.tenderBtnOn]}>
              <Text style={[styles.tenderText, on && styles.tenderTextOn]}>{i === 0 ? `Exact ${INR(v)}` : INR(v)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {tender ? (
        <View style={styles.changeBox}>
          <Text style={styles.changeCaption}>{change === 0 ? 'Exact amount' : 'Give back'}</Text>
          <Text style={styles.changeAmt}>{change === 0 ? 'No change' : INR(change)}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={[styles.confirmBtn, (!tender || busy) && styles.confirmBtnOff]}
        disabled={!tender || busy}
        onPress={onConfirm}
      >
        <Text style={styles.confirmText}>{busy ? '…' : 'Cash received'}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- UPI QR ---------- */
function UpiScreen({
  total,
  settings,
  busy,
  onBack,
  onConfirm,
}: {
  total: number;
  settings: StoreSettings | null;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.fullSheet}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <View style={styles.upiHead}>
        <Text style={styles.fullTitle}>Scan &amp; pay</Text>
        <Text style={styles.upiAmt}>{INR(total)}</Text>
      </View>
      <View style={styles.qrWrap}>
        <UpiQr upiId={settings?.upiId} name={settings?.upiName} amount={total} note="floq bill" />
      </View>
      <Text style={styles.upiNote}>Show this to the customer. Tap below once you see the payment land in your bank app.</Text>
      <TouchableOpacity style={[styles.confirmBtn, busy && styles.confirmBtnOff]} disabled={busy} onPress={onConfirm}>
        <Text style={styles.confirmText}>{busy ? '…' : 'Payment received'}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Credit customer pick ---------- */
function CreditScreen({
  total,
  customers,
  onBack,
  onPick,
}: {
  total: number;
  customers: CreditCustomer[];
  onBack: () => void;
  onPick: (c: CreditCustomer) => void;
}) {
  const sorted = [...customers].sort((a, b) => Number(a.kind === 'SHOP') - Number(b.kind === 'SHOP'));
  return (
    <View style={styles.fullSheet}>
      <TouchableOpacity style={styles.back} onPress={onBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <Text style={styles.fullTitle}>Whose account?</Text>
      <Text style={styles.fullSub}>{INR(total)} goes on their account. They get the bill on WhatsApp.</Text>
      <ScrollView style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
        {sorted.length === 0 ? (
          <Text style={styles.emptyShelf}>No credit customers yet. Add one from the Dues tab.</Text>
        ) : (
          sorted.map((c) => (
            <TouchableOpacity key={c.id} style={styles.custRow} onPress={() => onPick(c)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.custName}>{c.name}</Text>
                <Text style={styles.custKind}>{c.kind === 'SHOP' ? 'Shop' : 'Regular customer'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.custOwesLabel}>Owes</Text>
                <Text style={styles.custOwes}>{INR(c.owes)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/* ---------- Done receipt ---------- */
function DoneScreen({ receipt, onNewBill }: { receipt: Receipt; onNewBill: () => void }) {
  const chip =
    receipt.method === 'CREDIT'
      ? `On credit · ${receipt.customerName}`
      : `Paid · ${receipt.method === 'CASH' ? 'Cash' : 'UPI'}`;
  return (
    <View style={styles.doneSheet}>
      <Text style={[styles.doneChip, receipt.method === 'CREDIT' ? styles.doneChipCredit : styles.doneChipPaid]}>{chip}</Text>
      <Text style={styles.doneTotal}>{INR(receipt.total)}</Text>
      {receipt.change > 0 ? <Text style={styles.doneChange}>Cash received. Give back {INR(receipt.change)}.</Text> : null}
      <View style={styles.doneLines}>
        {receipt.lines.map((l, i) => (
          <View key={i} style={styles.doneLine}>
            <Text style={styles.doneLineQty}>{l.qty}</Text>
            <Text style={styles.doneLineLabel}>{l.label}</Text>
            <Text style={styles.doneLineAmt}>{l.amount}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.doneNote}>
        {receipt.method === 'CREDIT'
          ? `${receipt.customerName} now owes more. The bill went to them on WhatsApp.`
          : 'Stock is updated.'}
      </Text>
      <View style={{ marginTop: 'auto' }}>
        <TouchableOpacity style={styles.newBillBtn} onPress={onNewBill}>
          <Text style={styles.newBillText}>New bill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg },
  todayRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  todayLabel: { fontFamily: fonts.body, fontSize: 13, color: palette.neutral[600] },
  todayValue: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },
  searchRow: { paddingHorizontal: 16, paddingTop: 8 },
  search: { minHeight: 48, backgroundColor: palette.card, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 16, color: palette.ink, borderWidth: 1, borderColor: palette.dividerFaint },
  chips: { maxHeight: 56, flexGrow: 0 },
  chipsInner: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  chip: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: palette.card, marginRight: 6 },
  chipOn: { backgroundColor: palette.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink },
  chipTextOn: { color: palette.bg, fontFamily: fonts.heading, fontWeight: '800' },
  shelf: { flex: 1 },
  emptyShelf: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600], textAlign: 'center', paddingVertical: 40 },
  row: { backgroundColor: palette.card, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowInBill: { borderWidth: 2, borderColor: palette.highlight },
  rowName: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink, lineHeight: 20 },
  rowLocal: { fontSize: 14, color: palette.neutral[600], lineHeight: 18 },
  rowSizes: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600], marginTop: 2 },
  rowPrice: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 18, color: palette.ink },
  lowChip: { fontFamily: fonts.semibold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: palette.accentRamp[100], color: palette.accentRamp[600] },
  billChip: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: palette.highlight, color: palette.onHighlight },
  footer: { backgroundColor: palette.card, borderTopWidth: 1, borderTopColor: palette.surface, padding: 16, gap: 10 },
  footerHint: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  cartLine: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 28 },
  cartQty: { width: 52, fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },
  cartLabel: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: palette.ink },
  cartAmt: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  clearBtn: { minHeight: 60, paddingHorizontal: 16, borderWidth: 1.5, borderColor: palette.surface, justifyContent: 'center' },
  clearText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  chargeBtn: { flex: 1, minHeight: 60, backgroundColor: palette.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  chargeBtnOff: { backgroundColor: palette.surface },
  chargeLabel: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  chargeLabelOff: { color: palette.neutral[600] },
  chargeSub: { fontFamily: fonts.body, fontSize: 13, color: palette.onHighlight },
  chargeTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 28, color: palette.onHighlight },

  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(28,27,26,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.bg, padding: 16, gap: 12 },
  sheetGrip: { width: 40, height: 4, borderRadius: 2, backgroundColor: palette.surface, alignSelf: 'center' },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink },
  packRow: { backgroundColor: palette.card, padding: 10, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  packSize: { fontFamily: fonts.semibold, fontSize: 18, color: palette.ink },
  packStock: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  packStockLow: { color: palette.accentRamp[600], fontFamily: fonts.semibold },
  stepDown: { width: 48, height: 48, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.dividerFaint },
  stepUp: { width: 48, height: 48, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.ink },
  stepQty: { width: 28, textAlign: 'center', fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.ink },
  looseHint: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  chipGrid: { flexDirection: 'row', gap: 6 },
  weightChip: { flex: 1, minHeight: 48, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  weightChipOn: { backgroundColor: palette.ink },
  weightChipText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  weightChipTextOn: { color: palette.bg },
  looseStepper: { backgroundColor: palette.card, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  looseStep: { minWidth: 64, height: 48, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.dividerFaint },
  looseStepText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  looseWeight: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 24, color: palette.ink },
  looseAmt: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  addToBill: { minHeight: 60, backgroundColor: palette.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  addToBillText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  addToBillAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },

  payCaption: { fontFamily: fonts.semibold, fontSize: 14, color: palette.neutral[600] },
  payTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 44, color: palette.ink, letterSpacing: -1 },
  payOption: { minHeight: 72, backgroundColor: palette.card, justifyContent: 'center', paddingHorizontal: 18 },
  payOptionText: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink },
  payBack: { minHeight: 48, justifyContent: 'center' },
  payBackText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.neutral[600] },

  fullSheet: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: palette.bg, padding: 16, gap: 16 },
  back: { minHeight: 44, justifyContent: 'center' },
  backText: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  fullTitle: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 30, color: palette.ink, letterSpacing: -0.5 },
  fullSub: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600] },
  tenderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tenderBtn: { width: '48%', minHeight: 72, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  tenderBtnOn: { backgroundColor: palette.ink },
  tenderText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 22, color: palette.ink },
  tenderTextOn: { color: palette.bg },
  changeBox: { backgroundColor: palette.successBg, padding: 16 },
  changeCaption: { fontFamily: fonts.semibold, fontSize: 14, color: palette.success },
  changeAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 34, color: palette.success },
  confirmBtn: { minHeight: 64, marginTop: 'auto', backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  confirmBtnOff: { backgroundColor: palette.surface },
  confirmText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
  upiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  upiAmt: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 34, color: palette.ink },
  qrWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  upiNote: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600], textAlign: 'center' },

  custRow: { backgroundColor: palette.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  custName: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  custKind: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  custOwesLabel: { fontFamily: fonts.body, fontSize: 14, color: palette.neutral[600] },
  custOwes: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 16, color: palette.ink },

  doneSheet: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: palette.bg, padding: 24, paddingTop: 24, gap: 16 },
  doneChip: { alignSelf: 'flex-start', fontFamily: fonts.semibold, fontSize: 16, paddingHorizontal: 12, paddingVertical: 6 },
  doneChipPaid: { backgroundColor: palette.successBg, color: palette.success },
  doneChipCredit: { backgroundColor: palette.surface, color: palette.ink },
  doneTotal: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 44, color: palette.ink, letterSpacing: -1 },
  doneChange: { fontFamily: fonts.semibold, fontSize: 20, color: palette.ink },
  doneLines: { backgroundColor: palette.card, padding: 14, gap: 8 },
  doneLine: { flexDirection: 'row', gap: 10 },
  doneLineQty: { width: 56, fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  doneLineLabel: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: palette.ink },
  doneLineAmt: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  doneNote: { fontFamily: fonts.body, fontSize: 16, color: palette.neutral[600], lineHeight: 24 },
  newBillBtn: { minHeight: 64, backgroundColor: palette.highlight, alignItems: 'center', justifyContent: 'center' },
  newBillText: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 20, color: palette.onHighlight },
});
