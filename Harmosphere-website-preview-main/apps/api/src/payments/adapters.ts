import { Inject, Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CONFIG, Config } from '../config';
import { Order, Snapshot, PaymentAdapter } from './payment.types';

export function verifyMercadoSignature(signature: string, requestId: string, dataId: string, secret: string, now = Date.now()) {
  const pairs = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  const ts = pairs.ts; const digest = pairs.v1;
  if (!secret || !/^[0-9]{10,13}$/.test(ts ?? '') || !/^[a-f0-9]{64}$/.test(digest ?? '') || !/^[a-zA-Z0-9-]{1,200}$/.test(requestId) || !/^[a-zA-Z0-9-]{1,100}$/.test(dataId)) return false;
  const timestamp = Number(ts) * (ts.length === 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 5 * 60_000) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(digest, 'hex'));
}

@Injectable()
export class StripeAdapter implements PaymentAdapter {
  constructor(@Inject(CONFIG) private readonly c: Config) {}
  private client() {
    if (!this.c.STRIPE_SECRET_KEY) throw new ServiceUnavailableException('PAYMENTS_UNAVAILABLE');
    return new Stripe(this.c.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 });
  }
  async create(order: Order, locale: string) {
    const session = await this.client().checkout.sessions.create({
      mode: 'payment', client_reference_id: order.id,
      metadata: { orderId: order.id, userId: order.user_id },
      payment_intent_data: { metadata: { orderId: order.id, userId: order.user_id } },
      line_items: [{ quantity: 1, price_data: { currency: order.currency, unit_amount: order.amount_minor, product_data: { name: 'Harmosphere — Musical Compass report' } } }],
      success_url: `${this.c.WEB_ORIGIN}/${locale}/results/${order.attempt_id}?checkout=returned`,
      cancel_url: `${this.c.WEB_ORIGIN}/${locale}/results/${order.attempt_id}`,
    }, { idempotencyKey: `quiz-order:${order.id}` });
    if (!session.url) throw new ServiceUnavailableException('CHECKOUT_UNAVAILABLE');
    return { id: session.id, url: session.url };
  }
  async notification(raw: Buffer, signature: string): Promise<{ eventId: string; snapshot: Snapshot | null }> {
    const stripe = this.client();
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(raw, signature, this.c.STRIPE_WEBHOOK_SECRET); }
    catch { throw new BadRequestException('INVALID_SIGNATURE'); }
    if (event.livemode !== (this.c.PAYMENTS_LIVE === 'true')) throw new BadRequestException('PAYMENT_MODE_MISMATCH');
    let intentId: string | null = null;
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
      intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      intentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id ?? null;
    }
    if (!intentId) return { eventId: event.id, snapshot: null };
    // Fetch current provider state: do not trust event ordering or client returns.
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
    const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    const revoked = !!charge && (charge.amount_refunded > 0 || charge.disputed);
    return { eventId: event.id, snapshot: {
      orderId: intent.metadata.orderId, userId: intent.metadata.userId,
      provider: 'stripe', paymentId: intent.id, amountMinor: intent.amount, currency: intent.currency,
      status: revoked ? 'REVOKED' : intent.status === 'succeeded' ? 'PAID' : 'PENDING',
    } };
  }
}

@Injectable()
export class MercadoPagoAdapter implements PaymentAdapter {
  constructor(@Inject(CONFIG) private readonly c: Config) {}
  private async request(path: string, body?: unknown): Promise<any> {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${this.c.MERCADOPAGO_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new ServiceUnavailableException('PAYMENT_PROVIDER_UNAVAILABLE');
    return response.json();
  }
  async create(order: Order, locale: string) {
    const back = `${this.c.WEB_ORIGIN}/${locale}/results/${order.attempt_id}`;
    const preference = await this.request('/checkout/preferences', {
      external_reference: order.id, metadata: { user_id: order.user_id },
      items: [{ id: 'quiz-report', title: 'Harmosphere — Musical Compass report', quantity: 1, currency_id: 'BRL', unit_price: order.amount_minor / 100 }],
      back_urls: { success: `${back}?checkout=returned`, pending: `${back}?checkout=returned`, failure: back },
      notification_url: `${this.c.PUBLIC_API_URL}/api/payments/webhooks/mercadopago`,
    });
    const url = this.c.PAYMENTS_LIVE === 'true' ? preference.init_point : preference.sandbox_init_point;
    if (typeof preference.id !== 'string' || typeof url !== 'string' || !url.startsWith('https://')) throw new ServiceUnavailableException('CHECKOUT_UNAVAILABLE');
    return { id: preference.id, url };
  }
  async notification(signature: string, requestId: string, dataId: string) {
    if (!verifyMercadoSignature(signature, requestId, dataId, this.c.MERCADOPAGO_WEBHOOK_SECRET)) throw new BadRequestException('INVALID_SIGNATURE');
    const payment = await this.request(`/v1/payments/${encodeURIComponent(dataId)}`);
    if (String(payment.collector_id) !== this.c.MERCADOPAGO_COLLECTOR_ID || payment.live_mode !== (this.c.PAYMENTS_LIVE === 'true')) throw new BadRequestException('PAYMENT_ACCOUNT_MISMATCH');
    const amount = Number(payment.transaction_amount) * 100;
    if (!Number.isFinite(amount) || Math.abs(amount - Math.round(amount)) > 0.00001) throw new BadRequestException('INVALID_AMOUNT');
    const revoked = ['refunded', 'charged_back', 'cancelled'].includes(payment.status) || Number(payment.transaction_amount_refunded) > 0;
    const snapshot: Snapshot = {
      provider: 'mercadopago', paymentId: String(payment.id), orderId: payment.external_reference,
      userId: payment.metadata?.user_id, amountMinor: Math.round(amount), currency: String(payment.currency_id).toLowerCase(),
      status: revoked ? 'REVOKED' : payment.status === 'approved' ? 'PAID' : 'PENDING',
    };
    return { eventId: `${dataId}:${requestId}`, snapshot };
  }
}
