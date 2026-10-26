import crypto from 'crypto';
import { transaction } from './index';
import { runMigrations } from './migrate';
import { STORE_TEMPLATES } from '@floq/constants';
import { config } from '../config';
import { hashPin } from '../services/authService';

// Known PIN for seeded demo/test users (dev + test only).
export const SEED_PIN = '1234';

export async function seedDatabase(force: boolean = false): Promise<void> {
  // Safety Guard: Never run seed in production mode unless forced
  if (config.isProduction && !force && process.env.ALLOW_SEED !== 'true') {
    throw new Error('FATAL: Database seeding is strictly forbidden in production mode unless forced!');
  }

  await runMigrations();

  await transaction(async (client) => {
    // Reset existing tables in dependency order
    const tables = [
      'audit_logs',
      'subscription_payments',
      'subscriptions',
      'dues_entries',
      'credit_customers',
      'day_closures',
      'ticket_sequences',
      'queue_tickets',
      'payments',
      'order_items',
      'orders',
      'product_packs',
      'products',
      'categories',
      'devices',
      'staff',
      'users',
      'store_settings',
      'stores',
      'merchants',
    ];
    for (const tbl of tables) {
      await client.query(`DELETE FROM ${tbl}`);
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // ==========================================
    // 1. MERCHANT 1: Sharma Breakfast Corner
    // ==========================================
    const merchant1Id = 'merchant_sharma_01';
    const store1Id = 'store_sharma_01';

    await client.query(
      `INSERT INTO merchants (id, name, phone, email, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [merchant1Id, 'Ramesh Sharma', '+919876543210', 'ramesh@sharmabreakfast.in', 'ACTIVE', now.toISOString(), now.toISOString()]
    );

    await client.query(
      `INSERT INTO stores (id, merchant_id, name, slug, store_type, mode, address, phone, opening_time, closing_time, timezone, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        store1Id,
        merchant1Id,
        'Sharma Breakfast Corner',
        'sharma-breakfast-corner',
        'BREAKFAST',
        'FOOD',
        'Shop 4, Opp Railway Station, FC Road, Pune',
        '+919876543210',
        '06:30',
        '22:00',
        'Asia/Kolkata',
        'ACTIVE',
        now.toISOString(),
        now.toISOString(),
      ]
    );

    await client.query(
      `INSERT INTO store_settings (id, store_id, voice_enabled, voice_language, voice_verbosity, typical_prep_time_minutes, ticket_prefix, upi_id, upi_name)
       VALUES ($1, $2, true, 'en-IN', 'BRIEF', 6, '#', 'sharma.stall@okhdfcbank', 'Sharma Breakfast Corner')`,
      [crypto.randomUUID(), store1Id]
    );

    await client.query(
      `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, pin_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'user_sharma_owner',
        '9876543210',
        'Ramesh Sharma',
        'OWNER',
        merchant1Id,
        JSON.stringify([store1Id]),
        hashPin(SEED_PIN),
        'ACTIVE',
        now.toISOString(),
        now.toISOString(),
      ]
    );

    // Apply Breakfast Template
    const bfastTemplate = STORE_TEMPLATES.SHARMA_BREAKFAST_CORNER;
    const catMap: Record<string, string> = {};

    for (let i = 0; i < bfastTemplate.categories.length; i++) {
      const catName = bfastTemplate.categories[i];
      const catId = `cat_${i + 1}`;
      catMap[catName] = catId;
      await client.query(
        `INSERT INTO categories (id, store_id, name, sort_order, is_active, created_at)
         VALUES ($1, $2, $3, $4, true, $5)`,
        [catId, store1Id, catName, i, now.toISOString()]
      );
    }

    const prodMap: Record<string, string> = {};
    for (let i = 0; i < bfastTemplate.products.length; i++) {
      const p = bfastTemplate.products[i];
      const pId = `prod_${i + 1}`;
      prodMap[p.name] = pId;
      await client.query(
        `INSERT INTO products (id, store_id, category_id, name, description, price, is_available, sort_order, station, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)`,
        [pId, store1Id, catMap[p.category], p.name, p.description || null, p.price, i, p.station, now.toISOString(), now.toISOString()]
      );
    }

    // Seed Orders for Morning Rush
    let ticketSeq = 101;
    const orderCombos = [
      { name: 'Poha + Chai', items: [{ prodName: 'Indori Poha', qty: 1 }, { prodName: 'Special Masala Chai', qty: 1 }], total: 45 },
      { name: 'Upma + Chai', items: [{ prodName: 'Rava Upma', qty: 1 }, { prodName: 'Special Masala Chai', qty: 1 }], total: 50 },
      { name: 'Misal Pav', items: [{ prodName: 'Kolhapuri Misal Pav', qty: 1 }], total: 50 },
    ];

    for (let i = 0; i < 15; i++) {
      const combo = orderCombos[i % orderCombos.length];
      const orderId = `order_hist_${i + 1}`;
      const tNum = `#${ticketSeq.toString().padStart(3, '0')}`;
      ticketSeq++;

      const orderDate = new Date(now.getTime() - (15 - i) * 10 * 60 * 1000).toISOString();

      await client.query(
        `INSERT INTO orders (id, client_order_id, store_id, business_date, source, status, payment_status, ticket_number, subtotal, discount, total, created_at, accepted_at, ready_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          orderId,
          orderId,
          store1Id,
          todayStr,
          'STAFF_POS',
          'COMPLETED',
          'SUCCESS',
          tNum,
          combo.total,
          0,
          combo.total,
          orderDate,
          orderDate,
          orderDate,
          orderDate,
        ]
      );

      for (const item of combo.items) {
        const pId = prodMap[item.prodName] || 'prod_1';
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [crypto.randomUUID(), orderId, pId, item.prodName, 30, item.qty, 30 * item.qty]
        );
      }

      await client.query(
        `INSERT INTO payments (id, order_id, method, status, amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), orderId, 'CASH', 'SUCCESS', combo.total, orderDate, orderDate]
      );

      await client.query(
        `INSERT INTO queue_tickets (id, order_id, store_id, business_date, ticket_number, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), orderId, store1Id, todayStr, tNum, orderDate, orderDate]
      );
    }

    const seqRow = await client.query('SELECT last_ticket_number FROM ticket_sequences WHERE store_id = $1 AND business_date = $2', [
      store1Id,
      todayStr,
    ]);

    if (seqRow.rows && seqRow.rows.length > 0) {
      await client.query('UPDATE ticket_sequences SET last_ticket_number = $1 WHERE store_id = $2 AND business_date = $3', [
        ticketSeq,
        store1Id,
        todayStr,
      ]);
    } else {
      await client.query('INSERT INTO ticket_sequences (store_id, business_date, last_ticket_number) VALUES ($1, $2, $3)', [
        store1Id,
        todayStr,
        ticketSeq,
      ]);
    }

    // ==========================================
    // 2. MERCHANT 2: Chai Point Express
    // ==========================================
    const merchant2Id = 'merchant_chaipoint_02';
    const store2Id = 'store_chaipoint_02';

    await client.query(
      `INSERT INTO merchants (id, name, phone, email, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [merchant2Id, 'Suresh Patil', '+919822334455', 'suresh@chaipointexpress.in', 'ACTIVE', now.toISOString(), now.toISOString()]
    );

    await client.query(
      `INSERT INTO stores (id, merchant_id, name, slug, store_type, mode, address, phone, opening_time, closing_time, timezone, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        store2Id,
        merchant2Id,
        'Chai Point Express',
        'chai-point-express',
        'TEA_SNACKS',
        'FOOD',
        'Kothrud, Pune',
        '+919822334455',
        '07:00',
        '23:00',
        'Asia/Kolkata',
        'ACTIVE',
        now.toISOString(),
        now.toISOString(),
      ]
    );

    await client.query(
      `INSERT INTO store_settings (id, store_id, voice_enabled, voice_language, voice_verbosity, typical_prep_time_minutes, ticket_prefix, upi_id, upi_name)
       VALUES ($1, $2, true, 'en-IN', 'BRIEF', 5, '#', 'chaipoint@okhdfcbank', 'Chai Point Express')`,
      [crypto.randomUUID(), store2Id]
    );

    await client.query(
      `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, pin_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'user_chaipoint_owner',
        '9822334455',
        'Suresh Patil',
        'OWNER',
        merchant2Id,
        JSON.stringify([store2Id]),
        hashPin(SEED_PIN),
        'ACTIVE',
        now.toISOString(),
        now.toISOString(),
      ]
    );

    // ==========================================
    // 3. MERCHANT 3: Nila Naturals (RETAIL shop)
    // Natural-goods store / small redistributor — packs + loose goods, per-SKU
    // stock, wholesale shop orders and a credit book. Mirrors the floq Retail
    // design so the retail screens have a realistic catalogue to render.
    // ==========================================
    const merchant3Id = 'merchant_nila_03';
    const store3Id = 'store_nila_03';
    const DAY_MS = 24 * 60 * 60 * 1000;

    await client.query(
      `INSERT INTO merchants (id, name, phone, email, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [merchant3Id, 'Nila Naturals', '+919445566778', 'owner@nilanaturals.in', 'ACTIVE', now.toISOString(), now.toISOString()]
    );

    await client.query(
      `INSERT INTO stores (id, merchant_id, name, name_local, slug, store_type, mode, address, phone, opening_time, closing_time, timezone, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        store3Id,
        merchant3Id,
        'Nila Naturals',
        'நிலா நேச்சுரல்ஸ்',
        'nila-naturals',
        'GROCERY',
        'RETAIL',
        'Gandhipuram, Coimbatore',
        '+919445566778',
        '08:00',
        '21:00',
        'Asia/Kolkata',
        'ACTIVE',
        now.toISOString(),
        now.toISOString(),
      ]
    );

    await client.query(
      `INSERT INTO store_settings (id, store_id, secondary_language, voice_enabled, voice_language, voice_verbosity, typical_prep_time_minutes, ticket_prefix, upi_id, upi_name)
       VALUES ($1, $2, 'ta', false, 'ta-IN', 'BRIEF', 0, 'FL', 'nilanaturals@okaxis', 'Nila Naturals')`,
      [crypto.randomUUID(), store3Id]
    );

    await client.query(
      `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, pin_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'user_nila_owner',
        '9445566778',
        'Nila Naturals',
        'OWNER',
        merchant3Id,
        JSON.stringify([store3Id]),
        hashPin(SEED_PIN),
        'ACTIVE',
        now.toISOString(),
        now.toISOString(),
      ]
    );

    // Categories with their default reorder supplier.
    const retailCats: { name: string; supplier: string }[] = [
      { name: 'Oils', supplier: 'Kerala Coco Farms' },
      { name: 'Snacks', supplier: 'Malabar Snacks' },
      { name: 'Powders', supplier: 'Green Leaf Herbals' },
      { name: 'Loose', supplier: 'Erode Traders' },
    ];
    const retailCatId: Record<string, string> = {};
    for (let i = 0; i < retailCats.length; i++) {
      const id = `ncat_${i + 1}`;
      retailCatId[retailCats[i].name] = id;
      await client.query(
        `INSERT INTO categories (id, store_id, name, supplier, sort_order, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, $6)`,
        [id, store3Id, retailCats[i].name, retailCats[i].supplier, i, now.toISOString()]
      );
    }

    // Packed + loose catalogue. Packs: [size, price, wholesale, cost, stock, caseQty, daily, expiry?].
    type PackSeed = [string, number, number, number, number, number, number, string?];
    const retailProducts: {
      id: string; name: string; local: string; cat: string;
      packs?: PackSeed[]; loose?: { perKg: number; stockKg: number; daily: number };
    }[] = [
      { id: 'vco', name: 'Virgin coconut oil', local: 'விர்ஜின் தேங்காய் எண்ணெய்', cat: 'Oils', packs: [['500 ml', 320, 280, 240, 34, 12, 3], ['1 L', 590, 520, 450, 6, 12, 2]] },
      { id: 'gno', name: 'Cold-pressed groundnut oil', local: 'மரச்செக்கு கடலை எண்ணெய்', cat: 'Oils', packs: [['1 L', 380, 340, 300, 18, 12, 1.5]] },
      { id: 'bch', name: 'Banana chips', local: 'நேந்திரம் சிப்ஸ்', cat: 'Snacks', packs: [['200 g', 90, 72, 58, 9, 24, 4], ['500 g', 210, 175, 140, 22, 12, 1.5]] },
      { id: 'jck', name: 'Jackfruit chips', local: 'பலாப்பழ சிப்ஸ்', cat: 'Snacks', packs: [['200 g', 120, 98, 78, 15, 24, 1]] },
      { id: 'mor', name: 'Moringa powder', local: 'முருங்கை இலைப் பொடி', cat: 'Powders', packs: [['100 g', 150, 120, 90, 4, 24, 2], ['250 g', 340, 280, 210, 11, 12, 0.8, '6 expire in 12 days']] },
      { id: 'jag', name: 'Jaggery powder', local: 'வெல்லத் தூள்', cat: 'Powders', packs: [['1 kg', 120, 98, 80, 40, 10, 2]] },
      { id: 'tur', name: 'Turmeric powder (loose)', local: 'மஞ்சள் தூள் (உதிரி)', cat: 'Loose', loose: { perKg: 280, stockKg: 7.5, daily: 0.6 } },
      { id: 'mil', name: 'Millet mix (loose)', local: 'சிறுதானியக் கலவை (உதிரி)', cat: 'Loose', loose: { perKg: 160, stockKg: 12, daily: 0.8 } },
    ];
    for (let i = 0; i < retailProducts.length; i++) {
      const p = retailProducts[i];
      const pid = `nprod_${p.id}`;
      await client.query(
        `INSERT INTO products (id, store_id, category_id, name, name_local, price, is_available, sort_order, station, is_loose, per_kg, stock_grams, daily_grams, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, 'PACKAGED', $8, $9, $10, $11, $12, $13)`,
        [
          pid, store3Id, retailCatId[p.cat], p.name, p.local,
          p.loose ? p.loose.perKg : 0, i,
          !!p.loose,
          p.loose ? p.loose.perKg : null,
          p.loose ? p.loose.stockKg * 1000 : null,
          p.loose ? p.loose.daily * 1000 : null,
          now.toISOString(), now.toISOString(),
        ]
      );
      if (p.packs) {
        for (let j = 0; j < p.packs.length; j++) {
          const [size, price, ws, cost, stock, caseQty, daily, exp] = p.packs[j];
          await client.query(
            `INSERT INTO product_packs (id, product_id, store_id, size, price, wholesale_price, cost_price, stock, case_qty, daily_rate, expiry_note, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [`${pid}_${j}`, pid, store3Id, size, price, ws, cost, stock, caseQty, daily, exp || null, j]
          );
        }
      }
    }

    // Credit book — shops and regulars who owe, aged by days.
    const retailCustomers: { name: string; kind: string; owes: number; days: number; limit: number }[] = [
      { name: 'Selvi Provisions', kind: 'SHOP', owes: 12400, days: 41, limit: 15000 },
      { name: 'Green Basket Café', kind: 'SHOP', owes: 8750, days: 33, limit: 10000 },
      { name: 'Arun Bakery', kind: 'SHOP', owes: 6300, days: 18, limit: 10000 },
      { name: 'Ravi Stores', kind: 'SHOP', owes: 4200, days: 12, limit: 10000 },
      { name: 'Lakshmi Stores', kind: 'SHOP', owes: 3900, days: 26, limit: 8000 },
      { name: 'Kumar, Flat 4B', kind: 'REGULAR', owes: 1180, days: 6, limit: 3000 },
      { name: 'Meena akka', kind: 'REGULAR', owes: 640, days: 2, limit: 2000 },
    ];
    for (let i = 0; i < retailCustomers.length; i++) {
      const c = retailCustomers[i];
      const oldest = new Date(now.getTime() - c.days * DAY_MS).toISOString();
      await client.query(
        `INSERT INTO credit_customers (id, store_id, name, kind, credit_limit, owes, oldest_due_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [`ncust_${i + 1}`, store3Id, c.name, c.kind, c.limit, c.owes, oldest, now.toISOString()]
      );
    }
  });
}

if (require.main === module && (process.argv[1]?.endsWith('seed.js') || process.argv[1]?.endsWith('seed.ts'))) {
  seedDatabase(true)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
