import 'reflect-metadata';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DATABASE, Database, Sql } from '../src/database/database';
import { CONFIG, readConfig } from '../src/config';
import { controllers, providers } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { QuizRepository } from '../src/quiz/quiz.repository';
import { QuizService } from '../src/quiz/quiz.service';
import { PaymentsRepository } from '../src/payments/payments.repository';
import { AuthRepository } from '../src/auth/auth.repository';
import { AuthService } from '../src/auth/auth.service';
import { hash } from '../src/common/security';
import { definition } from '../src/quiz/definition';
import { scoreQuiz } from '../src/quiz/scoring';
import { verifyMercadoSignature, StripeAdapter } from '../src/payments/adapters';
import { Snapshot } from '../src/payments/payment.types';
import { AccountService } from '../src/auth/account.service';
import { AccountRepository } from '../src/auth/account.repository';
import { ContentService } from '../src/content/content.service';
import { ContentRepository } from '../src/content/content.repository';
import { contentSeed } from '../src/content/seed';

const config = readConfig({ NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:3000', DATABASE_URL: 'postgresql://test', JWT_SECRET: 'a'.repeat(96), STRIPE_SECRET_KEY: 'sk_test_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_test', LOCAL_MAILBOX: 'true', LOCAL_EDITOR_EMAIL: 'owner@example.com' });
let pg: PGlite; let db: Database; let app: NestExpressApplication;
let quiz: QuizService; let repo: QuizRepository; let payments: PaymentsRepository;
let owner: string; let other: string;
const answers = Object.fromEntries(definition.questions.map(q => [q.id, 4]));

beforeAll(async () => {
  pg = new PGlite();
  for (const migration of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) await pg.exec(readFileSync(`migrations/${migration}`, 'utf8'));
  const adapt = (p: any): Sql => ({ query: (text, values) => p.query(text, values) });
  db = { ...adapt(pg), transaction: work => pg.transaction(tx => work(adapt(tx))) };
  @Module({ controllers, providers: [{ provide: CONFIG, useValue: config }, { provide: DATABASE, useValue: db }, ...providers] })
  class TestModule {}
  app = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false, rawBody: true });
  configureApp(app); await app.init();
  quiz = app.get(QuizService); repo = app.get(QuizRepository); payments = app.get(PaymentsRepository);
  await repo.seed();
}, 30000);
beforeEach(async () => {
  await pg.exec('TRUNCATE users, sessions, used_refresh_tokens, attempts, orders, entitlements, payment_events, rate_limits, mail_outbox, content_entries CASCADE');
  owner = randomUUID(); other = randomUUID();
  await db.query("INSERT INTO users(id,email,password_hash) VALUES($1,'owner@example.com','fixture'),($2,'other@example.com','fixture')", [owner, other]);
});
afterAll(async () => { await app?.close(); await pg?.close(); });
async function completed() {
  const a = await quiz.start();
  for (let i = 0; i < definition.questions.length; i++) await quiz.answer(a.token, definition.questions[i].id, 4, i);
  await quiz.complete(a.token); return a;
}
async function ordered() {
  const a = await completed(); await quiz.claim(a.token, owner);
  const { order } = await payments.reserve(owner, a.id, 'stripe', 150, 'brl');
  const snapshot: Snapshot = { orderId: order.id, userId: owner, provider: 'stripe', paymentId: `pi_${randomUUID()}`, amountMinor: 150, currency: 'brl', status: 'PAID' };
  return { a, order, snapshot };
}
describe('Anonymous quiz and ownership', () => {
  it('persists answers, resumes using the secret cookie and never returns scores', async () => {
    const a = await quiz.start(); expect((await quiz.start(a.token)).id).toBe(a.id);
    await quiz.answer(a.token, 'q1', 5, 0);
    const current = await quiz.current(a.token, 'pt-BR');
    expect(current.answers).toEqual({ q1: 5 }); expect(current.questions).toHaveLength(30);
    expect(current).not.toHaveProperty('result'); expect(current.questions[0]).not.toHaveProperty('dimension');
    await expect(quiz.current(a.id, 'en')).rejects.toThrow('ATTEMPT_NOT_FOUND');
  });
  it('rejects stale writes, unknown questions and incomplete completion', async () => {
    const a = await quiz.start(); await quiz.answer(a.token, 'q1', 3, 0);
    await expect(quiz.answer(a.token, 'q2', 4, 0)).rejects.toThrow('STALE_REVISION');
    await expect(quiz.answer(a.token, 'q99', 4, 1)).rejects.toThrow('INVALID_QUESTION');
    await expect(quiz.complete(a.token)).rejects.toThrow('QUIZ_INCOMPLETE');
  });
  it('completes idempotently and freezes answers', async () => {
    const a = await completed(); expect(await quiz.complete(a.token)).toEqual({ id: a.id, requiresLogin: true });
    await expect(quiz.answer(a.token, 'q1', 1, 30)).rejects.toThrow('ATTEMPT_COMPLETED');
    expect(await quiz.current(a.token, 'en')).not.toHaveProperty('result');
  });
  it('claims only once and isolates the preview', async () => {
    const a = await completed(); await quiz.claim(a.token, owner);
    await expect(quiz.claim(a.token, other)).rejects.toThrow('ATTEMPT_NOT_FOUND');
    await expect(quiz.preview(a.id, other, 'en')).rejects.toThrow('RESULT_NOT_FOUND');
    const preview = await quiz.preview(a.id, owner, 'en'); expect(Object.keys(preview).sort()).toEqual(['summary', 'title']);
    await expect(quiz.full(a.id, owner, 'en')).rejects.toThrow('RESULT_LOCKED');
  });
  it('allows only one winner for concurrent claims', async () => {
    const a = await completed(); const results = await Promise.allSettled([quiz.claim(a.token, owner), quiz.claim(a.token, other)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });
});
describe('Payment authorization', () => {
  it('ignores pending payment and unlocks only the purchased attempt and user', async () => {
    const { a, snapshot } = await ordered();
    await payments.settle('pending', { ...snapshot, status: 'PENDING' });
    await expect(quiz.full(a.id, owner, 'en')).rejects.toThrow('RESULT_LOCKED');
    await payments.settle('paid', snapshot);
    expect((await quiz.full(a.id, owner, 'en')).scores).toHaveProperty('pulse');
    await expect(quiz.full(a.id, other, 'en')).rejects.toThrow('RESULT_LOCKED');
    const second = await completed(); await quiz.claim(second.token, owner);
    await expect(quiz.full(second.id, owner, 'en')).rejects.toThrow('RESULT_LOCKED');
  });
  it.each([{ amountMinor: 1 }, { currency: 'usd' }, { userId: randomUUID() }, { provider: 'mercadopago' }])('rejects a mismatched settlement %j', async change => {
    const { snapshot } = await ordered();
    await expect(payments.settle('bad', { ...snapshot, ...change } as Snapshot)).rejects.toThrow('PAYMENT_MISMATCH');
    expect((await db.query('SELECT * FROM entitlements')).rows).toHaveLength(0);
  });
  it('deduplicates delivery and never reactivates a revoked order', async () => {
    const { a, snapshot } = await ordered();
    await Promise.all([payments.settle('same', snapshot), payments.settle('same', snapshot)]);
    expect((await db.query('SELECT * FROM entitlements')).rows).toHaveLength(1);
    await payments.settle('refund', { ...snapshot, status: 'REVOKED' });
    await payments.settle('late-paid', snapshot);
    await expect(quiz.full(a.id, owner, 'en')).rejects.toThrow('RESULT_LOCKED');
  });
  it('does not create another checkout during concurrent creation or a gateway switch', async () => {
    const { a } = await ordered();
    await expect(payments.reserve(owner, a.id, 'stripe', 150, 'brl')).rejects.toThrow('CHECKOUT_RECONCILIATION_REQUIRED');
    await expect(payments.reserve(owner, a.id, 'mercadopago', 150, 'brl')).rejects.toThrow('GATEWAY_ALREADY_SELECTED');
  });
});
describe('Boundary security', () => {
  it('requires origin, rejects extra input fields, and guards results over HTTP', async () => {
    await request(app.getHttpServer()).post('/api/quiz/attempts').send({}).expect(403);
    const start = await request(app.getHttpServer()).post('/api/quiz/attempts').set('Origin', config.WEB_ORIGIN).set('X-Harmosphere', '1').send({}).expect(201);
    const cookie = start.headers['set-cookie']; expect(cookie.join('')).toContain('HttpOnly');
    await request(app.getHttpServer()).put('/api/quiz/current/answer').set('Origin', config.WEB_ORIGIN).set('X-Harmosphere', '1').set('Cookie', cookie).send({ questionId: 'q1', value: 9, revision: 0 }).expect(400);
    await request(app.getHttpServer()).put('/api/quiz/current/answer').set('Origin', config.WEB_ORIGIN).set('X-Harmosphere', '1').set('Cookie', cookie).send({ questionId: 'q1', value: 4, revision: 0, userId: owner }).expect(400);
    const locked = await request(app.getHttpServer()).get(`/api/quiz/results/${start.body.id}/full`).expect(401);
    expect(locked.headers['cache-control']).toBe('private, no-store');
    await request(app.getHttpServer()).post('/api/payments/webhooks/stripe').set('stripe-signature', 'fake').send({ type: 'checkout.session.completed' }).expect(400);
  });
  it('verifies Mercado Pago signatures, timestamps and signed resource IDs', () => {
    const now = Date.now(); const ts = Math.floor(now / 1000); const secret = 'test-secret';
    const digest = createHmac('sha256', secret).update(`id:123;request-id:request-1;ts:${ts};`).digest('hex');
    const signature = `ts=${ts},v1=${digest}`;
    expect(verifyMercadoSignature(signature, 'request-1', '123', secret, now)).toBe(true);
    expect(verifyMercadoSignature(signature, 'request-1', '456', secret, now)).toBe(false);
    expect(verifyMercadoSignature(signature, 'request-1', '123', secret, now + 600000)).toBe(false);
    expect(verifyMercadoSignature('fake', 'request-1', '123', secret, now)).toBe(false);
  });
  it('rejects a tampered Stripe webhook before looking up payment state', async () => {
    const adapter = app.get(StripeAdapter);
    await expect(adapter.notification(Buffer.from('{}'), 'bad')).rejects.toThrow('INVALID_SIGNATURE');
  });
  it('rotates refresh tokens and revokes the session on replay', async () => {
    const authRepo = app.get(AuthRepository); const auth = app.get(AuthService);
    await authRepo.createSession(owner, hash('original-token'));
    const issued = await auth.rotate('original-token');
    expect((await auth.verify(issued.access)).userId).toBe(owner);
    await expect(auth.rotate('original-token')).rejects.toThrow('SESSION_EXPIRED');
    await expect(auth.verify(issued.access)).rejects.toThrow('SESSION_EXPIRED');
  });
  it('registers and logs in with hashed passwords without returning credentials', async () => {
    const auth = app.get(AuthService);
    const registered = await auth.register('new@example.com', 'correct horse battery staple');
    const stored = (await db.query("SELECT password_hash FROM users WHERE email='new@example.com'")).rows[0].password_hash;
    expect(stored).toMatch(/^scrypt:/); expect(stored).not.toContain('correct horse');
    const loggedIn = await auth.login('new@example.com', 'correct horse battery staple');
    expect((await auth.verify(loggedIn.access)).userId).toBe((await auth.verify(registered.access)).userId);
    await expect(auth.login('new@example.com', 'incorrect password')).rejects.toThrow('INVALID_CREDENTIALS');
  }, 15000);
});
describe('Versioned scoring', () => {
  it('scores extremes deterministically and requires every answer', () => {
    const low = Object.fromEntries(definition.questions.map(q => [q.id, 1]));
    expect(Object.values(scoreQuiz(definition, low).scores)).toEqual([0,0,0,0,0]);
    const high = Object.fromEntries(definition.questions.map(q => [q.id, 5]));
    expect(Object.values(scoreQuiz(definition, high).scores)).toEqual([100,100,100,100,100]);
    expect(() => scoreQuiz(definition, { q1: 5 })).toThrow('QUIZ_INCOMPLETE');
    expect(scoreQuiz(definition, answers)).toEqual(scoreQuiz(definition, answers));
  });
  it('provides complete translations for every question and frontend message', () => {
    for (const q of definition.questions) for (const locale of ['en','pt-BR','es'] as const) expect(q.text[locale].length).toBeGreaterThan(5);
    const keys = (o: any, prefix = ''): string[] => Object.entries(o).flatMap(([key,value]) => typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
    const en = JSON.parse(readFileSync('../web/messages/en.json', 'utf8'));
    for (const locale of ['pt-BR','es']) expect(keys(JSON.parse(readFileSync(`../web/messages/${locale}.json`, 'utf8')))).toEqual(keys(en));
    const features = JSON.parse(readFileSync('../web/messages/features.en.json', 'utf8'));
    for (const locale of ['pt-BR','es']) expect(keys(JSON.parse(readFileSync(`../web/messages/features.${locale}.json`, 'utf8')))).toEqual(keys(features));
  });
});

describe('Account recovery and verification', () => {
  async function issued(purpose: 'RESET_PASSWORD' | 'VERIFY_EMAIL') {
    const service = app.get(AccountService); const mails = await app.get(AccountRepository).pendingMail();
    const mail = mails.map(m => service.decryptMail(m.encrypted_payload)).find(m => m.purpose === purpose)!;
    return { mail, raw: new URLSearchParams(new URL(mail.link).hash.slice(1)).get('token')! };
  }
  it('does not reveal unknown accounts and encrypts reset links at rest', async () => {
    const service = app.get(AccountService);
    expect(await service.requestReset('missing@example.com', 'en')).toEqual({ ok: true });
    expect(await app.get(AccountRepository).pendingMail()).toHaveLength(0);
    expect(await service.requestReset('owner@example.com', 'en')).toEqual({ ok: true });
    const { raw, mail } = await issued('RESET_PASSWORD');
    const rows = await db.query('SELECT encrypted_payload FROM mail_outbox');
    expect(JSON.stringify(rows)).not.toContain(raw); expect(mail.to).toBe('owner@example.com');
    expect((await db.query('SELECT token_hash FROM account_tokens')).rows[0].token_hash).toBe(hash(raw));
  });
  it('resets a password once and revokes all earlier sessions', async () => {
    const service = app.get(AccountService); const auth = app.get(AuthService);
    await app.get(AuthRepository).createSession(owner, hash('before-reset'));
    const tokens = await auth.rotate('before-reset');
    await service.requestReset('owner@example.com', 'pt-BR'); const { raw } = await issued('RESET_PASSWORD');
    await expect(service.verify(raw)).rejects.toThrow('TOKEN_INVALID_OR_EXPIRED');
    await service.reset(raw, 'a replacement password that is long');
    await expect(auth.verify(tokens.access)).rejects.toThrow('SESSION_EXPIRED');
    await expect(service.reset(raw, 'another password with enough length')).rejects.toThrow('TOKEN_INVALID_OR_EXPIRED');
    expect(await auth.login('owner@example.com', 'a replacement password that is long')).toHaveProperty('access');
  });
  it('rejects expired verification and only verifies a token once', async () => {
    const service = app.get(AccountService);
    await service.requestVerification(owner, 'es'); const { raw } = await issued('VERIFY_EMAIL');
    await service.verify(raw);
    expect((await service.profile(owner)).email_verified_at).toBeTruthy();
    await expect(service.verify(raw)).rejects.toThrow('TOKEN_INVALID_OR_EXPIRED');
    await service.requestVerification(other, 'en');
    const row = (await db.query('SELECT token_hash FROM account_tokens WHERE user_id=$1', [other])).rows[0];
    await db.query("UPDATE account_tokens SET expires_at=now()-interval '1 minute' WHERE user_id=$1", [other]);
    expect(await app.get(AccountRepository).consume(row.token_hash, 'VERIFY_EMAIL')).toBe(false);
  });
  it('cannot issue a session from a password hash superseded by a reset', async () => {
    expect(await app.get(AuthRepository).createSession(owner, hash('stale'), 'old-hash')).toBeNull();
  });
  it('refuses local mailbox and editor configuration in production', () => {
    expect(() => readConfig({ NODE_ENV: 'production', WEB_ORIGIN: 'https://example.com', DATABASE_URL: 'postgresql://test', JWT_SECRET: 'a'.repeat(96), LOCAL_MAILBOX: 'true' })).toThrow('Local tools cannot be enabled');
  });
});

describe('Local editorial workflow', () => {
  it('requires the configured editor to verify their email', async () => {
    const content = app.get(ContentService);
    await expect(content.drafts(owner)).rejects.toThrow('EDITOR_REQUIRED');
    await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [other]);
    await expect(content.drafts(other)).rejects.toThrow('EDITOR_REQUIRED');
  });
  it('keeps drafts private, publishes all locales, and checks revisions', async () => {
    const content = app.get(ContentService);
    await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [owner]);
    const created = await content.create(owner, structuredClone(contentSeed[0]));
    expect(await content.list('ARTICLE', 'en')).toEqual([]);
    await expect(content.read(created.slug, 'en')).rejects.toThrow('CONTENT_NOT_FOUND');
    const published = await content.transition(owner, created.id, 0, 'PUBLISHED');
    expect((await content.read(created.slug, 'pt-BR')).title).toBe(contentSeed[0].translations['pt-BR'].title);
    await expect(content.update(owner, created.id, published.revision, contentSeed[0])).rejects.toThrow('DRAFT_OR_REVISION_REQUIRED');
    await expect(content.transition(owner, created.id, 0, 'DRAFT')).rejects.toThrow('STALE_REVISION');
    const draft = await content.transition(owner, created.id, published.revision, 'DRAFT');
    expect(await content.list('ARTICLE', 'en')).toEqual([]);
    const edited = await content.update(owner, draft.id, draft.revision, { ...contentSeed[0], slug: 'updated-title' });
    expect(edited.slug).toBe('updated-title');
  });
  it('separates resources from articles and preserves published edits during seeding', async () => {
    const repo = app.get(ContentRepository); const content = app.get(ContentService);
    await repo.seed(contentSeed); await repo.seed(contentSeed);
    expect(await content.list('ARTICLE', 'en')).toHaveLength(2);
    expect(await content.list('RESOURCE', 'en')).toHaveLength(1);
    const response = await request(app.getHttpServer()).get('/api/content/editor').expect(401);
    expect(response.body).not.toHaveProperty('translations');
  });
});
