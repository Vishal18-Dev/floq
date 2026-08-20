import fs from 'fs';
import path from 'path';
import { query, queryOne, transaction } from './index';

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  // Ensure migrations tracking table exists (simple DDL for pg-mem compatibility)
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version int,
      name text,
      applied_at text
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const versionMatch = file.match(/^(\d+)_/);
    if (!versionMatch) continue;

    const version = parseInt(versionMatch[1], 10);
    const existing = await queryOne('SELECT version FROM schema_migrations WHERE version = $1', [version]);

    if (!existing) {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      const statements = sqlContent
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      await transaction(async (client) => {
        for (const stmt of statements) {
          await client.query(stmt);
        }
        await client.query(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
          [version, file, new Date().toISOString()]
        );
      });
      console.log(`✅ Applied migration: ${file}`);
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Database migrations completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
