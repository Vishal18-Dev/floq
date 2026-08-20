import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query, queryOne, execute } from '../../db';
import { CreateProductSchema, UpdateProductSchema, CreateCategorySchema } from '@floq/validation';
import crypto from 'crypto';

const router = Router();

// GET /api/products - Get all categories and products for the authenticated store
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const categories = await query(
      'SELECT * FROM categories WHERE store_id = $1 AND is_active = true ORDER BY sort_order ASC',
      [req.storeId]
    );

    const products = await query('SELECT * FROM products WHERE store_id = $1 ORDER BY sort_order ASC', [
      req.storeId,
    ]);

    const mappedProducts = products.map((p) => ({
      id: p.id,
      storeId: p.store_id,
      categoryId: p.category_id,
      name: p.name,
      description: p.description || undefined,
      price: Number(p.price),
      imageUrl: p.image_url || undefined,
      isAvailable: Boolean(p.is_available),
      sortOrder: p.sort_order,
      station: p.station,
      modifiers: [],
      createdAt: new Date(p.created_at).toISOString(),
      updatedAt: new Date(p.updated_at).toISOString(),
    }));

    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        storeId: c.store_id,
        name: c.name,
        sortOrder: c.sort_order,
        isActive: Boolean(c.is_active),
        createdAt: new Date(c.created_at).toISOString(),
      })),
      products: mappedProducts,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/products - Create a new product
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = CreateProductSchema.parse(req.body);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO products (id, store_id, category_id, name, description, price, is_available, sort_order, station, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        req.storeId,
        input.categoryId,
        input.name,
        input.description || null,
        input.price,
        input.isAvailable !== false,
        input.sortOrder,
        input.station,
        now,
        now,
      ]
    );

    const created = await queryOne('SELECT * FROM products WHERE id = $1', [id]);
    res.status(201).json({
      product: {
        id: created.id,
        storeId: created.store_id,
        categoryId: created.category_id,
        name: created.name,
        description: created.description,
        price: Number(created.price),
        imageUrl: created.image_url,
        isAvailable: Boolean(created.is_available),
        sortOrder: created.sort_order,
        station: created.station,
        createdAt: new Date(created.created_at).toISOString(),
        updatedAt: new Date(created.updated_at).toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id - Update product
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = UpdateProductSchema.parse(req.body);
    const productId = req.params.id;

    const fields: string[] = ['updated_at = $1'];
    const values: any[] = [new Date().toISOString()];
    let idx = 2;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.price !== undefined) {
      fields.push(`price = $${idx++}`);
      values.push(input.price);
    }
    if (input.categoryId !== undefined) {
      fields.push(`category_id = $${idx++}`);
      values.push(input.categoryId);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(input.description);
    }
    if (input.isAvailable !== undefined) {
      fields.push(`is_available = $${idx++}`);
      values.push(input.isAvailable);
    }
    if (input.sortOrder !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      values.push(input.sortOrder);
    }
    if (input.station !== undefined) {
      fields.push(`station = $${idx++}`);
      values.push(input.station);
    }

    const prodParamIdx = idx++;
    const storeParamIdx = idx++;
    values.push(productId, req.storeId);

    const changes = await execute(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${prodParamIdx} AND store_id = $${storeParamIdx}`,
      values
    );

    if (changes === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const updated = await queryOne('SELECT * FROM products WHERE id = $1', [productId]);
    res.json({
      product: {
        id: updated.id,
        storeId: updated.store_id,
        categoryId: updated.category_id,
        name: updated.name,
        description: updated.description,
        price: Number(updated.price),
        imageUrl: updated.image_url,
        isAvailable: Boolean(updated.is_available),
        sortOrder: updated.sort_order,
        station: updated.station,
        createdAt: new Date(updated.created_at).toISOString(),
        updatedAt: new Date(updated.updated_at).toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const changes = await execute('DELETE FROM products WHERE id = $1 AND store_id = $2', [req.params.id, req.storeId]);
    if (changes === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/categories - Create category
router.post('/categories', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = CreateCategorySchema.parse(req.body);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO categories (id, store_id, name, sort_order, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.storeId, input.name, input.sortOrder, input.isActive !== false, now]
    );

    res.status(201).json({
      category: {
        id,
        storeId: req.storeId,
        name: input.name,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        createdAt: now,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
