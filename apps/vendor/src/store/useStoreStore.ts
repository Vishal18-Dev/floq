import { create } from 'zustand';
import { Store, StoreSettings } from '@floq/types';
import { api } from '../services/api';

interface StoreState {
  store: Store | null;
  settings: StoreSettings | null;
  isLoading: boolean;
  error: string | null;
  loadStore: () => Promise<void>;
  updateSettings: (updates: Partial<StoreSettings>) => Promise<void>;
}

export const useStoreStore = create<StoreState>((set) => ({
  store: null,
  settings: null,
  isLoading: false,
  error: null,

  loadStore: async () => {
    try {
      set({ isLoading: true, error: null });
      const data = await api.getCurrentStore();
      set({ store: data.store, settings: data.settings, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to load store' });
    }
  },

  updateSettings: async (updates: Partial<StoreSettings>) => {
    try {
      const res = await api.updateStoreSettings(updates);
      set({ settings: res.settings });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update store settings' });
      throw err;
    }
  },
}));
