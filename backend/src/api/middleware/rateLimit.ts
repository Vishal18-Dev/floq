import { Request, Response, NextFunction } from 'express';

/**
 * Fixed-window rate limiter.
 * ponytail: in-memory, so limits are per server instance and reset on deploy.
 * Swap the Map for Redis (or use express-rate-limit with a Redis store) before
 * running more than one instance.
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string | null;
  message?: string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const keyOf = opts.key || ((req: Request) => req.ip || 'unknown');

  // Drop expired windows so the map can't grow without bound.
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyOf(req);
    if (!key) return next();
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: opts.message || 'Too many requests. Please wait a few minutes and try again.',
      });
      return;
    }
    next();
  };
}

const MIN = 60 * 1000;

/** Last 10 digits of the phone in the body, so "+91 98…" and "98…" share a bucket. */
const bodyPhone = (req: Request) => {
  const digits = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `phone:${digits}` : null;
};

// IP limits stay generous: many Indian mobile users share one carrier IP (CGNAT).
// A factory, so each server instance (and each test app) gets its own counters.
export const createLimits = () => ({
  loginIp: rateLimit({ windowMs: 15 * MIN, max: 30 }),
  loginPhone: rateLimit({
    windowMs: 15 * MIN,
    max: 10,
    key: bodyPhone,
    message: 'Too many login attempts for this number. Try again in 15 minutes.',
  }),
  otpLogin: rateLimit({ windowMs: 15 * MIN, max: 30 }),
  signup: rateLimit({ windowMs: 60 * MIN, max: 10 }),
  invites: rateLimit({ windowMs: 15 * MIN, max: 30 }),
  publicApi: rateLimit({ windowMs: MIN, max: 60 }),
  admin: rateLimit({ windowMs: 15 * MIN, max: 20 }),
});
