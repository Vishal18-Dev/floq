import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, SafeAreaView, StatusBar, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Order, OrderStatus, PaymentMethod } from '@floq/types';

import { Header } from './components/layout/Header';
import { BottomNav, TabType } from './components/layout/BottomNav';
import { SellScreen, ChargeLine } from './components/sell/SellScreen';
import { LiveQueueScreen } from './components/queue/LiveQueueScreen';
import { DayScreen } from './components/day/DayScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { SubscribeScreen } from './components/subscription/SubscribeScreen';
import { ItemsManager } from './components/business/ItemsManager';
import { LoginScreen } from './components/auth/LoginScreen';
import { OnboardingWizard } from './components/auth/OnboardingWizard';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { api, SubscriptionStatus } from './services/api';
import { useT } from './i18n';
import { syncEngine } from './services/sync';
import { NativeStorageService } from './services/storage';
import { voiceService } from './services/voice';
import { realtimeClient } from './services/realtimeClient';

import { useAppFonts } from './theme/fonts';
import { palette, fonts } from './theme';
import { useAuthStore } from './store/useAuthStore';
import { useStoreStore } from './store/useStoreStore';
import { useOrdersStore } from './store/useOrdersStore';
import { useCatalogStore } from './store/useCatalogStore';

export default function App() {
  const fontsReady = useAppFonts();
  const { isAuthenticated, isLoading: authLoading, restoreSession, logout } = useAuthStore();
  const store = useStoreStore((s) => s.store);
  const settings = useStoreStore((s) => s.settings);
  const subscription = useStoreStore((s) => s.subscription);
  const loadStore = useStoreStore((s) => s.loadStore);
  const loadSubscription = useStoreStore((s) => s.loadSubscription);
  const orders = useOrdersStore((s) => s.orders);
  const loadOrders = useOrdersStore((s) => s.loadOrders);
  const upsertOrder = useOrdersStore((s) => s.upsertOrder);
  const { products, categories, dailySummary, loadCatalog, loadAnalytics, loadDayStatus, refreshAnalytics, toggleAvailability } =
    useCatalogStore();

  const [activeTab, setActiveTab] = useState<TabType>('SELL');
  const [dataLoading, setDataLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [onboarding, setOnboarding] = useState<{ idToken: string; phone: string } | null>(null);

  const mode = store?.mode || 'FOOD';
  const isFood = mode === 'FOOD';

  useEffect(() => {
    // Wake a possibly-sleeping backend (free-tier spin-down) up front, so the
    // first login/sale isn't the request that eats the ~50s cold start.
    api.warmup();
    restoreSession();
  }, [restoreSession]);

  // Cold-start splash (design 3b): show briefly, then the counter.
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Connectivity + pending offline count from the sync engine.
  useEffect(() => {
    const unsub = syncEngine.subscribe(({ isOnline: online, pendingCount }) => {
      setIsOnline(online);
      setPendingSync(pendingCount);
    });
    return () => { unsub && unsub(); };
  }, []);

  const loadAll = useCallback(async () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    await Promise.all([loadStore(), loadCatalog(), loadOrders(), loadAnalytics(), loadDayStatus(), loadSubscription()]);
    setDataLoading(false);
  }, [isAuthenticated, loadStore, loadCatalog, loadOrders, loadAnalytics, loadDayStatus, loadSubscription]);

  useEffect(() => { if (isAuthenticated) loadAll(); }, [isAuthenticated, loadAll]);

  // Configure voice from store settings.
  useEffect(() => {
    if (settings) {
      voiceService.updateConfig({ enabled: settings.voiceEnabled, language: settings.voiceLanguage as any });
    }
  }, [settings]);

  // Realtime order events.
  useEffect(() => {
    if (!isAuthenticated) return;
    realtimeClient.setReconnectedCallback(() => loadAll());
    const unsub = realtimeClient.subscribe((event) => {
      if ((event.type === 'ORDER_CREATED' || event.type === 'ORDER_UPDATED') && event.order) {
        upsertOrder(event.order);
      }
    });
    return () => unsub();
  }, [isAuthenticated, loadAll, upsertOrder]);

  // Create a sale (online → API; offline → local queue). Works for catalogue
  // lines and ad-hoc quick-charge lines.
  const createSale = useCallback(
    async (lines: ChargeLine[], method: PaymentMethod): Promise<Order> => {
      const storeId = api.getStoreId();
      if (syncEngine.isOnline()) {
        let res;
        try {
          res = await api.createOrder({
            storeId,
            source: 'STAFF_POS',
            items: lines,
            paymentMethod: method,
            immediatePayment: true,
          });
        } catch (e: any) {
          // Subscription lapsed mid-session: refresh status so the Sell tab
          // flips to the paywall, and surface a clear message.
          if (e?.status === 402) loadSubscription();
          throw e;
        }
        upsertOrder(res.order);
        refreshAnalytics();
        return res.order;
      }
      // Offline: build a local order and queue it for idempotent sync.
      const clientOrderId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const ticketNumber = await NativeStorageService.getNextOfflineTicketNumber();
      const resolved = lines.map((l) => {
        const p = l.productId ? products.find((pr) => pr.id === l.productId) : undefined;
        const unit = p ? p.price : l.unitPrice || 0;
        return {
          id: `item_${Math.random()}`,
          orderId: clientOrderId,
          productId: l.productId || 'CUSTOM',
          productNameSnapshot: p ? p.name : l.name || 'Quick sale',
          unitPriceSnapshot: unit,
          quantity: l.quantity,
          subtotal: unit * l.quantity,
        };
      });
      const total = resolved.reduce((s, i) => s + i.subtotal, 0);
      const now = new Date().toISOString();
      const offlineOrder: Order = {
        id: clientOrderId,
        clientOrderId,
        storeId,
        ticketNumber,
        source: 'STAFF_POS',
        status: isFood ? 'ACCEPTED' : 'COMPLETED',
        paymentStatus: 'SUCCESS',
        subtotal: total,
        discount: 0,
        total,
        createdAt: now,
        acceptedAt: now,
        completedAt: isFood ? undefined : now,
        items: resolved,
      };
      await syncEngine.queueOfflineOrder(offlineOrder, { method, status: 'SUCCESS', amount: total });
      upsertOrder(offlineOrder);
      // pendingSync updates via the syncEngine subscription above.
      return offlineOrder;
    },
    [products, isFood, upsertOrder, refreshAnalytics, loadSubscription]
  );

  const advanceStatus = useCallback(
    async (orderId: string, current: OrderStatus) => {
      const map: Record<string, OrderStatus> = { NEW: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' };
      const next = map[current] || 'ACCEPTED';
      try {
        const res = await api.updateOrderStatus(orderId, next);
        upsertOrder(res.order);
        if (next === 'READY') voiceService.announceOrderReady(res.order.ticketNumber);
        if (next === 'COMPLETED') refreshAnalytics();
      } catch (e: any) {
        alert(e?.message || 'Could not update the order');
      }
    },
    [upsertOrder, refreshAnalytics]
  );

  // ---- Render gates ----
  if (!fontsReady || authLoading) {
    return <Splash />;
  }
  if (!isAuthenticated) {
    if (onboarding) {
      return <OnboardingWizard idToken={onboarding.idToken} phone={onboarding.phone} onBack={() => setOnboarding(null)} />;
    }
    return <LoginScreen onNeedsOnboarding={(idToken, phone) => setOnboarding({ idToken, phone })} />;
  }
  if (showSplash || dataLoading) {
    return <Splash storeName={store?.name} carryOver={useCatalogStore.getState().carriedOverTokens} />;
  }

  const queueCount = orders.filter((o) => ['NEW', 'ACCEPTED', 'PREPARING'].includes(o.status)).length;

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.app}>
        <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
        <Header
          storeName={store?.name || 'FLOQ'}
          storeNameLocal={store?.nameLocal}
          isOnline={isOnline}
          pendingSyncCount={pendingSync}
          onOpenSettings={() => setActiveTab('SETTINGS')}
        />

        <SubscriptionBanner subscription={subscription} onPress={() => setActiveTab('SELL')} />

        <View style={styles.main}>
          {activeTab === 'SELL' && (
            subscription && !subscription.canSell ? (
              <SubscribeScreen subscription={subscription} onSubmitted={loadSubscription} />
            ) : (
              <SellScreen
                products={products}
                categories={categories}
                dailySummary={dailySummary}
                settings={settings}
                mode={mode}
                onCharge={createSale}
                onToggleAvailability={toggleAvailability}
              />
            )
          )}
          {activeTab === 'QUEUE' && isFood && (
            <LiveQueueScreen orders={orders} typicalPrepMinutes={settings?.typicalPrepTimeMinutes || 6} onAdvance={advanceStatus} />
          )}
          {activeTab === 'DAY' && (
            <DayScreen dailySummary={dailySummary} onCloseDay={() => api.closeDay().then(() => { refreshAnalytics(); })} onManageItems={() => setItemsOpen(true)} />
          )}
          {activeTab === 'SETTINGS' && (
            <SettingsScreen onManageItems={() => setItemsOpen(true)} onLogout={logout} onBack={() => setActiveTab('SELL')} />
          )}
        </View>

        {activeTab !== 'SETTINGS' && (
          <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} showQueue={isFood} queueCount={queueCount} />
        )}

        <ItemsManager visible={itemsOpen} onClose={() => setItemsOpen(false)} />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

