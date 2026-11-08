import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query, queryOne, transaction } from '../../db';
import { UpdateStoreSettingsSchema, StoreSeedSchema } from '@floq/validation';
import { STORE_TEMPLATES } from '@floq/constants';
import { seedStoreContents, SeedResult } from '../../services/storeSeed';
import crypto from 'crypto';

const router = Router();

/** Shape a store_settings row for the client, including the onboarding fields. */
function mapSettings(s: any) {
  return {
    id: s.id,
    storeId: s.store_id,
    secondaryLanguage: s.secondary_language || 'none',
    voiceEnabled: Boolean(s.voice_enabled),
    voiceLanguage: s.voice_language,
    voiceVerbosity: s.voice_verbosity,
    typicalPrepTimeMinutes: s.typical_prep_time_minutes,
    ticketPrefix: s.ticket_prefix,
    autoAcceptQrOrders: Boolean(s.auto_accept_qr_orders),
    upiId: s.upi_id,
    upiName: s.upi_name,
    creditEnabled: s.credit_enabled === undefined || s.credit_enabled === null ? true : Boolean(s.credit_enabled),
    defaultCreditLimit: s.default_credit_limit ?? undefined,
    servicePrefs: s.service_prefs_json ? safeJson(s.service_prefs_json) : undefined,
  };
}

function safeJson(v: any) {
  if (typeof v !== 'string') return v || undefined;
  try { return JSON.parse(v); } catch { return undefined; }
}

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
        nameLocal: store.name_local || undefined,
        slug: store.slug,
        storeType: store.store_type,
        mode: store.mode || 'FOOD',
        address: store.address,
        city: store.city || undefined,
        imageUrl: store.image_url || undefined,
        phone: store.phone,
        openingTime: store.opening_time,
        closingTime: store.closing_time,
        gstin: store.gstin || undefined,
        timezone: store.timezone,
        status: store.status,
      },
      settings: settings ? mapSettings(settings) : null,
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

    if (data.secondaryLanguage !== undefined) {
      fields.push(`secondary_language = $${idx++}`);
      values.push(data.secondaryLanguage);
    }
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
    if (data.creditEnabled !== undefined) {
      fields.push(`credit_enabled = $${idx++}`);
      values.push(data.creditEnabled);
    }
    if (data.defaultCreditLimit !== undefined) {
      fields.push(`default_credit_limit = $${idx++}`);
      values.push(data.defaultCreditLimit);
    }

    if (fields.length > 0) {
      values.push(req.storeId);
      const storeIdParamIdx = idx++;
      await query(`UPDATE store_settings SET ${fields.join(', ')} WHERE store_id = $${storeIdParamIdx}`, values);
    }

    const updated = await queryOne('SELECT * FROM store_settings WHERE store_id = $1', [req.storeId]);
    res.json({ settings: mapSettings(updated) });
  } catch (err) {
    next(err);
  }
});

// POST /api/stores/seed — seed the authenticated store's catalogue, opening
// stock and credit book, plus the store-level answers the wizard captured
// (hours, GSTIN, credit on/off + default limit, food service prefs). Called
// once during self-serve onboarding, after the account is created. Additive:
// it reuses the starter category and never wipes existing data.
router.post('/seed', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = StoreSeedSchema.parse(req.body);
    const store = await queryOne('SELECT id, slug, mode FROM stores WHERE id = $1', [req.storeId]);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    let result: SeedResult = { initialCategoryId: '', itemsCreated: 0, packsCreated: 0, customersCreated: 0 };
    await transaction(async (client) => {
      result = await seedStoreContents(client, store.id, store.slug, {
        items: input.items,
        customers: input.customers,
        suppliers: input.suppliers,
        initialCategoryName: input.initialCategoryName,
        mode: store.mode,
      });

      // Store-level answers.
      const storeFields: string[] = [];
      const storeVals: any[] = [];
      let i = 1;
      if (input.openingTime) { storeFields.push(`opening_time = $${i++}`); storeVals.push(input.openingTime); }
      if (input.closingTime) { storeFields.push(`closing_time = $${i++}`); storeVals.push(input.closingTime); }
      if (input.gstin !== undefined) { storeFields.push(`gstin = $${i++}`); storeVals.push(input.gstin || null); }
      if (storeFields.length) {
        storeVals.push(store.id);
        await client.query(`UPDATE stores SET ${storeFields.join(', ')} WHERE id = $${i++}`, storeVals);
      }

      const setFields: string[] = [];
      const setVals: any[] = [];
      let j = 1;
      if (input.creditEnabled !== undefined) { setFields.push(`credit_enabled = $${j++}`); setVals.push(input.creditEnabled); }
      if (input.defaultCreditLimit !== undefined) { setFields.push(`default_credit_limit = $${j++}`); setVals.push(input.defaultCreditLimit); }
      if (input.servicePrefs !== undefined) { setFields.push(`service_prefs_json = $${j++}`); setVals.push(JSON.stringify(input.servicePrefs)); }
      if (setFields.length) {
        setVals.push(store.id);
        await client.query(`UPDATE store_settings SET ${setFields.join(', ')} WHERE store_id = $${j++}`, setVals);
      }
    });

    res.status(201).json({ success: true, ...result });
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
