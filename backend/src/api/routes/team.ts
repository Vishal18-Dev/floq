import { Router, Response } from 'express';
import crypto from 'crypto';
import { CreateInviteSchema } from '@floq/validation';
import { AuthenticatedRequest } from '../middleware/auth';
import { query, queryOne } from '../../db';

const router = Router();

// Unambiguous alphabet (no I/O/0/1). ponytail: short, phone-gated, single-use,
// 7-day invite code — lengthen the random part if invites ever go public.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function genCode(): string {
  let c = 'FLQ';
  for (let i = 0; i < 3; i++) c += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return c;
}

function mapInvite(row: any) {
  return {
    id: row.id,
    storeId: row.store_id,
    merchantId: row.merchant_id,
    code: row.code,
    invitedPhone: row.invited_phone || undefined,
    role: row.role,
    title: row.title || undefined,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// POST /api/team/invites — owner/manager invites a helper by mobile + role.
router.post('/invites', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = CreateInviteSchema.parse(req.body);
    const store = await queryOne('SELECT id, merchant_id FROM stores WHERE id = $1', [req.storeId]);
    if (!store) {
      res.status(404).json({ error: 'STORE_NOT_FOUND', message: 'Store not found' });
      return;
    }
    const phone = input.phone.replace(/\D/g, '').slice(-10);

    // Can't invite the owner's own number, or a number already on the store.
    const owner = await queryOne('SELECT phone FROM users WHERE id = $1', [req.userId]);
    if (owner && String(owner.phone).replace(/\D/g, '').slice(-10) === phone) {
      res.status(400).json({ error: 'OWN_NUMBER', message: "That's your own number — you're already the owner." });
      return;
    }
    const existingMember = await queryOne(
      'SELECT id FROM users WHERE (phone = $1 OR phone LIKE $2) AND merchant_id = $3',
      [phone, `%${phone}`, store.merchant_id]
    );
    if (existingMember) {
      res.status(409).json({ error: 'ALREADY_MEMBER', message: 'This number is already on your team.' });
      return;
    }
    // Reuse an existing pending invite for the same number rather than piling up.
    const pending = await queryOne(
      "SELECT * FROM staff_invites WHERE store_id = $1 AND invited_phone = $2 AND status = 'PENDING'",
      [store.id, phone]
    );
    if (pending) {
      res.status(200).json({ invite: mapInvite(pending), reused: true });
      return;
    }

    // Generate a unique code (retry on the rare collision).
    let code = genCode();
    for (let tries = 0; tries < 6; tries++) {
      const clash = await queryOne('SELECT id FROM staff_invites WHERE code = $1', [code]);
      if (!clash) break;
      code = genCode();
    }
    const now = new Date();
    const row = {
      id: crypto.randomUUID(),
      store_id: store.id,
      merchant_id: store.merchant_id,
      code,
      invited_phone: phone,
      role: input.role,
      title: input.title || (input.role === 'MANAGER' ? 'Manager' : 'Staff'),
      created_by: req.userId || null,
      status: 'PENDING',
      expires_at: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
      created_at: now.toISOString(),
    };
    await query(
      `INSERT INTO staff_invites (id, store_id, merchant_id, code, invited_phone, role, title, created_by, status, expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [row.id, row.store_id, row.merchant_id, row.code, row.invited_phone, row.role, row.title, row.created_by, row.status, row.expires_at, row.created_at]
    );
    res.status(201).json({ invite: mapInvite(row) });
  } catch (err) {
    next(err);
  }
});

// GET /api/team/invites — pending invites for this store.
router.get('/invites', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const rows = await query(
      "SELECT * FROM staff_invites WHERE store_id = $1 AND status = 'PENDING' ORDER BY created_at DESC",
      [req.storeId]
    );
    res.json({ invites: rows.map(mapInvite) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/team/invites/:id — revoke a pending invite.
router.delete('/invites/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await query("UPDATE staff_invites SET status = 'REVOKED' WHERE id = $1 AND store_id = $2 AND status = 'PENDING'", [
      req.params.id,
      req.storeId,
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/team/members — the store's people (owner + joined staff).
router.get('/members', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const store = await queryOne('SELECT merchant_id FROM stores WHERE id = $1', [req.storeId]);
    const rows = store
      ? await query('SELECT id, phone, name, role FROM users WHERE merchant_id = $1 ORDER BY created_at', [store.merchant_id])
      : [];
    res.json({ members: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
