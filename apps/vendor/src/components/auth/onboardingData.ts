// Static data, validators and mappers for the self-serve onboarding wizard.
// Kept out of the component so the flow file stays about state + rendering.
import type { SecondaryLanguage } from '../../i18n/strings';

export type OnbLang = SecondaryLanguage; // 'none' = English only

/** Business type → which setup branch and which common catalogue to suggest. */
export type BizType = 'shop' | 'food';
export type ShopKind = 'kirana' | 'natural' | 'dist';
export type FoodKind = 'tea' | 'tiffin' | 'juice' | 'snacks' | 'bakery';

// [id, name, sizes-hint, starting price, unit]. unit drives how it's seeded:
// kg/L → loose by weight/volume, pc → one pack, case → wholesale pack.
export type CatalogEntry = [string, string, string, number, 'kg' | 'L' | 'pc' | 'case'];

export const CATALOG: Record<ShopKind, CatalogEntry[]> = {
  kirana: [
    ['tdal', 'Toor dal', 'Loose · per kg', 150, 'kg'],
    ['sugar', 'Sugar', 'Loose · per kg', 46, 'kg'],
    ['pg', 'Parle-G', '100 g · 250 g', 10, 'pc'],
    ['sfo', 'Sunflower oil', '1 L pouch', 165, 'pc'],
    ['salt', 'Tata salt', '1 kg', 28, 'pc'],
    ['rice', 'Sona masoori rice', 'Loose · per kg', 62, 'kg'],
  ],
  natural: [
    ['vco', 'Virgin coconut oil', '500 ml · 1 L', 320, 'pc'],
    ['gno', 'Cold-pressed groundnut oil', '1 L', 380, 'pc'],
    ['mor', 'Moringa powder', '100 g · 250 g', 120, 'pc'],
    ['jag', 'Jaggery', 'Loose · per kg', 90, 'kg'],
    ['ragi', 'Ragi flour', '1 kg', 70, 'pc'],
    ['hon', 'Forest honey', '250 g · 500 g', 210, 'pc'],
  ],
  dist: [
    ['bch', 'Banana chips 200 g', 'Case of 24', 1680, 'case'],
    ['vco5', 'Coconut oil 500 ml', 'Case of 24', 4320, 'case'],
    ['mor1', 'Moringa powder 100 g', 'Case of 50', 4500, 'case'],
    ['mur', 'Murukku 200 g', 'Case of 30', 1650, 'case'],
    ['tap', 'Tapioca chips 150 g', 'Case of 24', 1200, 'case'],
  ],
};

export const MENUS: Record<FoodKind, [string, number][]> = {
  tea: [['Tea', 12], ['Coffee', 15], ['Lemon tea', 15], ['Bun maska', 25], ['Samosa', 15], ['Biscuit pack', 10]],
  tiffin: [['Idli (2)', 30], ['Plain dosa', 50], ['Masala dosa', 60], ['Vada', 15], ['Pongal', 45], ['Filter coffee', 20]],
  juice: [['Sweet lime', 40], ['Watermelon', 40], ['Banana shake', 50], ['Mango shake', 60], ['Lime soda', 25]],
  snacks: [['Pani puri', 30], ['Bhel puri', 40], ['Samosa chaat', 50], ['Vada pav', 20], ['Pav bhaji', 70]],
  bakery: [['Veg puff', 20], ['Cake slice', 35], ['Butter cookies 250 g', 80], ['Bread', 40], ['Rusk', 50]],
};

/** A kind's unit hint for the opening-stock counter. */
export function unitHint(unit: CatalogEntry[4]): string {
  return unit === 'kg' ? 'in kg' : unit === 'L' ? 'in litres' : unit === 'case' ? 'in cases' : 'in packs';
}

function firstSize(sizes: string): string {
  return sizes.split('·')[0].trim() || 'Each';
}
function caseQty(sizes: string): number | undefined {
  const m = sizes.match(/of\s+(\d+)/i);
  return m ? Number(m[1]) : undefined;
}

