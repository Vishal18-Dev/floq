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
}));
