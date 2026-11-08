import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { AcceptInviteSchema } from '@floq/validation';
import { queryOne, transaction } from '../../db';
import { authService } from '../../services/authService';
import { verifyFirebaseIdToken } from '../../services/firebaseAuth';

const router = Router();

/** Current effective status: a PENDING invite past its expiry reads EXPIRED. */
function effectiveStatus(row: any): string {
  if (row.status === 'PENDING' && row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return 'EXPIRED';
  }
  return row.status;
}

// GET /api/invites/:code — look up an invite before OTP, so the join screen can
// show who invited you and to which store. Reveals only store/owner/role.
router.get('/:code', async (req: Request, res: Response) => {
  const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const invite = await queryOne('SELECT * FROM staff_invites WHERE code = $1', [code]);
  if (!invite) {
    res.status(404).json({ valid: false, reason: 'NOT_FOUND', message: "This code doesn't work. Check it with the owner." });
    return;
  }
  const status = effectiveStatus(invite);
  if (status !== 'PENDING') {
    const message =
      status === 'EXPIRED'
        ? 'This invite has expired. Invites last 7 days — ask the owner to send a new one.'
        : status === 'ACCEPTED'
        ? 'This invite has already been used.'
        : 'This invite was cancelled. Ask the owner for a new one.';
    res.status(410).json({ valid: false, reason: status, message });
    return;
  }
  const store = await queryOne('SELECT name, city FROM stores WHERE id = $1', [invite.store_id]);
  const owner = await queryOne("SELECT name FROM users WHERE merchant_id = $1 AND role = 'OWNER' LIMIT 1", [invite.merchant_id]);
  res.json({
    valid: true,
    storeName: store?.name || 'the store',
    ownerName: owner?.name || undefined,
    city: store?.city || undefined,
    role: invite.role,
    title: invite.title || (invite.role === 'MANAGER' ? 'Manager' : 'Staff'),
  });
});

// POST /api/invites/:code/accept — join the store. Gated by an OTP on the
// invited number: the verified phone must match the one the invite was for.
router.post('/:code/accept', async (req: Request, res: Response) => {
  try {
    const input = AcceptInviteSchema.parse(req.body);
    const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    let identity;
    try {
      identity = await verifyFirebaseIdToken(input.idToken);
    } catch (e: any) {
      res.status(401).json({ error: 'INVALID_TOKEN', message: e?.message || 'Could not verify OTP' });
      return;
    }
    if (!identity.phoneNumber) {
      res.status(400).json({ error: 'NO_PHONE', message: 'OTP token has no phone number' });
      return;
    }
    const cleanPhone = identity.phoneNumber.replace(/\D/g, '').slice(-10);

    const invite = await queryOne('SELECT * FROM staff_invites WHERE code = $1', [code]);
    if (!invite || effectiveStatus(invite) !== 'PENDING') {
      res.status(410).json({ error: 'INVITE_INVALID', message: "This invite can't be used. Ask the owner for a new one." });
      return;
    }
    if (invite.invited_phone && String(invite.invited_phone).replace(/\D/g, '').slice(-10) !== cleanPhone) {
      const masked = `+91 ${String(invite.invited_phone).slice(0, 5)} •••${String(invite.invited_phone).slice(-2)}`;
      res.status(403).json({
        error: 'WRONG_NUMBER',
        message: `This invite was sent to ${masked}. Use that number, or ask the owner to invite this one.`,
      });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3', [
      cleanPhone,
      `+91${cleanPhone}`,
      `%${cleanPhone}`,
    ]);
    if (existing) {
      res.status(409).json({ error: 'ACCOUNT_EXISTS', message: 'This number already has a floq account. Log in with it instead.' });
      return;
    }

    const now = new Date().toISOString();
    const userId = `user_${cleanPhone}`;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8)`,
        [userId, cleanPhone, input.name || invite.title || 'Team member', invite.role, invite.merchant_id, JSON.stringify([invite.store_id]), now, now]
      );
      await client.query(
        `INSERT INTO staff (id, store_id, name, phone, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)`,
        [crypto.randomUUID(), invite.store_id, input.name || 'Team member', cleanPhone, invite.role, now]
      );
      await client.query("UPDATE staff_invites SET status = 'ACCEPTED', accepted_at = $1, accepted_user_id = $2 WHERE id = $3", [
        now,
        userId,
        invite.id,
      ]);
    });

    const session = await authService.loginWithVerifiedPhone(cleanPhone);
    res.status(201).json(session);
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      res.status(400).json({ error: 'INVALID_INPUT', message: err.errors?.[0]?.message || 'Invalid input' });
      return;
    }
    res.status(500).json({ error: 'ACCEPT_FAILED', message: err?.message || 'Could not join the store' });
  }
});

export default router;
