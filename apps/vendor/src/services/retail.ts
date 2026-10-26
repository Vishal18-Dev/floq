/**
 * Retail economics — the shop brain, ported from the floq Retail design's
 * reference logic. Pure functions over the catalogue (products with packs or
 * loose goods) and the credit book, shared by the Sell, Dues, Stock, Shop-order
 * and Day screens. No React, no stores — just numbers in, numbers out.
 */
import { Product, ProductPack, CreditCustomer } from '@floq/types';
import { formatINR } from '@floq/utils';

/** Money, rounded to whole rupees like the design (₹1,234). */
export const INR = (n: number): string => formatINR(Math.round(n || 0));

/** Weight label for loose goods: grams under 1 kg, kg above. */
export const fmtG = (g: number): string =>
  g >= 1000 ? `${(g / 1000).toLocaleString('en-IN')} kg` : `${g} g`;

/**
 * A sellable SKU: a pack of a packed product, or a loose product as a whole.
 * `stock`/`daily` are in units for packs and in grams for loose goods, so
 * days-left is always `stock / daily`.
 */
export interface Entry {
  key: string; // pack id, or product id for loose
  product: Product;
  pack?: ProductPack;
  loose: boolean;
  name: string;
  stock: number;
  daily: number;
}

/** Flatten the catalogue into sellable SKUs. */
export function entries(products: Product[]): Entry[] {
  const out: Entry[] = [];
  for (const p of products) {
    if (p.isLoose) {
      out.push({ key: p.id, product: p, loose: true, name: p.name, stock: p.stockGrams ?? 0, daily: p.dailyGrams ?? 0 });
    } else {
      for (const k of p.packs ?? []) {
        out.push({ key: k.id, product: p, pack: k, loose: false, name: `${p.name} ${k.size}`, stock: k.stock, daily: k.dailyRate });
      }
    }
  }
  return out;
}

export function entryByKey(products: Product[], key: string): Entry | undefined {
  return entries(products).find((e) => e.key === key);
}

/** Whole days of cover left at the recent sales pace (0 if we have no rate). */
export function daysLeft(e: Entry): number {
  if (!e.daily || e.daily <= 0) return 999;
  return Math.floor(e.stock / e.daily);
}

export type Cart = Record<string, number>; // key -> qty (units for packs, grams for loose)

export interface CartLine {
  key: string;
  entry: Entry;
  qty: number;
  qtyLabel: string;
  label: string;
  amount: number;
  cost: number;
}

/** Resolve the cart into priced lines. `wholesale` prices packs at their
 *  wholesale price (shop orders); walk-in bills pass false. */
export function cartLines(products: Product[], cart: Cart, wholesale = false): CartLine[] {
  const all = entries(products);
  return Object.keys(cart)
    .filter((k) => cart[k] > 0)
    .map((key) => {
      const e = all.find((x) => x.key === key)!;
      const q = cart[key];
      if (!e) return null;
      if (e.loose) {
        const amount = Math.round(((e.product.perKg ?? 0) * q) / 1000);
        return { key, entry: e, qty: q, qtyLabel: fmtG(q), label: e.product.name.replace(' (loose)', ''), amount, cost: Math.round(amount * 0.7) };
      }
      const k = e.pack!;
      const unit = wholesale ? k.wholesalePrice ?? k.price : k.price;
      return { key, entry: e, qty: q, qtyLabel: `${q}×`, label: e.name, amount: unit * q, cost: (k.costPrice ?? 0) * q };
    })
    .filter(Boolean) as CartLine[];
}

export const cartTotal = (lines: CartLine[]): number => lines.reduce((s, l) => s + l.amount, 0);
export const cartProfit = (lines: CartLine[]): number => lines.reduce((s, l) => s + (l.amount - l.cost), 0);
export const cartCount = (cart: Cart): number => Object.keys(cart).filter((k) => cart[k] > 0).length;

/** Cash tender suggestions: exact, then round up to ₹100 / ₹500 / a note. */
export function tenderOptions(total: number): number[] {
  const out: number[] = [];
  [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 2000].forEach((v) => {
    if (v >= total && v > 0 && !out.includes(v) && out.length < 4) out.push(v);
  });
  while (out.length < 4 && total > 0) out.push(out[out.length - 1] + 500);
  return out;
}

/** Reorder suggestion to refill ~2 weeks of cover, in cases (packs) or kg (loose). */
export function reorderSuggest(e: Entry): { n: number; unit: 'case' | 'kg' } {
  if (e.loose) return { n: Math.max(5, Math.ceil((e.daily * 14 - e.stock) / 1000)), unit: 'kg' };
  const caseQty = e.pack?.caseQty ?? 1;
  return { n: Math.max(1, Math.ceil((e.daily * 14 - e.stock) / caseQty)), unit: 'case' };
}

/** Age in whole days of a customer's oldest unpaid charge. */
export function customerDays(c: CreditCustomer): number {
  if (c.owes <= 0 || !c.oldestDueAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(c.oldestDueAt).getTime()) / 86400000));
}

export const isOverdue = (c: CreditCustomer): boolean => c.owes > 0 && customerDays(c) > 30;
