import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';

/** An error that carries its own HTTP status and code; its message is safe to show. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }

  console.error('[FLOQ Server Error]:', err);

  // Match by name too: the validation package can load a separate zod module instance.
  if (err instanceof ZodError || err?.name === 'ZodError') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input provided. Please check the required fields.',
      details: err.errors.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err.message && err.message.includes('Invalid status transition')) {
    res.status(409).json({
      error: 'INVALID_STATE_TRANSITION',
      message: err.message,
    });
    return;
  }

  if (err.message && (err.message.includes('Invalid') || err.message.includes('not found') || err.message.includes('OTP') || err.message.includes('mobile'))) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: err.message,
    });
    return;
  }

  // Only real 500s go to Sentry (a no-op until SENTRY_DSN is set).
  Sentry.captureException(err);
  // Never echo internal error text (SQL, ids, stack details) to the client; it's logged above.
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Something went wrong on our side. Please try again.',
  });
}
