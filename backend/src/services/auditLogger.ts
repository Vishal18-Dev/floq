import crypto from 'crypto';
import { query } from '../db';
import { AuditLog, StaffRole } from '@floq/types';

export class AuditLogger {
  public async log(params: {
    actorId?: string;
    actorRole?: StaffRole;
    storeId: string;
    action: string;
    entityType: string;
    entityId: string;
    amount?: number;
    details?: any;
  }): Promise<AuditLog> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const actorId = params.actorId || 'SYSTEM';
    const actorRole = params.actorRole || 'STAFF';
    const metadataJson = params.details ? JSON.stringify(params.details) : undefined;

    await query(
      `INSERT INTO audit_logs (id, actor_id, store_id, action, entity_type, entity_id, amount, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        actorId,
        params.storeId,
        params.action,
        params.entityType,
        params.entityId,
        params.amount || null,
        metadataJson || null,
        now,
      ]
    );

    return {
      id,
      actorId,
      actorRole,
      storeId: params.storeId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      detailsJson: metadataJson,
      createdAt: now,
    };
  }

  public async listLogs(storeId: string, limit = 50): Promise<AuditLog[]> {
    const rows = await query('SELECT * FROM audit_logs WHERE store_id = $1 ORDER BY created_at DESC LIMIT $2', [
      storeId,
      limit,
    ]);

    return rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorRole: 'STAFF',
      storeId: r.store_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      detailsJson: r.metadata_json ? (typeof r.metadata_json === 'string' ? r.metadata_json : JSON.stringify(r.metadata_json)) : undefined,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }
}

export const auditLogger = new AuditLogger();
