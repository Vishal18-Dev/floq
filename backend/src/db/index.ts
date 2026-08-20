import { Pool as PgPool, PoolClient } from 'pg';
import { newDb, IMemoryDb } from 'pg-mem';
import { config } from '../config';

let pool: any = null;
let memDbInstance: IMemoryDb | null = null;

export function getPool(): any {
  if (pool) return pool;

  // Use in-memory pg-mem database for Vitest unit tests if no live DATABASE_URL is configured
  if (config.isTest && !process.env.DATABASE_URL) {
    memDbInstance = newDb();

    memDbInstance.public.registerFunction({
      name: 'now',
      returns: memDbInstance.public.getType('timestamp' as any),
      implementation: () => new Date(),
    });

    const { Pool: MemPool } = memDbInstance.adapters.createPg();
    pool = new MemPool();
    return pool;
  }

  const connectionString = config.databaseUrl || 'postgresql://floq:floq_dev_password_2026@localhost:5432/floq_db';
  const ssl = config.isProduction ? { rejectUnauthorized: false } : false;

  pool = new PgPool({
    connectionString,
    ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  const res = await p.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<number> {
  const p = getPool();
  const res = await p.query(sql, params);
  return res.rowCount || 0;
}

export async function transaction<T>(callback: (client: PoolClient | any) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    if (client.release) client.release();
  }
}

export function getDatabase() {
  return {
    query,
    queryOne,
    execute,
    transaction,
  };
}
