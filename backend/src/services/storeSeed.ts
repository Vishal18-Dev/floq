import crypto from 'crypto';
import type { PoolClient } from 'pg';
import type { OnboardItemInput, OnboardCustomerInput } from '@floq/validation';

export interface SeedContentsInput {
  items?: OnboardItemInput[];
  customers?: OnboardCustomerInput[];
  suppliers?: Record<string, string>;
  initialCategoryName?: string;
  mode?: 'FOOD' | 'RETAIL';
}

export interface SeedResult {
  initialCategoryId: string;
  itemsCreated: number;
  packsCreated: number;
  customersCreated: number;
}

/**
 * Seed a store's catalogue, opening stock and credit book inside an existing
 * transaction. Shared by white-glove admin onboarding (fresh store) and the
 * self-serve wizard's /stores/seed (store already has a starter category).
 *
 * Idempotent on categories by NAME: existing categories are reused (and their
 * supplier updated when given), so calling this after signup — which already
 * created one starter category — never collides.
 */
export async function seedStoreContents(
  client: Pick<PoolClient, 'query'>,
  storeId: string,
  slug: string,
  input: SeedContentsInput
): Promise<SeedResult> {
  const now = new Date().toISOString();
  const slugKey = slug.replace(/-/g, '_');
  const items = input.items || [];
  const suppliers = input.suppliers || {};
  const initialCategoryName = input.initialCategoryName || (input.mode === 'FOOD' ? 'Menu' : 'Products');

  // Reuse existing categories by name; track the next free sort index for new ones.
  const existing = await client.query('SELECT id, name, sort_order FROM categories WHERE store_id = $1', [storeId]);
  const catIdByName: Record<string, string> = {};
  let catSort = 0;
  for (const row of existing.rows) {
    catIdByName[row.name] = row.id;
    catSort = Math.max(catSort, (Number(row.sort_order) || 0) + 1);
  }

  const categoryNames = Array.from(new Set(items.map((it) => it.category || initialCategoryName)));
  if (!categoryNames.includes(initialCategoryName)) categoryNames.push(initialCategoryName);

  for (const catName of categoryNames) {
    const supplier = suppliers[catName] || null;
    if (catIdByName[catName]) {
      if (supplier) await client.query('UPDATE categories SET supplier = $1 WHERE id = $2', [supplier, catIdByName[catName]]);
      continue;
    }
    const catId = `cat_${slugKey}_${catSort}`;
    catIdByName[catName] = catId;
    await client.query(
      `INSERT INTO categories (id, store_id, name, supplier, sort_order, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [catId, storeId, catName, supplier, catSort, true, now]
    );
    catSort++;
  }
  const initialCategoryId = catIdByName[initialCategoryName] || Object.values(catIdByName)[0] || '';

  let itemSort = 0;
  let packsCreated = 0;
  for (const it of items) {
    const catName = it.category || initialCategoryName;
    const productId = crypto.randomUUID();
    const loose = !!it.isLoose;
    await client.query(
      `INSERT INTO products (id, store_id, category_id, name, name_local, price, is_available, sort_order, station, is_loose, per_kg, stock_grams, daily_grams, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        productId,
        storeId,
        catIdByName[catName],
        it.name,
        it.nameLocal || null,
        loose ? it.perKg ?? 0 : it.price ?? 0,
        true,
        itemSort,
        it.station || (input.mode === 'FOOD' ? 'HOT_FOOD' : 'PACKAGED'),
        loose,
        loose ? it.perKg ?? 0 : null,
        loose ? Math.round((it.stockKg ?? 0) * 1000) : null,
        loose ? Math.round((it.dailyKg ?? 0) * 1000) : null,
        now,
        now,
      ]
    );
    const packs = it.packs || [];
    for (let j = 0; j < packs.length; j++) {
      const k = packs[j];
      await client.query(
        `INSERT INTO product_packs (id, product_id, store_id, size, price, wholesale_price, cost_price, stock, case_qty, daily_rate, expiry_note, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          `${productId}_${j}`,
          productId,
          storeId,
          k.size,
          k.price,
          k.wholesalePrice ?? null,
          k.costPrice ?? null,
          k.stock ?? 0,
          k.caseQty ?? null,
          k.dailyRate ?? 0,
          k.expiryNote ?? null,
          j,
        ]
      );
      packsCreated++;
    }
    itemSort++;
  }

  // Opening credit book (existing khata accounts).
  const DAY_MS = 24 * 60 * 60 * 1000;
  let customersCreated = 0;
  for (const c of input.customers || []) {
    const owes = c.owes ?? 0;
    const oldest = owes > 0 ? new Date(Date.now() - (c.oldestDueDays ?? 0) * DAY_MS).toISOString() : null;
    await client.query(
      `INSERT INTO credit_customers (id, store_id, name, kind, phone, credit_limit, owes, oldest_due_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [crypto.randomUUID(), storeId, c.name, c.kind || 'REGULAR', c.phone || null, c.creditLimit ?? 0, owes, oldest, now]
    );
    customersCreated++;
  }

  return { initialCategoryId, itemsCreated: items.length, packsCreated, customersCreated };
}
