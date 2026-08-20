import { Response } from 'express';
import crypto from 'crypto';
import { RealtimeEvent, RealtimeEventType } from '@floq/types';

export class RealtimeService {
  private clients: Map<string, Set<Response>> = new Map();

  public subscribe(storeId: string, res: Response): void {
    if (!this.clients.has(storeId)) {
      this.clients.set(storeId, new Set());
    }
    const storeClients = this.clients.get(storeId)!;
    storeClients.add(res);

    const eventId = crypto.randomUUID();
    const handshakeEvent: RealtimeEvent = {
      eventId,
      type: 'CONNECTED',
      storeId,
      timestamp: new Date().toISOString(),
    };

    res.write(`id: ${eventId}\ndata: ${JSON.stringify(handshakeEvent)}\n\n`);

    res.on('close', () => {
      storeClients.delete(res);
      if (storeClients.size === 0) {
        this.clients.delete(storeId);
      }
    });
  }

  public emit(storeId: string, event: Partial<RealtimeEvent> & { type: RealtimeEventType }): void {
    const storeClients = this.clients.get(storeId);
    if (!storeClients || storeClients.size === 0) return;

    const eventId = event.eventId || crypto.randomUUID();
    const payload: RealtimeEvent = {
      ...event,
      eventId,
      storeId,
      timestamp: new Date().toISOString(),
    };

    const sseMessage = `id: ${eventId}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of storeClients) {
      try {
        client.write(sseMessage);
      } catch {
        storeClients.delete(client);
      }
    }
  }
}

export const realtimeService = new RealtimeService();