export interface SeedItem {
  name: string;
  /** Flat price for a food menu item. */
  price?: number;
  isLoose?: boolean;
  perKg?: number;
  stockKg?: number;
  packs?: { size: string; price: number; stock: number; caseQty?: number }[];
}

/** Turn the picked common-catalogue items + counted stock into seed items. */
export function catalogToSeedItems(kind: ShopKind, picked: string[], stock: Record<string, number>): SeedItem[] {
  return CATALOG[kind]
    .filter(([id]) => picked.includes(id))
    .map(([id, name, sizes, price, unit]) => {
      const qty = stock[id] || 0;
      if (unit === 'kg' || unit === 'L') {
        return { name, isLoose: true, perKg: price, stockKg: qty };
      }
      return { name, packs: [{ size: unit === 'case' ? sizes : firstSize(sizes), price, stock: qty, caseQty: caseQty(sizes) }] };
    });
}

export function menuToSeedItems(rows: { name: string; price: number; on: boolean }[]): SeedItem[] {
  return rows.filter((r) => r.on && r.price > 0).map((r) => ({ name: r.name, price: r.price }));
}

// Validators (mirror the design + backend).
export const isValidPhone = (p: string) => /^[6-9]\d{9}$/.test(p);
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const UPI_RE = /^[a-z0-9._-]{2,}@[a-z]{2,}$/i;

export const fmtPhone = (d: string) => (d.length > 5 ? d.slice(0, 5) + ' ' + d.slice(5) : d);

/** Secondary-language options offered at the welcome step (none = English). */
export const LANG_OPTIONS: { key: OnbLang; label: string }[] = [
  { key: 'none', label: 'English' },
  { key: 'hi', label: 'हिन्दी' },
  { key: 'ta', label: 'தமிழ்' },
  { key: 'mr', label: 'मराठी' },
];

// Local-language lines for the chrome. Missing keys simply show no local line
// (matches the app's bilingual pattern). English-only ('none') shows nothing.
type LocalMap = Record<string, string>;
export const LOCAL: Partial<Record<OnbLang, LocalMap>> = {
  hi: {
    welcome: 'आपके काउंटर के लिए बिल, स्टॉक और पैसा।',
    phone: 'अपना मोबाइल नंबर डालें',
    otp: 'कोड डालें',
    profile: 'आपका और दुकान का नाम',
    type: 'आप क्या चलाते हैं?',
    pay: 'पैसे कैसे लेंगे?',
    team: 'और कौन काम करता है?',
    done: 'सब तैयार है',
    next: 'आगे बढ़ें',
  },
  ta: {
    welcome: 'உங்கள் கவுண்டருக்கு பில், ஸ்டாக், பணம்.',
    phone: 'உங்கள் மொபைல் எண்',
    otp: 'குறியீட்டை உள்ளிடவும்',
    profile: 'உங்கள் பெயர் மற்றும் கடை பெயர்',
    type: 'நீங்கள் என்ன நடத்துகிறீர்கள்?',
    pay: 'பணம் எப்படி பெறுவீர்கள்?',
    team: 'வேறு யார் வேலை செய்கிறார்கள்?',
    done: 'எல்லாம் தயார்',
    next: 'தொடரவும்',
  },
  mr: {
    welcome: 'तुमच्या काउंटरसाठी बिल, स्टॉक आणि पैसे.',
    phone: 'तुमचा मोबाइल नंबर टाका',
    otp: 'कोड टाका',
    profile: 'तुमचे आणि दुकानाचे नाव',
    type: 'तुम्ही काय चालवता?',
    pay: 'पैसे कसे घेणार?',
    team: 'आणखी कोण काम करते?',
    done: 'सर्व तयार आहे',
    next: 'पुढे चला',
  },
};

export function local(lang: OnbLang, key: string): string {
  if (lang === 'none') return '';
  return LOCAL[lang]?.[key] || '';
}
