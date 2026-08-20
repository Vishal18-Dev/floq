import { OrderStatus, PaymentStatus, ProductStation, StoreType, VoiceLanguage } from '@floq/types';

export interface StoreTemplateProduct {
  name: string;
  category: string;
  price: number;
  description?: string;
  station: ProductStation;
  imageUrl?: string;
}

export interface StoreTemplate {
  storeType: StoreType;
  name: string;
  tagline: string;
  categories: string[];
  products: StoreTemplateProduct[];
}

export const STORE_TEMPLATES: Record<string, StoreTemplate> = {
  SHARMA_BREAKFAST_CORNER: {
    storeType: 'BREAKFAST',
    name: 'Sharma Breakfast Corner',
    tagline: 'Fresh & Hot Breakfast Since 1998',
    categories: ['Beverages', 'Hot Breakfast', 'Snacks'],
    products: [
      { name: 'Special Masala Chai', category: 'Beverages', price: 15, station: 'BEVERAGE', description: 'Freshly brewed ginger-cardamom tea' },
      { name: 'Filter Coffee', category: 'Beverages', price: 25, station: 'BEVERAGE', description: 'South Indian degree filter coffee' },
      { name: 'Indori Poha', category: 'Hot Breakfast', price: 30, station: 'HOT_FOOD', description: 'Steamed poha with crunchy sev & lemon' },
      { name: 'Rava Upma', category: 'Hot Breakfast', price: 35, station: 'HOT_FOOD', description: 'Semolina upma with roasted cashews & curry leaves' },
      { name: 'Batata Vada Pav', category: 'Snacks', price: 25, station: 'HOT_FOOD', description: 'Mumbai style spicy potato vada in soft pav' },
      { name: 'Kolhapuri Misal Pav', category: 'Hot Breakfast', price: 50, station: 'HOT_FOOD', description: 'Spicy sprouted curry with farsan & 2 pav' },
      { name: 'Toasted Veg Sandwich', category: 'Snacks', price: 60, station: 'GRILL', description: 'Cucumber, tomato, mint chutney grilled sandwich' },
      { name: 'Bun Maska', category: 'Snacks', price: 35, station: 'BAKERY', description: 'Soft sweet bun loaded with rich Amul butter' },
      { name: 'Chilled Bottled Water', category: 'Beverages', price: 20, station: 'PACKAGED', description: '1L packaged drinking water' },
    ],
  },
  TEA_STALL: {
    storeType: 'TEA_STALL',
    name: 'Apna Chai Adda',
    tagline: 'Cutting Chai & Quick Bites',
    categories: ['Chai & Coffee', 'Snacks', 'Cold Drinks'],
    products: [
      { name: 'Cutting Chai', category: 'Chai & Coffee', price: 12, station: 'BEVERAGE' },
      { name: 'Special Adrak Chai', category: 'Chai & Coffee', price: 15, station: 'BEVERAGE' },
      { name: 'Filter Coffee', category: 'Chai & Coffee', price: 25, station: 'BEVERAGE' },
      { name: 'Bun Maska', category: 'Snacks', price: 30, station: 'BAKERY' },
      { name: 'Maska Khari (2 pcs)', category: 'Snacks', price: 20, station: 'BAKERY' },
      { name: 'Samosa (1 pc)', category: 'Snacks', price: 18, station: 'HOT_FOOD' },
      { name: 'Vada Pav', category: 'Snacks', price: 20, station: 'HOT_FOOD' },
      { name: 'Bisleri Water 500ml', category: 'Cold Drinks', price: 10, station: 'PACKAGED' },
    ],
  },
  JUICE_CORNER: {
    storeType: 'JUICE',
    name: 'Green Oasis Fresh Juice',
    tagline: '100% Pure & Freshly Squeezed',
    categories: ['Fresh Juices', 'Milkshakes', 'Detox Specials'],
    products: [
      { name: 'Mosambi Sweet Lime', category: 'Fresh Juices', price: 50, station: 'BEVERAGE' },
      { name: 'Nagpur Orange Juice', category: 'Fresh Juices', price: 60, station: 'BEVERAGE' },
      { name: 'Alphonso Mango Shake', category: 'Milkshakes', price: 70, station: 'BEVERAGE' },
      { name: 'Cold Coffee with Ice Cream', category: 'Milkshakes', price: 60, station: 'BEVERAGE' },
      { name: 'Fresh Watermelon Juice', category: 'Fresh Juices', price: 45, station: 'BEVERAGE' },
      { name: 'ABC Detox (Apple Beetroot Carrot)', category: 'Detox Specials', price: 80, station: 'BEVERAGE' },
      { name: 'Tender Coconut Water', category: 'Fresh Juices', price: 55, station: 'BEVERAGE' },
    ],
  },
  FOOD_STALL_CHAAT: {
    storeType: 'FOOD_STALL',
    name: 'Chatpata Chaat House',
    tagline: 'Authentic Street Chaat & Fast Bites',
    categories: ['Chaat Special', 'Pav Bhaji', 'Beverages'],
    products: [
      { name: 'Pani Puri (6 pcs)', category: 'Chaat Special', price: 40, station: 'HOT_FOOD' },
      { name: 'Sev Puri', category: 'Chaat Special', price: 50, station: 'HOT_FOOD' },
      { name: 'Dahi Puri', category: 'Chaat Special', price: 60, station: 'HOT_FOOD' },
      { name: 'Butter Pav Bhaji', category: 'Pav Bhaji', price: 90, station: 'GRILL' },
      { name: 'Cheese Pav Bhaji', category: 'Pav Bhaji', price: 120, station: 'GRILL' },
      { name: 'Bhel Puri', category: 'Chaat Special', price: 45, station: 'HOT_FOOD' },
      { name: 'Masala Chaas (Spiced Buttermilk)', category: 'Beverages', price: 20, station: 'BEVERAGE' },
    ],
  },
  BAKERY_CAFE: {
    storeType: 'BAKERY',
    name: 'Crumb & Crust Bakery',
    tagline: 'Artisan Bakes & Fresh Coffee',
    categories: ['Bakes & Puffs', 'Pastries', 'Espresso Bar'],
    products: [
      { name: 'Crispy Veg Puff', category: 'Bakes & Puffs', price: 25, station: 'BAKERY' },
      { name: 'Paneer Tikka Puff', category: 'Bakes & Puffs', price: 35, station: 'BAKERY' },
      { name: 'Hot Cappuccino', category: 'Espresso Bar', price: 80, station: 'BEVERAGE' },
      { name: 'Café Latte', category: 'Espresso Bar', price: 90, station: 'BEVERAGE' },
      { name: 'Dutch Chocolate Brownie', category: 'Pastries', price: 65, station: 'BAKERY' },
      { name: 'Red Velvet Pastry', category: 'Pastries', price: 75, station: 'BAKERY' },
    ],
  },
};

