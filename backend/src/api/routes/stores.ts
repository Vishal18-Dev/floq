import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query, queryOne, transaction } from '../../db';
import { UpdateStoreSettingsSchema } from '@floq/validation';
import { STORE_TEMPLATES } from '@floq/constants';
import crypto from 'crypto';

const router = Router();

// GET /api/stores/current - Get active store and settings
router.get('/current', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const store = await queryOne('SELECT * FROM stores WHERE id = $1', [req.storeId]);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const settings = await queryOne('SELECT * FROM store_settings WHERE store_id = $1', [req.storeId]);
    const staff = await query('SELECT * FROM staff WHERE store_id = $1', [req.storeId]);
    const devices = await query('SELECT * FROM devices WHERE store_id = $1', [req.storeId]);

    res.json({
      store: {
        id: store.id,
        merchantId: store.merchant_id,
        name: store.name,
        slug: store.slug,
        storeType: store.store_type,
        address: store.address,
        phone: store.phone,
        openingTime: store.opening_time,
        closingTime: store.closing_time,
        timezone: store.timezone,
        status: store.status,
      },
      settings: settings ? {
        id: settings.id,
        storeId: settings.store_id,
        voiceEnabled: Boolean(settings.voice_enabled),
        voiceLanguage: settings.voice_language,
        voiceVerbosity: settings.voice_verbosity,
        typicalPrepTimeMinutes: settings.typical_prep_time_minutes,
        ticketPrefix: settings.ticket_prefix,
        autoAcceptQrOrders: Boolean(settings.auto_accept_qr_orders),
        upiId: settings.upi_id,
        upiName: settings.upi_name,
      } : null,
      staff,
      devices,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/stores/settings - Update store settings (voice, prep time, UPI, etc.)
router.patch('/settings', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = UpdateStoreSettingsSchema.parse(req.body);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.voiceEnabled !== undefined) {
      fields.push(`voice_enabled = $${idx++}`);
      values.push(data.voiceEnabled);
    }
    if (data.voiceLanguage) {
      fields.push(`voice_language = $${idx++}`);
      values.push(data.voiceLanguage);
    }
    if (data.voiceVerbosity) {
      fields.push(`voice_verbosity = $${idx++}`);
      values.push(data.voiceVerbosity);
    }
    if (data.typicalPrepTimeMinutes !== undefined) {
      fields.push(`typical_prep_time_minutes = $${idx++}`);
      values.push(data.typicalPrepTimeMinutes);
    }
    if (data.ticketPrefix) {
      fields.push(`ticket_prefix = $${idx++}`);
      values.push(data.ticketPrefix);
    }
    if (data.autoAcceptQrOrders !== undefined) {
      fields.push(`auto_accept_qr_orders = $${idx++}`);
      values.push(data.autoAcceptQrOrders);
    }
    if (data.upiId) {
      fields.push(`upi_id = $${idx++}`);
      values.push(data.upiId);
    }
    if (data.upiName) {
      fields.push(`upi_name = $${idx++}`);
      values.push(data.upiName);
    }

    if (fields.length > 0) {
      values.push(req.storeId);
      const storeIdParamIdx = idx++;
      await query(`UPDATE store_settings SET ${fields.join(', ')} WHERE store_id = $${storeIdParamIdx}`, values);
    }

    const updated = await queryOne('SELECT * FROM store_settings WHERE store_id = $1', [req.storeId]);
    res.json({
      settings: {
        id: updated.id,
        storeId: updated.store_id,
        voiceEnabled: Boolean(updated.voice_enabled),
        voiceLanguage: updated.voice_language,
        voiceVerbosity: updated.voice_verbosity,
        typicalPrepTimeMinutes: updated.typical_prep_time_minutes,
        ticketPrefix: updated.ticket_prefix,
        autoAcceptQrOrders: Boolean(updated.auto_accept_qr_orders),
        upiId: updated.upi_id,
        upiName: updated.upi_name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/stores/apply-template - Load a template into the store
router.post('/apply-template', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { templateKey } = req.body;
    const template = STORE_TEMPLATES[templateKey];
    if (!template) {
      res.status(400).json({ error: 'INVALID_TEMPLATE', message: `Template ${templateKey} does not exist.` });
      return;
    }

    const now = new Date().toISOString();

    await transaction(async (client) => {
      await client.query('DELETE FROM products WHERE store_id = $1', [req.storeId]);
      await client.query('DELETE FROM categories WHERE store_id = $1', [req.storeId]);

      await client.query('UPDATE stores SET store_type = $1, name = $2 WHERE id = $3', [
        template.storeType,
        template.name,
        req.storeId,
      ]);

      const catMap: Record<string, string> = {};
      for (let i = 0; i < template.categories.length; i++) {
        const catName = template.categories[i];
        const catId = crypto.randomUUID();
        catMap[catName] = catId;
        await client.query(
          `INSERT INTO categories (id, store_id, name, sort_order, is_active, created_at)
           VALUES ($1, $2, $3, $4, true, $5)`,
          [catId, req.storeId, catName, i, now]
        );
      }

      for (let i = 0; i < template.products.length; i++) {
        const p = template.products[i];
        const pId = crypto.randomUUID();
        await client.query(
          `INSERT INTO products (id, store_id, category_id, name, description, price, is_available, sort_order, station, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)`,
          [pId, req.storeId, catMap[p.category], p.name, p.description || null, p.price, i, p.station, now, now]
        );
      }
    });

    res.json({ success: true, message: `Applied ${template.name} template successfully.` });
  } catch (err) {
    next(err);
  }
});

export default router;
