import { create } from 'zustand';
import { Order, OrderStatus } from '@floq/types';
import { api } from '../services/api';

interface OrdersState {
  orders: Order[];
  filterStatus: OrderStatus | 'ALL';
  isLoading: boolean;
  error: string | null;
  loadOrders: () => Promise<void>;
  setFilterStatus: (status: OrderStatus | 'ALL') => void;
  updateOrderStatus: (id: string, status: OrderStatus, reason?: string) => Promise<void>;
  upsertOrder: (order: Order) => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  filterStatus: 'ALL',
  isLoading: false,
  error: null,

  setFilterStatus: (status) => {
    set({ filterStatus: status });
    get().loadOrders();
  },

  loadOrders: async () => {
    try {
      set({ isLoading: true, error: null });
      const statusArg = get().filterStatus === 'ALL' ? undefined : (get().filterStatus as OrderStatus);
      const res = await api.getOrders(statusArg);
      set({ orders: res.orders, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to load orders' });
    }
  },

  updateOrderStatus: async (id: string, status: OrderStatus, reason?: string) => {
    try {
      const res = await api.updateOrderStatus(id, status, reason);
      get().upsertOrder(res.order);
    } catch (err: any) {
      set({ error: err.message || 'Failed to update order status' });
      throw err;
    }
  },

  upsertOrder: (incomingOrder: Order) => {
    set((state) => {
      const idx = state.orders.findIndex((o) => o.id === incomingOrder.id);
      if (idx >= 0) {
        const next = [...state.orders];
        next[idx] = incomingOrder;
        return { orders: next };
      } else {
        return { orders: [incomingOrder, ...state.orders] };
      }
    });
  },
}));
