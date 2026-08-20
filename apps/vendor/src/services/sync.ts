import { NativeStorageService } from './storage';
import { api } from './api';
import { networkService } from './network';
import { Order } from '@floq/types';

type SyncListener = (status: { isOnline: boolean; pendingCount: number; isSyncing: boolean }) => void;

class NativeSyncEngine {
  private isOnlineState: boolean = true;
  private isSimulatedOffline: boolean = false;
  private isSyncing: boolean = false;
  private listeners: Set<SyncListener> = new Set();

  constructor() {
    // Listen to real network changes from networkService
    networkService.init();
    networkService.subscribe((connected) => {
      this.setOnlineStatus(connected);
    });
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private async notify() {
    const effectiveOnline = this.isOnline();
    const pendingItems = await NativeStorageService.getPendingSyncItems();
    for (const listener of this.listeners) {
      try {
        listener({
          isOnline: effectiveOnline,
          pendingCount: pendingItems.length,
          isSyncing: this.isSyncing,
        });
      } catch {}
    }
  }

  public isOnline(): boolean {
    return this.isOnlineState && !this.isSimulatedOffline;
  }

  public setSimulatedOffline(offline: boolean) {
    this.isSimulatedOffline = offline;
    this.notify();
    if (!offline && this.isOnlineState) {
      this.triggerSync();
    }
  }

  public setOnlineStatus(online: boolean) {
    this.isOnlineState = online;
    this.notify();
    if (online && !this.isSimulatedOffline) {
      this.triggerSync();
    }
  }

  public async queueOfflineOrder(order: Order, payment?: any): Promise<void> {
    const clientOrderId = order.clientOrderId || order.id;
    const enrichedOrder: Order = {
      ...order,
      clientOrderId,
    };

    await NativeStorageService.enqueuePendingOrder(enrichedOrder, payment);
    await this.notify();

    if (this.isOnline()) {
      this.triggerSync();
    }
  }

  public async triggerSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline()) return;

    try {
      this.isSyncing = true;
      this.notify();

      const pendingItems = await NativeStorageService.getPendingSyncItems();
      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notify();
        return;
      }

      const storeId = api.getStoreId();
      const records = pendingItems.map((item) => ({
        id: item.id,
        clientOrderId: item.order?.clientOrderId || item.id,
        storeId: item.storeId,
        order: item.order,
        payment: item.payment,
        clientTimestamp: item.clientTimestamp,
      }));

      const result = await api.syncOfflineRecords({
        storeId,
        records,
      });

      if (result.syncedOrderIds && result.syncedOrderIds.length > 0) {
        await NativeStorageService.removeSyncedOrders(result.syncedOrderIds);
      }
    } catch {
      // Sync failed, will retry later on network restoration
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const syncEngine = new NativeSyncEngine();
