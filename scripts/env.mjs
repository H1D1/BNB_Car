// Shared env loading for the db scripts.
//   default → .env.local (dev/demo project)
//   --prod  → .env.production.local (real-data project)
import dotenv from 'dotenv';

export const PROD = process.argv.includes('--prod');
dotenv.config({ path: PROD ? '.env.production.local' : '.env.local', quiet: true });

if (!process.env.DATABASE_URL) {
  console.error(`DATABASE_URL missing in ${PROD ? '.env.production.local' : '.env.local'}`);
  process.exit(1);
}

/**
 * Demo/test data must never reach the real-data project. The production database is marked with
 * a row in public._environment (written by `npm run db:migrate -- --prod`).
 */
export async function refuseProduction(db, what) {
  const { rows: [{ marked }] } = await db.query("select to_regclass('public._environment') is not null as marked");
  const prod = marked && (await db.query("select 1 from public._environment where name = 'production'")).rowCount > 0;
  if (PROD || prod) {
    console.error(`Refusing to run ${what} against the production database.`);
    await db.end();
    process.exit(1);
  }
}
