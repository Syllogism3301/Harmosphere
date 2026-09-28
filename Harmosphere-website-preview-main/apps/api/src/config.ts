import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.url(), DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(64).refine(v => !v.startsWith('replace-'), 'Generate a random JWT_SECRET'),
  PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false'),
  PAYMENTS_LIVE: z.enum(['true', 'false']).default('false'),
  STRIPE_SECRET_KEY: z.string().default(''), STRIPE_WEBHOOK_SECRET: z.string().default(''),
  MERCADOPAGO_ACCESS_TOKEN: z.string().default(''), MERCADOPAGO_WEBHOOK_SECRET: z.string().default(''),
  MERCADOPAGO_COLLECTOR_ID: z.string().default(''), PUBLIC_API_URL: z.string().default(''),
  STRIPE_PRICE_MINOR: z.coerce.number().int().positive().default(150),
  STRIPE_CURRENCY: z.enum(['brl', 'usd', 'eur']).default('brl'),
  MERCADOPAGO_PRICE_MINOR: z.coerce.number().int().positive().default(150),
  LOCAL_MAILBOX: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  LOCAL_EDITOR_EMAIL: z.union([z.email(), z.literal('')]).default('').transform(v => v.toLowerCase()),
});
export type Config = z.infer<typeof schema>;
export const CONFIG = Symbol('CONFIG');
export function readConfig(env = process.env): Config {
  const c = schema.parse(env);
  if (c.NODE_ENV === 'production' && (c.LOCAL_MAILBOX || c.LOCAL_EDITOR_EMAIL)) throw new Error('Local tools cannot be enabled in production');
  if (new URL(c.WEB_ORIGIN).origin !== c.WEB_ORIGIN) throw new Error('WEB_ORIGIN must be an origin without a trailing slash');
  if (c.NODE_ENV === 'production' && !c.WEB_ORIGIN.startsWith('https://')) throw new Error('HTTPS required');
  if (c.PAYMENTS_ENABLED === 'true') {
    if (!c.STRIPE_SECRET_KEY || !c.STRIPE_WEBHOOK_SECRET || !c.MERCADOPAGO_ACCESS_TOKEN || !c.MERCADOPAGO_WEBHOOK_SECRET || !c.MERCADOPAGO_COLLECTOR_ID) throw new Error('Both payment providers must be configured');
    if (!c.PUBLIC_API_URL.startsWith('https://')) throw new Error('PUBLIC_API_URL requires HTTPS');
  }
  return c;
}
