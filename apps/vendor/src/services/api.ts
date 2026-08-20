import { Platform } from 'react-native';
import {
  Category,
  DailySalesSummary,
  Order,
  OrderStatus,
  Product,
  Store,
  StoreSettings,
  SyncPayload,
  SyncResult,
  UserSession,
} from '@floq/types';
import Constants from 'expo-constants';
import { CreateOrderInput } from '@floq/validation';

// Resolve host IP dynamically from Expo Go developer module or fallback
const getBaseHost = () => {
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.developerModuleHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:4000`;
    }
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
};

const API_BASE = `${getBaseHost()}/api`;

class NativeApiClient {
  private authToken: string | null = null;
  private merchantId: string = 'merchant_sharma_01';
  private storeId: string = 'store_sharma_01';
  private baseUrl: string = API_BASE;
  private onUnauthorizedCallback?: () => void;

  public setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  public setUnauthorizedCallback(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  public setStoreContext(merchantId: string, storeId: string) {
    this.merchantId = merchantId;
    this.storeId = storeId;
  }

  public getStoreId(): string {
    return this.storeId;
  }

  public getMerchantId(): string {
    return this.merchantId;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-store-id': this.storeId,
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (res.status === 401) {
        if (this.onUnauthorizedCallback && !endpoint.includes('/auth/')) {
          this.onUnauthorizedCallback();
        }
        let errBody: any;
        try { errBody = await res.json(); } catch { errBody = { message: 'Unauthorized session' }; }
        throw new Error(errBody.message || 'Session expired. Please log in again.');
      }

      if (!res.ok) {
        let errBody: any;
        try {
          errBody = await res.json();
        } catch {
          errBody = { message: res.statusText };
        }
        throw new Error(errBody.message || `API error (${res.status})`);
      }

      return res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Auth Methods (P0-1)
  public async requestOTP(phone: string): Promise<{ success: boolean; message: string; isMock: boolean }> {
    return this.request('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  public async verifyOTP(phone: string, otp: string): Promise<UserSession> {
    const session: UserSession = await this.request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
    this.setAuthToken(session.token);
    if (session.storeIds && session.storeIds[0]) {
      this.setStoreContext(session.merchantId, session.storeIds[0]);
    }
    return session;
  }

  public async getProfile(): Promise<any> {
    return this.request('/auth/me');
  }

  // Store & Catalog
  public async getCurrentStore(): Promise<{
    store: Store;
    settings: StoreSettings | null;
    staff: any[];
    devices: any[];
  }> {
    return this.request('/stores/current');
  }

  public async updateStoreSettings(settings: Partial<StoreSettings>): Promise<{ settings: StoreSettings }> {
    return this.request('/stores/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  public async applyTemplate(templateKey: string): Promise<{ success: boolean; message: string }> {
    return this.request('/stores/apply-template', {
      method: 'POST',
      body: JSON.stringify({ templateKey }),
    });
  }

  public async getCatalog(): Promise<{ categories: Category[]; products: Product[] }> {
    return this.request('/products');
  }

  public async createProduct(product: Partial<Product>): Promise<{ product: Product }> {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<{ product: Product }> {
    return this.request(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  public async deleteProduct(id: string): Promise<{ success: boolean }> {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  public async getOrders(status?: OrderStatus): Promise<{ orders: Order[] }> {
    const query = status ? `?status=${status}` : '';
    return this.request(`/orders${query}`);
  }

  public async createOrder(data: CreateOrderInput): Promise<{ order: Order }> {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateOrderStatus(id: string, status: OrderStatus, reason?: string): Promise<{ order: Order }> {
    return this.request(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  public async getDailyAnalytics(date?: string): Promise<DailySalesSummary> {
    const query = date ? `?date=${date}` : '';
    return this.request(`/analytics/daily${query}`);
  }

  public async syncOfflineRecords(payload: SyncPayload): Promise<SyncResult> {
    return this.request('/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async simulateCustomerQROrder(slug: string, items: { productId: string; quantity: number }[]): Promise<any> {
    const res = await fetch(`${this.baseUrl}/public/stores/${slug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        customerName: 'Customer @ Counter',
      }),
    });
    return res.json();
  }
}

export const api = new NativeApiClient();
