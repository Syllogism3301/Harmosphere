import 'reflect-metadata';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PostgresDatabase } from './database';
import { readConfig } from '../config';

async function main() {
  const db = new PostgresDatabase(readConfig());
  try {
    await db.transaction(async sql => {
      await sql.query('SELECT pg_advisory_xact_lock(738215)');
      await sql.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const dir = resolve(process.cwd(), 'migrations');
      for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
        if ((await sql.query('SELECT name FROM schema_migrations WHERE name=$1', [file])).rows.length) continue;
        await sql.query(await readFile(resolve(dir, file), 'utf8'));
        await sql.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
        console.log(`Applied ${file}`);
      }
    });
  } finally { await db.onModuleDestroy(); }
}
main().catch(() => { console.error('Migration failed. Check configuration and database availability.'); process.exitCode = 1; });
