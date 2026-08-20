/**
 * PostgreSQL Database Backup Strategy
 *
 * NOTE: For PostgreSQL production deployment (e.g., Render Managed PostgreSQL),
 * database backups are handled natively at the infrastructure layer via automated
 * continuous WAL archiving and daily snapshot backups.
 *
 * Application-level filesystem backups are not required or performed for managed PostgreSQL.
 */

export async function getBackupInformation(): Promise<{ strategy: string; managedProvider: string }> {
  return {
    strategy: 'Managed Continuous WAL & Automated Snapshots',
    managedProvider: 'Render / Managed PostgreSQL Service',
  };
}
