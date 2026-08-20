import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  Category,
  DailySalesSummary,
  Order,
  OrderStatus,
  Product,
  Store,
  StoreSettings,
} from '@floq/types';
import { Header } from './components/layout/Header';
import { BottomNav, TabType } from './components/layout/BottomNav';
import { SellScreen } from './components/sell/SellScreen';
import { OrdersScreen } from './components/orders/OrdersScreen';
import { LiveQueueScreen } from './components/queue/LiveQueueScreen';
import { BusinessScreen } from './components/business/BusinessScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { DemoDrawer } from './components/demo/DemoDrawer';
import { CustomerSimulator } from './components/demo/CustomerSimulator';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { CartItem } from './components/sell/LiveCart';
import { api } from './services/api';
import { NativeStorageService } from './services/storage';
import { syncEngine } from './services/sync';
import { voiceService, VoiceConfig } from './services/voice';
import { HapticFeedback } from './services/haptics';

import { LoginScreen } from './components/auth/LoginScreen';
import { useAuthStore } from './store/useAuthStore';
import { realtimeClient } from './services/realtimeClient';

const DEFAULT_STORE: Store = {
  id: 'store_sharma_01',
  merchantId: 'merchant_sharma_01',
  name: 'Sharma Breakfast Corner',
  slug: 'sharma-breakfast-corner',
  storeType: 'BREAKFAST',
  timezone: 'Asia/Kolkata',
  status: 'ACTIVE',
  address: 'Shop 4, Station Road, Andheri West',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DEFAULT_SETTINGS: StoreSettings = {
  id: 'sett_01',
  storeId: 'store_sharma_01',
  upiId: 'sharma.stall@okhdfcbank',
  upiName: 'Sharma Breakfast Corner',
  voiceEnabled: true,
  voiceLanguage: 'en-IN',
  voiceVerbosity: 'BRIEF',
  typicalPrepTimeMinutes: 6,
  ticketPrefix: '#',
  autoAcceptQrOrders: true,
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_bev', storeId: 'store_sharma_01', name: 'Beverages', sortOrder: 1, isActive: true, createdAt: new Date().toISOString() },
  { id: 'cat_bfast', storeId: 'store_sharma_01', name: 'Hot Breakfast', sortOrder: 2, isActive: true, createdAt: new Date().toISOString() },
  { id: 'cat_snack', storeId: 'store_sharma_01', name: 'Snacks', sortOrder: 3, isActive: true, createdAt: new Date().toISOString() },
];

const DEFAULT_PRODUCTS: Product[] = [
  { id: 'p_1', storeId: 'store_sharma_01', categoryId: 'cat_bev', name: 'Special Masala Chai', price: 15, isAvailable: true, sortOrder: 1, station: 'BEVERAGE', description: 'Freshly brewed ginger-cardamom tea', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p_2', storeId: 'store_sharma_01', categoryId: 'cat_bev', name: 'Filter Coffee', price: 25, isAvailable: true, sortOrder: 2, station: 'BEVERAGE', description: 'South Indian degree filter coffee', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p_3', storeId: 'store_sharma_01', categoryId: 'cat_bfast', name: 'Indori Poha', price: 30, isAvailable: true, sortOrder: 3, station: 'HOT_FOOD', description: 'Steamed poha with crunchy sev & lemon', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p_4', storeId: 'store_sharma_01', categoryId: 'cat_bfast', name: 'Rava Upma', price: 35, isAvailable: true, sortOrder: 4, station: 'HOT_FOOD', description: 'Semolina upma with roasted cashews & curry leaves', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p_5', storeId: 'store_sharma_01', categoryId: 'cat_snack', name: 'Batata Vada Pav', price: 25, isAvailable: true, sortOrder: 5, station: 'HOT_FOOD', description: 'Mumbai style spicy potato vada in soft pav', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p_6', storeId: 'store_sharma_01', categoryId: 'cat_bfast', name: 'Kolhapuri Misal Pav', price: 50, isAvailable: true, sortOrder: 6, station: 'HOT_FOOD', description: 'Spicy sprouted curry with farsan & 2 pav', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p_7', storeId: 'store_sharma_01', categoryId: 'cat_snack', name: 'Toasted Veg Sandwich', price: 60, isAvailable: true, sortOrder: 7, station: 'GRILL', description: 'Cucumber, tomato, mint chutney grilled sandwich', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'p_8', storeId: 'store_sharma_01', categoryId: 'cat_snack', name: 'Bun Maska', price: 35, isAvailable: true, sortOrder: 8, station: 'BAKERY', description: 'Soft sweet bun loaded with rich Amul butter', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export default function App() {
  const { isAuthenticated, isLoading: isAuthLoading, restoreSession } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('SELL');
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Store & Settings
  const [store, setStore] = useState<Store | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);

  // Menu Catalog
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Orders & Analytics
  const [orders, setOrders] = useState<Order[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySalesSummary | null>(null);

  // Connectivity & Sync
  const [isOnline, setIsOnline] = useState(true);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Voice Config
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(voiceService.getConfig());

  // Demo Modals
  const [isDemoDrawerOpen, setIsDemoDrawerOpen] = useState(false);
  const [isCustomerSimOpen, setIsCustomerSimOpen] = useState(false);

  // Load store data when authenticated
  const loadStoreData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      if (syncEngine.isOnline()) {
        const [storeRes, catalogRes, ordersRes, analyticsRes] = await Promise.all([
          api.getCurrentStore(),
          api.getCatalog(),
          api.getOrders(),
          api.getDailyAnalytics(),
        ]);

        setStore(storeRes.store || DEFAULT_STORE);
        setSettings(storeRes.settings || DEFAULT_SETTINGS);
        setStaff(storeRes.staff || []);
        setDevices(storeRes.devices || []);

        setCategories(catalogRes.categories.length > 0 ? catalogRes.categories : DEFAULT_CATEGORIES);
        setProducts(catalogRes.products.length > 0 ? catalogRes.products : DEFAULT_PRODUCTS);
        setOrders(ordersRes.orders || []);
        setDailySummary(analyticsRes);

        // Cache locally in AsyncStorage
        await Promise.all([
          NativeStorageService.saveProducts(catalogRes.products),
          NativeStorageService.saveCategories(catalogRes.categories),
          storeRes.settings ? NativeStorageService.saveSettings(storeRes.settings) : Promise.resolve(),
        ]);
      } else {
        // Hydrate from native cache
        const [cachedProds, cachedCats, cachedSetts] = await Promise.all([
          NativeStorageService.getProducts(),
          NativeStorageService.getCategories(),
          NativeStorageService.getSettings(),
        ]);
        setProducts(cachedProds.length > 0 ? cachedProds : DEFAULT_PRODUCTS);
        setCategories(cachedCats.length > 0 ? cachedCats : DEFAULT_CATEGORIES);
        setSettings(cachedSetts || DEFAULT_SETTINGS);
        setStore(DEFAULT_STORE);
      }
    } catch {
      // Offline / Connection error fallback
      const [cachedProds, cachedCats] = await Promise.all([
        NativeStorageService.getProducts(),
        NativeStorageService.getCategories(),
      ]);
      setProducts(cachedProds.length > 0 ? cachedProds : DEFAULT_PRODUCTS);
      setCategories(cachedCats.length > 0 ? cachedCats : DEFAULT_CATEGORIES);
      setSettings(DEFAULT_SETTINGS);
      setStore(DEFAULT_STORE);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStoreData();
    }
  }, [isAuthenticated, loadStoreData]);

  // Subscribe to Realtime SSE events when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    realtimeClient.setReconnectedCallback(() => {
      loadStoreData();
    });

    const unsubscribe = realtimeClient.subscribe((event) => {
      if (event.type === 'ORDER_CREATED' && event.order) {
        const newOrd: Order = event.order;
        setOrders((prev) => [newOrd, ...prev.filter((o) => o.id !== newOrd.id)]);
      } else if (event.type === 'ORDER_UPDATED' && event.order) {
        const updatedOrd: Order = event.order;
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === updatedOrd.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updatedOrd;
            return next;
          }
          return [updatedOrd, ...prev];
        });
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, loadStoreData]);

  const handleChargeCash = (cartItems: CartItem[]) => handleCheckoutSale(cartItems, api.getStoreId());

  // Handle Checkout Sale
  const handleCheckoutSale = async (cartItems: CartItem[], storeId: string) => {
    const orderItems = cartItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    if (syncEngine.isOnline()) {
      const res = await api.createOrder({
        storeId,
        source: 'STAFF_POS',
        items: orderItems,
        paymentMethod: 'CASH',
      });

      setOrders((prev) => [res.order, ...prev]);
      api.getDailyAnalytics().then(setDailySummary).catch(() => {});
      return res.order;
    } else {
      const clientOrderId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const ticketNumber = await NativeStorageService.getNextOfflineTicketNumber();
      // Offline Order Creation
      const offlineOrder: Order = {
        id: clientOrderId,
        clientOrderId,
        storeId,
        ticketNumber,
        source: 'STAFF_POS',
        status: 'ACCEPTED',
        paymentStatus: 'SUCCESS',
        subtotal: cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0),
        discount: 0,
        total: cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0),
        createdAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        items: cartItems.map((i) => ({
          id: `item_${Math.random()}`,
          orderId: clientOrderId,
          productId: i.product.id,
          productNameSnapshot: i.product.name,
          unitPriceSnapshot: i.product.price,
          quantity: i.quantity,
          subtotal: i.product.price * i.quantity,
        })),
      };

      await syncEngine.queueOfflineOrder(offlineOrder, {
        method: 'CASH',
        status: 'SUCCESS',
        amount: offlineOrder.total,
      });

      setOrders((prev) => [offlineOrder, ...prev]);
      return offlineOrder;
    }
  };

  // 3. Action: UPI Charge
  const handleChargeUPI = async (cartItems: CartItem[]): Promise<Order> => {
    const storeId = api.getStoreId();
    const orderItems = cartItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    const res = await api.createOrder({
      storeId,
      source: 'STAFF_POS',
      items: orderItems,
      paymentMethod: 'UPI',
    });

    setOrders((prev) => [res.order, ...prev]);
    api.getDailyAnalytics().then(setDailySummary).catch(() => {});
    return res.order;
  };

  // 4. Action: Status Advance (NEW -> ACCEPTED -> PREPARING -> READY -> COMPLETED)
  const handleAdvanceStatus = async (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus: OrderStatus = 'ACCEPTED';
    if (currentStatus === 'NEW') nextStatus = 'ACCEPTED';
    else if (currentStatus === 'ACCEPTED') nextStatus = 'PREPARING';
    else if (currentStatus === 'PREPARING') nextStatus = 'READY';
    else if (currentStatus === 'READY') nextStatus = 'COMPLETED';

    try {
      const res = await api.updateOrderStatus(orderId, nextStatus);

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? res.order : o))
      );

      // Voice trigger on READY
      if (nextStatus === 'READY') {
        voiceService.announceOrderReady(res.order.ticketNumber);
      }

      if (nextStatus === 'COMPLETED') {
        api.getDailyAnalytics().then(setDailySummary).catch(() => {});
      }
    } catch (err: any) {
      alert(err.message || 'Could not update status');
    }
  };

  // 5. Action: Cancel Order
  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await api.updateOrderStatus(orderId, 'CANCELLED', 'Cancelled by vendor');
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? res.order : o))
      );
    } catch (err: any) {
      alert(err.message || 'Could not cancel order');
    }
  };

  // 6. Action: Save / Delete Product
  const handleSaveProduct = async (data: Partial<Product>) => {
    if (data.id) {
      const res = await api.updateProduct(data.id, data);
      setProducts((prev) => prev.map((p) => (p.id === data.id ? res.product : p)));
    } else {
      const res = await api.createProduct(data);
      setProducts((prev) => [...prev, res.product]);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // 7. Action: Update Settings & Voice
  const handleUpdateSettings = async (newSettings: Partial<StoreSettings>) => {
    const res = await api.updateStoreSettings(newSettings);
    setSettings(res.settings);
  };

  const handleUpdateVoiceConfig = (newConfig: Partial<VoiceConfig>) => {
    voiceService.updateConfig(newConfig);
    setVoiceConfig(voiceService.getConfig());
  };

  const handleApplyTemplate = async (templateKey: string) => {
    await api.applyTemplate(templateKey);
    await loadStoreData();
    alert('Merchant preset applied successfully!');
  };

  // 8. Demo Simulations
  const handleSimulateSingleQROrder = async () => {
    if (products.length === 0) return;
    const item1 = products[0];
    const item2 = products[1] || products[0];

    const res = await api.simulateCustomerQROrder(store?.slug || 'sharma-breakfast-corner', [
      { productId: item1.id, quantity: 2 },
      { productId: item2.id, quantity: 1 },
    ]);

    if (res.order) {
      setOrders((prev) => [res.order, ...prev]);
      voiceService.announceNewOrder(res.order);
    }
  };

  const handleSimulateMorningRush = async () => {
    if (products.length === 0) return;
    const p1 = products[0];
    const p2 = products[1] || p1;
    const p3 = products[2] || p1;

    for (let i = 0; i < 5; i++) {
      const res = await api.simulateCustomerQROrder(store?.slug || 'sharma-breakfast-corner', [
        { productId: i % 2 === 0 ? p1.id : p2.id, quantity: 1 },
        { productId: p3.id, quantity: 2 },
      ]);
      if (res.order) {
        setOrders((prev) => [res.order, ...prev]);
      }
    }
    voiceService.speak('Morning rush simulated. Five new orders in queue.');
  };

  const handleToggleOffline = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    syncEngine.setSimulatedOffline(next);
  };

  const handleSwitchMerchant = (merchantId: string, storeId: string) => {
    api.setStoreContext(merchantId, storeId);
    loadStoreData();
  };

  const newOrdersCount = orders.filter((o) => o.status === 'NEW').length;
  const activeQueueCount = orders.filter(
    (o) => o.status === 'NEW' || o.status === 'ACCEPTED' || o.status === 'PREPARING'
  ).length;

  if (isAuthLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Mobile Header */}
      <Header
        storeName={store?.name || 'Sharma Breakfast Corner'}
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        voiceConfig={voiceConfig}
        onToggleVoice={() => {
          handleUpdateVoiceConfig({ enabled: !voiceConfig.enabled });
          handleUpdateSettings({ voiceEnabled: !voiceConfig.enabled });
        }}
        onOpenDemo={() => setIsDemoDrawerOpen(true)}
        onOpenSettings={() => setActiveTab('SETTINGS')}
      />

      {/* Main Tab View */}
      <View style={styles.mainContent}>
        {activeTab === 'SELL' && (
          <SellScreen
            categories={categories}
            products={products}
            dailySummary={dailySummary}
            settings={settings}
            isOnline={isOnline}
            onChargeCash={handleChargeCash}
            onChargeUPI={handleChargeUPI}
          />
        )}

        {activeTab === 'ORDERS' && (
          <OrdersScreen
            orders={orders}
            typicalPrepMinutes={settings?.typicalPrepTimeMinutes || 6}
            onAdvanceStatus={handleAdvanceStatus}
            onCancelOrder={handleCancelOrder}
            onRefresh={loadStoreData}
          />
        )}

        {activeTab === 'QUEUE' && (
          <LiveQueueScreen
            orders={orders}
            typicalPrepMinutes={settings?.typicalPrepTimeMinutes || 6}
            onAdvanceStatus={handleAdvanceStatus}
          />
        )}

        {activeTab === 'BUSINESS' && (
          <BusinessScreen
            dailySummary={dailySummary}
            categories={categories}
            products={products}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}

        {activeTab === 'SETTINGS' && (
          <SettingsScreen
            store={store}
            settings={settings}
            voiceConfig={voiceConfig}
            staff={staff}
            devices={devices}
            onUpdateSettings={handleUpdateSettings}
            onUpdateVoiceConfig={handleUpdateVoiceConfig}
            onApplyTemplate={handleApplyTemplate}
            onTestVoice={() => {
              voiceService.speak('Token 101 is ready for pickup.');
            }}
          />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          HapticFeedback.light();
          setActiveTab(tab);
        }}
        newOrdersCount={newOrdersCount}
        activeQueueCount={activeQueueCount}
      />

      {/* Demo Actions Drawer */}
      <DemoDrawer
        isOpen={isDemoDrawerOpen}
        isSimulatedOffline={isSimulatedOffline}
        currentStoreId={api.getStoreId()}
        onClose={() => setIsDemoDrawerOpen(false)}
        onSimulateSingleQROrder={handleSimulateSingleQROrder}
        onSimulateMorningRush={handleSimulateMorningRush}
        onSimulateDelayedOrder={() => {
          voiceService.announceDelayedOrder('149', 10);
        }}
        onToggleOffline={handleToggleOffline}
        onOpenCustomerSimulator={() => setIsCustomerSimOpen(true)}
        onSwitchMerchant={handleSwitchMerchant}
      />

      {/* Customer QR Simulator */}
      <CustomerSimulator
        isOpen={isCustomerSimOpen}
        store={store}
        products={products}
        onClose={() => setIsCustomerSimOpen(false)}
        onSubmitOrder={async (items) => {
          const res = await api.simulateCustomerQROrder(
            store?.slug || 'sharma-breakfast-corner',
            items
          );
          if (res.order) {
            setOrders((prev) => [res.order, ...prev]);
            voiceService.announceNewOrder(res.order);
          }
          return res;
        }}
      />
    </SafeAreaView>
  </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
