import { create } from 'zustand';
import { CreditCustomer } from '@floq/types';
import { api } from '../services/api';

interface CustomersState {
  customers: CreditCustomer[];
  isLoading: boolean;
  loadCustomers: () => Promise<void>;
  /** Optimistically charge a credit sale to an account (the server has already
   *  recorded it via the order); keeps Dues in sync without a reload. */
  applyCharge: (customerId: string, amount: number) => void;
  /** Settle a balance — calls the API, then updates locally. */
  markPaid: (customerId: string) => Promise<void>;
  addCustomer: (data: { name: string; kind: 'SHOP' | 'REGULAR'; phone?: string; creditLimit?: number }) => Promise<CreditCustomer>;
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: [],
  isLoading: false,

  loadCustomers: async () => {
    try {
      set({ isLoading: true });
      const res = await api.getCustomers();
      set({ customers: res.customers, isLoading: false });
    } catch {
      // Offline/error: keep whatever we have; screens render an honest empty state.
      set({ isLoading: false });
    }
  },

  applyCharge: (customerId, amount) => {
    set((s) => ({
      customers: s.customers.map((c) =>
        c.id === customerId
          ? { ...c, owes: c.owes + amount, oldestDueAt: c.owes > 0 ? c.oldestDueAt : new Date().toISOString() }
          : c
      ),
    }));
  },

  markPaid: async (customerId) => {
    // Optimistic: clear the balance now, roll back if the server rejects.
    const prev = get().customers;
    set({ customers: prev.map((c) => (c.id === customerId ? { ...c, owes: 0, oldestDueAt: undefined } : c)) });
    try {
      const res = await api.markCustomerPaid(customerId);
      set((s) => ({ customers: s.customers.map((c) => (c.id === customerId ? res.customer : c)) }));
    } catch {
      set({ customers: prev });
      throw new Error('Could not record the payment');
    }
  },

  addCustomer: async (data) => {
    const res = await api.createCustomer(data);
    set((s) => ({ customers: [...s.customers, res.customer] }));
    return res.customer;
  },
}));