// Strict Order State Machine Transitions
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Completed orders cannot jump back to preparing without explicit reopen
  CANCELLED: [],
};

// Strict Payment State Machine Transitions
export const ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['SUCCESS', 'FAILED', 'REFUNDED'],
  SUCCESS: ['REFUNDED'],
  FAILED: ['PENDING'],
  REFUNDED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New Order',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready for Pickup',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border: string; badge: string }
> = {
  NEW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-600' },
  ACCEPTED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-600' },
  PREPARING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-500' },
  READY: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600' },
  COMPLETED: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-500' },
  CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-600' },
};

// Multilingual Voice Phrase Generators
export const VOICE_TEMPLATES = {
  'en-IN': {
    newOrder: (ticket: string, itemsSummary: string) => `Token ${ticket}. ${itemsSummary}.`,
    ready: (ticket: string) => `Token ${ticket} is ready.`,
    delayed: (ticket: string, minutes: number) => `Token ${ticket} has been waiting for ${minutes} minutes.`,
  },
  'hi-IN': {
    newOrder: (ticket: string, itemsSummary: string) => `टोकन ${ticket}. ${itemsSummary}.`,
    ready: (ticket: string) => `टोकन ${ticket} तैयार है.`,
    delayed: (ticket: string, minutes: number) => `टोकन ${ticket} को ${minutes} मिनट हो गए हैं.`,
  },
  'mr-IN': {
    newOrder: (ticket: string, itemsSummary: string) => `टोकन ${ticket}. ${itemsSummary}.`,
    ready: (ticket: string) => `टोकन ${ticket} तयार आहे.`,
    delayed: (ticket: string, minutes: number) => `टोकन ${ticket} ला ${minutes} मिनिटे झाली आहेत.`,
  },
};
