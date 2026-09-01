import crypto from 'crypto';
import { transaction } from './index';
import { runMigrations } from './migrate';
import { STORE_TEMPLATES } from '@floq/constants';
import { config } from '../config';

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
      'ticket_sequences',
      'queue_tickets',
      'payments',
      'order_items',
      'orders',
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
      `INSERT INTO stores (id, merchant_id, name, slug, store_type, address, phone, opening_time, closing_time, timezone, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        store1Id,
        merchant1Id,
        'Sharma Breakfast Corner',
        'sharma-breakfast-corner',
        'BREAKFAST',
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
      `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'user_sharma_owner',
        '9876543210',
        'Ramesh Sharma',
        'OWNER',
        merchant1Id,
        JSON.stringify([store1Id]),
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
      `INSERT INTO stores (id, merchant_id, name, slug, store_type, address, phone, opening_time, closing_time, timezone, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        store2Id,
        merchant2Id,
        'Chai Point Express',
        'chai-point-express',
        'TEA_SNACKS',
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
      `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'user_chaipoint_owner',
        '9822334455',
        'Suresh Patil',
        'OWNER',
        merchant2Id,
        JSON.stringify([store2Id]),
        'ACTIVE',
        now.toISOString(),
        now.toISOString(),
      ]
    );
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
