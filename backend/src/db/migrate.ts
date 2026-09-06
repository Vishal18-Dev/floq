import fs from 'fs';
import path from 'path';
import { query, queryOne, transaction } from './index';
import { config } from '../config';

export async function runMigrations(): Promise<void> {
  const possibleDirs = [
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '../src/db/migrations'),
    path.join(process.cwd(), 'src/db/migrations'),
    path.join(process.cwd(), 'backend/src/db/migrations'),
  ];

  const migrationsDir = possibleDirs.find((d) => fs.existsSync(d));

  if (!migrationsDir) {
    console.log('⚠️ No migrations directory found.');
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

      if (config.isTest && !process.env.DATABASE_URL) {
        // pg-mem can't run a multi-statement string, so we split on ';'. Strip
        // line comments FROM EACH chunk (not just chunks that start with '--'),
        // otherwise a statement preceded by a comment line gets silently dropped.
        const statements = sqlContent
          .split(';')
          .map((s) =>
            s
              .split('\n')
              .filter((line) => !line.trimStart().startsWith('--'))
              .join('\n')
              .trim()
          )
          .filter((s) => s.length > 0);

        await transaction(async (client) => {
          for (const stmt of statements) {
            await client.query(stmt);
          }
          await client.query(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
            [version, file, new Date().toISOString()]
          );
        });
      } else {
        await transaction(async (client) => {
          await client.query(sqlContent);
          await client.query(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
            [version, file, new Date().toISOString()]
          );
        });
      }
      console.log(`✅ Applied migration: ${file}`);
    }
  }
}

if (require.main === module && (process.argv[1]?.endsWith('migrate.js') || process.argv[1]?.endsWith('migrate.ts'))) {
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
