import { create } from 'zustand';
import { Category, DailySalesSummary, Product } from '@floq/types';
import { api } from '../services/api';
import { NativeStorageService } from '../services/storage';

interface CatalogState {
  products: Product[];
  categories: Category[];
  dailySummary: DailySalesSummary | null;
  carriedOverTokens: number;
  isLoading: boolean;
  loadCatalog: () => Promise<void>;
  loadAnalytics: () => Promise<void>;
  loadDayStatus: () => Promise<void>;
  refreshAnalytics: () => void;
  saveProduct: (data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleAvailability: (id: string, isAvailable: boolean) => Promise<void>;
  /** Decrement live stock after a sale/shop order — pack units or loose grams
   *  by SKU key — so the shelf reflects it instantly (the server already did). */
  applyStockReduction: (items: { key: string; qty: number; loose: boolean }[]) => void;
  /** Add received stock back (Stock-arrived flow). */
  applyStockReceipt: (items: { key: string; qty: number; loose: boolean }[]) => void;
}

// Shared stock mutator: `sign` is -1 to sell, +1 to receive.
function mutateStock(products: Product[], items: { key: string; qty: number; loose: boolean }[], sign: number): Product[] {
  if (!items.length) return products;
  return products.map((p) => {
    const looseHit = items.find((i) => i.loose && i.key === p.id);
    if (looseHit) {
      return { ...p, stockGrams: Math.max(0, (p.stockGrams ?? 0) + sign * looseHit.qty) };
    }
    if (p.packs?.some((k) => items.some((i) => !i.loose && i.key === k.id))) {
      return {
        ...p,
        packs: p.packs.map((k) => {
          const hit = items.find((i) => !i.loose && i.key === k.id);
          return hit ? { ...k, stock: Math.max(0, k.stock + sign * hit.qty) } : k;
        }),
      };
    }
    return p;
  });
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  categories: [],
  dailySummary: null,
  carriedOverTokens: 0,
  isLoading: false,

  loadCatalog: async () => {
    try {
      set({ isLoading: true });
      const res = await api.getCatalog();
      set({ products: res.products, categories: res.categories, isLoading: false });
      // Cache for offline launch.
      NativeStorageService.saveProducts(res.products).catch(() => {});
      NativeStorageService.saveCategories(res.categories).catch(() => {});
    } catch {
      // Offline / error → hydrate from cache. Real cache or empty; never demo data.
      const [cachedProds, cachedCats] = await Promise.all([
        NativeStorageService.getProducts(),
        NativeStorageService.getCategories(),
      ]);
      set({ products: cachedProds, categories: cachedCats, isLoading: false });
    }
  },

  loadAnalytics: async () => {
    try {
      const summary = await api.getDailyAnalytics();
      set({ dailySummary: summary });
    } catch {
      /* leave prior summary; screens render honest zeros when null */
    }
  },

  loadDayStatus: async () => {
    try {
      const s = await api.getDayStatus();
      set({ carriedOverTokens: s.carriedOverTokens });
    } catch {
      /* ignore */
    }
  },

  refreshAnalytics: () => {
    get().loadAnalytics();
  },

  saveProduct: async (data: Partial<Product>) => {
    if (data.id) {
      const res = await api.updateProduct(data.id, data);
      set((s) => ({ products: s.products.map((p) => (p.id === data.id ? res.product : p)) }));
    } else {
      const res = await api.createProduct(data);
      set((s) => ({ products: [...s.products, res.product] }));
    }
  },

  deleteProduct: async (id: string) => {
    await api.deleteProduct(id);
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
  },

  toggleAvailability: async (id: string, isAvailable: boolean) => {
    // Optimistic — the counter must feel instant.
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, isAvailable } : p)) }));
    try {
      await api.setProductAvailability(id, isAvailable);
    } catch {
      set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, isAvailable: !isAvailable } : p)) }));
    }
  },

  applyStockReduction: (items) => set((s) => ({ products: mutateStock(s.products, items, -1) })),
  applyStockReceipt: (items) => set((s) => ({ products: mutateStock(s.products, items, +1) })),
}));
