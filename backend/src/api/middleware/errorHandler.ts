import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('[FLOQ Server Error]:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input provided. Please check the required fields.',
      details: err.errors.map((e) => ({
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

  // Graceful fallback error response
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: err.message || 'An unexpected issue occurred while processing your request. Please try again.',
  });
}
