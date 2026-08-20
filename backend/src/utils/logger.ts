import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set(['authorization', 'password', 'token', 'otp', 'cardnumber', 'cvv', 'jwtsecret', 'secret']);

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private formatLog(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const env = config.nodeEnv;
    const sanitizedMeta = meta ? sanitizeData(meta) : undefined;
    return JSON.stringify({
      timestamp,
      env,
      level,
      message,
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
    });
  }

  public info(message: string, meta?: any) {
    console.log(this.formatLog('info', message, meta));
  }

  public warn(message: string, meta?: any) {
    console.warn(this.formatLog('warn', message, meta));
  }

  public error(message: string, meta?: any) {
    console.error(this.formatLog('error', message, meta));
  }

  public debug(message: string, meta?: any) {
    if (config.isDevelopment) {
      console.debug(this.formatLog('debug', message, meta));
    }
  }
}

export const logger = new Logger();
