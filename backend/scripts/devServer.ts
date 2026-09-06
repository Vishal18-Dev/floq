/**
 * LOCAL PREVIEW ONLY — runs the real backend against an in-memory pg-mem DB,
 * seeded with demo merchants, so the app can be exercised without Postgres.
 * Never use for anything real: all data lives in memory and disappears on exit.
 *
 *   npx tsx scripts/devServer.ts
 */
process.env.NODE_ENV = 'test'; // routes db/index.ts to pg-mem
delete process.env.DATABASE_URL;

const DEV_ADMIN = 'floq-dev-admin-key-local-only';

async function main() {
  const { runMigrations } = await import('../src/db/migrate');
  const { seedDatabase, SEED_PIN } = await import('../src/db/seed');
  const { createServer } = await import('../src/server');

  await runMigrations();
  await seedDatabase(true);

  const app = createServer();
  await new Promise<void>((resolve) => app.listen(4000, '0.0.0.0', () => resolve()));
  console.log('🧪 Dev preview backend on http://localhost:4000 (pg-mem, in-memory)');

  // Onboard a RETAIL reseller so both modes can be demoed.
  try {
    await fetch('http://localhost:4000/api/admin/onboard-merchant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': DEV_ADMIN },
      body: JSON.stringify({
        merchantName: 'Keramruth Store',
        phone: '9000000001',
        pin: '1234',
        storeName: 'Keramruth Swadeshi',
        mode: 'RETAIL',
        secondaryLanguage: 'hi',
        upiId: 'keramruth@upi',
        items: [
          { name: 'Wood-pressed Groundnut Oil 1L', nameLocal: 'मूंगफली तेल 1L', price: 320, category: 'Oils' },
          { name: 'A2 Cow Ghee 500ml', nameLocal: 'गाय घी 500ml', price: 750, category: 'Dairy' },
          { name: 'Raw Forest Honey 500g', nameLocal: 'कच्चा शहद 500g', price: 350, category: 'Grocery' },
          { name: 'Jaggery Powder 1kg', nameLocal: 'गुड़ पाउडर 1kg', price: 120, category: 'Grocery' },
        ],
      }),
    });
  } catch {}

  console.log('\n  Food counter : phone 9876543210  PIN ' + SEED_PIN + '  (Sharma Breakfast Corner)');
  console.log('  Retail store : phone 9000000001  PIN 1234  (Keramruth Swadeshi)\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
