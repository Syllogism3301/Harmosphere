// Development-only PostgreSQL engine. Never used by the production entrypoint.
import 'reflect-metadata';
import { PGlite } from '@electric-sql/pglite';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONFIG, readConfig } from '../src/config';
import { DATABASE, Database, Sql } from '../src/database/database';
import { providers, controllers } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { QuizRepository } from '../src/quiz/quiz.repository';
import { ContentRepository } from '../src/content/content.repository';
import { contentSeed } from '../src/content/seed';
import { AccountRepository } from '../src/auth/account.repository';
import { AccountService } from '../src/auth/account.service';
import { writeFile } from 'node:fs/promises';

async function main() {
  const c = readConfig();
  if (c.NODE_ENV !== 'development' || c.PAYMENTS_ENABLED !== 'false') throw new Error('Local mode requires development and disabled payments');
  c.LOCAL_MAILBOX = true;
  const folder = resolve('../../.tools/dev-database'); await mkdir(folder, { recursive: true });
  const pg = new PGlite(folder);
  const adapt = (p: any): Sql => ({ query: (text, values) => p.query(text, values) });
  const db: Database = { ...adapt(pg), transaction: work => pg.transaction(tx => work(adapt(tx))) };
  await pg.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of (await readdir('migrations')).filter(f => f.endsWith('.sql')).sort()) {
    if ((await db.query('SELECT name FROM schema_migrations WHERE name=$1', [name])).rows.length) continue;
    await pg.transaction(async tx => { await tx.exec(await readFile(resolve('migrations', name), 'utf8')); await tx.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]); });
  }
  @Module({ controllers, providers: [{ provide: CONFIG, useValue: c }, { provide: DATABASE, useValue: db }, ...providers] })
  class LocalModule {}
  const app = await NestFactory.create<NestExpressApplication>(LocalModule, { rawBody: true });
  configureApp(app); await app.get(QuizRepository).seed();
  await app.get(ContentRepository).seed(contentSeed);
  await app.listen(c.PORT, '127.0.0.1');
  console.log('Local-only API ready. Database persists in .tools/dev-database. Payments disabled.');
  const mailbox = resolve('../../.tools/mailbox'); await mkdir(mailbox, { recursive: true });
  const mailRepo = app.get(AccountRepository); const accounts = app.get(AccountService);
  let delivering = false;
  const deliver = async () => {
    if (delivering) return; delivering = true;
    try {
      for (const mail of await mailRepo.pendingMail()) {
        await writeFile(resolve(mailbox, `${mail.id}.json`), JSON.stringify(accounts.decryptMail(mail.encrypted_payload), null, 2), { mode: 0o600 });
        await mailRepo.delivered(mail.id);
      }
    } catch { console.error('Local mailbox delivery will retry.'); } finally { delivering = false; }
  };
  const mailTimer = setInterval(deliver, 1000); mailTimer.unref();
  console.log('Account e-mails are written to .tools/mailbox, never sent externally.');
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; clearInterval(mailTimer); await app.close(); await pg.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(() => { console.error('Local startup failed. Run npm run setup and check that port 4000 is available.'); process.exitCode = 1; });
