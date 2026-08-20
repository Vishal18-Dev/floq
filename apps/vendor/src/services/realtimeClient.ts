import { api } from './api';
import { voiceService } from './voice';
import { RealtimeEvent, Order } from '@floq/types';

export type RealtimeListener = (event: RealtimeEvent) => void;

export class ResilientRealtimeClient {
  private processedEventIds: Set<string> = new Set();
  private isConnected: boolean = false;
  private reconnectTimer: any = null;
  private listeners: Set<RealtimeListener> = new Set();
  private abortController: AbortController | null = null;
  private onReconnectedCallback?: () => void;

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setReconnectedCallback(cb: () => void) {
    this.onReconnectedCallback = cb;
  }

  public connect() {
    if (this.isConnected) return;
    this.disconnect();

    const token = api.getAuthToken();
    const storeId = api.getStoreId();
    const baseUrl = api.getBaseUrl();

    if (!token || !storeId) return;

    this.abortController = new AbortController();
    const streamUrl = `${baseUrl}/realtime?storeId=${encodeURIComponent(storeId)}&token=${encodeURIComponent(token)}`;

    fetch(streamUrl, {
      headers: { Accept: 'text/event-stream' },
      signal: this.abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`SSE HTTP error ${res.status}`);
        this.isConnected = true;

        if (this.onReconnectedCallback) {
          this.onReconnectedCallback();
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';

        const readStream = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (done) {
              this.handleDisconnect();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const chunk of lines) {
              this.parseChunk(chunk);
            }
            return readStream();
          });
        };

        return readStream();
      })
      .catch(() => {
        this.handleDisconnect();
      });
  }

  private parseChunk(chunk: string) {
    const lines = chunk.split('\n');
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataStr = line.substring(6).trim();
      }
    }

    if (!dataStr) return;

    try {
      const event: RealtimeEvent = JSON.parse(dataStr);
      if (!event.eventId || this.processedEventIds.has(event.eventId)) {
        // Deduplicate events
        return;
      }

      this.processedEventIds.add(event.eventId);
      // Keep processedEventIds set bounded
      if (this.processedEventIds.size > 500) {
        const first = this.processedEventIds.values().next().value;
        if (first) this.processedEventIds.delete(first);
      }

      // Voice trigger for genuinely NEW customer QR orders
      if (event.type === 'ORDER_CREATED' && event.order) {
        const order: Order = event.order;
        voiceService.announceNewOrder(order);
      }

      // Notify UI listeners
      for (const listener of this.listeners) {
        try { listener(event); } catch {}
      }
    } catch {}
  }

  private handleDisconnect() {
    this.isConnected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public disconnect() {
    this.isConnected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public isStreamConnected(): boolean {
    return this.isConnected;
  }
}

export const realtimeClient = new ResilientRealtimeClient();