/** Slim bar shown when the trial is nearly up or the subscription has lapsed.
 *  Tapping it jumps to the Sell tab, which shows the Subscribe paywall. */
function SubscriptionBanner({ subscription, onPress }: { subscription: SubscriptionStatus | null; onPress: () => void }) {
  const { t } = useT();
  if (!subscription) return null;
  const expired = subscription.status === 'expired';
  const trialEnding = subscription.status === 'trial' && subscription.daysLeft <= 3;
  if (!expired && !trialEnding) return null;
  return (
    <TouchableOpacity
      style={[bannerStyles.bar, expired ? bannerStyles.barExpired : bannerStyles.barTrial]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[bannerStyles.text, expired && bannerStyles.textExpired]} numberOfLines={1}>
        {expired ? t('subEndedShort') : `${subscription.daysLeft} ${t('trialDaysLeft')}`}
      </Text>
      <Text style={[bannerStyles.cta, expired && bannerStyles.textExpired]}>{t('subscribe')} →</Text>
    </TouchableOpacity>
  );
}

const bannerStyles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  barTrial: { backgroundColor: palette.ink },
  barExpired: { backgroundColor: palette.accent },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: palette.onAccent, flex: 1 },
  textExpired: { color: palette.onAccent },
  cta: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 12, letterSpacing: 0.5, color: palette.onAccent },
});

