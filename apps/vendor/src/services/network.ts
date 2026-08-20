import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

export type NetworkStatusListener = (isConnected: boolean, isInternetReachable: boolean | null) => void;

export class NetworkService {
  private isConnected: boolean = true;
  private isInternetReachable: boolean | null = true;
  private listeners: Set<NetworkStatusListener> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;

  public init() {
    if (this.unsubscribeNetInfo) return;

    if (Platform.OS === 'web') {
      const handleOnline = () => this.notifyListeners(true, true);
      const handleOffline = () => this.notifyListeners(false, false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      this.notifyListeners(navigator.onLine, navigator.onLine);
    } else {
      this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
        const connected = state.isConnected ?? false;
        const reachable = state.isInternetReachable;
        this.notifyListeners(connected, reachable);
      });
    }
  }

  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.isConnected, this.isInternetReachable);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(connected: boolean, reachable: boolean | null) {
    this.isConnected = connected;
    this.isInternetReachable = reachable;
    for (const listener of this.listeners) {
      try { listener(connected, reachable); } catch {}
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsInternetReachable(): boolean | null {
    return this.isInternetReachable;
  }
}

export const networkService = new NetworkService();
