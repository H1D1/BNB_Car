// Applies supabase/migrations/*.sql in order, tracking applied files in public._migrations.
// Usage: npm run db:migrate            (dev project, .env.local)
//        npm run db:migrate -- --prod  (real-data project, .env.production.local; also marks it as production)
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { PROD } from './env.mjs';

const dir = path.resolve('supabase/migrations');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`);
await client.query(`alter table public._migrations enable row level security`);
const done = new Set((await client.query('select name from public._migrations')).rows.map((r) => r.name));

for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(file)) continue;
  const sql = await readFile(path.join(dir, file), 'utf8');
  process.stdout.write(`applying ${file} ... `);
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into public._migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log('ok');
  } catch (err) {
    await client.query('rollback');
    console.log('FAILED');
    console.error(err.message, err.position ? `(at char ${err.position})` : '');
    process.exitCode = 1;
    break;
  }
}
if (PROD && !process.exitCode) {
  // read by refuseProduction() in scripts/env.mjs (RLS on, no policies: invisible to the API)
  await client.query(`create table if not exists public._environment (name text primary key);
    alter table public._environment enable row level security;
    insert into public._environment values ('production') on conflict do nothing;`);
  console.log('marked database as production');
}
await client.end();