function Splash({ storeName, carryOver }: { storeName?: string; carryOver?: number }) {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashStore}>{(storeName || 'FLOQ MERCHANT').toUpperCase()}</Text>
      <View>
        <Text style={styles.splashWord}>FLOQ</Text>
        <View style={styles.splashRule} />
        <Text style={styles.splashSub}>
          {carryOver && carryOver > 0 ? `Counter loading — ${carryOver} tokens carried over` : 'Counter loading…'}
        </Text>
      </View>
      <ActivityIndicator color={palette.onAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: palette.bg },
  main: { flex: 1, backgroundColor: palette.bg },
  splash: { flex: 1, backgroundColor: palette.accent, justifyContent: 'space-between', padding: 30, paddingTop: 60, paddingBottom: 50 },
  splashStore: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 13, letterSpacing: 2, color: palette.onAccent, opacity: 0.85 },
  splashWord: { fontFamily: fonts.heading, fontWeight: '800', fontSize: 92, letterSpacing: -5, color: palette.onAccent, lineHeight: 92 },
  splashRule: { width: 84, height: 6, backgroundColor: palette.onAccent, marginTop: 16 },
  splashSub: { fontFamily: fonts.body, fontSize: 18, color: palette.onAccent, opacity: 0.9, marginTop: 16 },
});
