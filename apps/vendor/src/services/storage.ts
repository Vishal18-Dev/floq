import AsyncStorage from '@react-native-async-storage/async-storage';
import { businessDate } from '@floq/utils';
import { Category, Order, Product, Store, StoreSettings } from '@floq/types';

export interface PendingSyncItem {
  id: string;
  storeId: string;
  order: Order;
  payment?: any;
  clientTimestamp: string;
}

const KEYS = {
  PRODUCTS: '@floq/products',
  CATEGORIES: '@floq/categories',
  SETTINGS: '@floq/settings',
  STORE: '@floq/store',
  PENDING_SYNC: '@floq/pending_sync',
  CACHED_ORDERS: '@floq/cached_orders',
  OFFLINE_TICKET_SEQ: '@floq/offline_ticket_seq',
};

export class NativeStorageService {
  /** Last good store + settings, so a cold launch never renders a guessed mode. */
  public static async saveStore(data: { store: Store; settings: StoreSettings | null }): Promise<void> {
    await AsyncStorage.setItem(KEYS.STORE, JSON.stringify(data));
  }

  public static async getStore(): Promise<{ store: Store; settings: StoreSettings | null } | null> {
    const raw = await AsyncStorage.getItem(KEYS.STORE);
    return raw ? JSON.parse(raw) : null;
  }

  // Products Cache
  public static async saveProducts(products: Product[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  }

  public static async getProducts(): Promise<Product[]> {
    const raw = await AsyncStorage.getItem(KEYS.PRODUCTS);
    return raw ? JSON.parse(raw) : [];
  }

  // Categories Cache
  public static async saveCategories(categories: Category[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
  }

  public static async getCategories(): Promise<Category[]> {
    const raw = await AsyncStorage.getItem(KEYS.CATEGORIES);
    return raw ? JSON.parse(raw) : [];
  }

  // Store Settings Cache
  public static async saveSettings(settings: StoreSettings): Promise<void> {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }

  public static async getSettings(): Promise<StoreSettings | null> {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : null;
  }

  // Offline Ticket Sequence Generator (Deterministic & Customer-Visible)
  public static async getNextOfflineTicketNumber(): Promise<string> {
    const today = businessDate();
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_TICKET_SEQ);
    let data = raw ? JSON.parse(raw) : { date: today, seq: 100 };

    if (data.date !== today) {
      data = { date: today, seq: 100 };
    }

    data.seq += 1;
    await AsyncStorage.setItem(KEYS.OFFLINE_TICKET_SEQ, JSON.stringify(data));
    return `#OFF-${data.seq}`;
  }

  // Pending Sync Queue
  public static async enqueuePendingOrder(order: Order, payment?: any): Promise<void> {
    const current = await this.getPendingSyncItems();
    const item: PendingSyncItem = {
      id: order.id,
      storeId: order.storeId,
      order,
      payment,
      clientTimestamp: new Date().toISOString(),
    };
    current.push(item);
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(current));
  }

  public static async getPendingSyncItems(): Promise<PendingSyncItem[]> {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_SYNC);
    return raw ? JSON.parse(raw) : [];
  }

  public static async removeSyncedOrders(syncedIds: string[]): Promise<void> {
    const current = await this.getPendingSyncItems();
    const filtered = current.filter((item) => !syncedIds.includes(item.id));
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(filtered));
  }
}
