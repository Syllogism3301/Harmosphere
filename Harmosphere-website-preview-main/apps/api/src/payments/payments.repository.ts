import { Inject, Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DATABASE, Database } from '../database/database';
import { Order, Provider, Snapshot } from './payment.types';

@Injectable()
export class PaymentsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  reserve(userId: string, attemptId: string, provider: Provider, amount: number, currency: string) {
    return this.db.transaction(async sql => {
      const attempt = (await sql.query("SELECT id FROM attempts WHERE id=$1 AND user_id=$2 AND status='COMPLETED' FOR UPDATE", [attemptId, userId])).rows[0];
      if (!attempt) throw new NotFoundException('ATTEMPT_NOT_FOUND');
      await sql.query('INSERT INTO orders(id,user_id,attempt_id,provider,amount_minor,currency) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(attempt_id) DO NOTHING', [randomUUID(), userId, attemptId, provider, amount, currency]);
      const order: Order = (await sql.query('SELECT * FROM orders WHERE attempt_id=$1 FOR UPDATE', [attemptId])).rows[0];
      if (order.provider !== provider) throw new ConflictException('GATEWAY_ALREADY_SELECTED');
      if (order.status !== 'PENDING') throw new ConflictException('ORDER_ALREADY_SETTLED');
      if (order.checkout_state === 'READY') return { order, create: false };
      if (order.checkout_state !== 'NEW') throw new ConflictException('CHECKOUT_RECONCILIATION_REQUIRED');
      await sql.query("UPDATE orders SET checkout_state='CREATING' WHERE id=$1", [order.id]);
      return { order, create: true };
    });
  }
  async attach(id: string, checkout: { id: string; url: string }) { await this.db.query("UPDATE orders SET checkout_id=$1,checkout_url=$2,checkout_state='READY' WHERE id=$3", [checkout.id, checkout.url, id]); }
  async uncertain(id: string) { await this.db.query("UPDATE orders SET checkout_state='UNCERTAIN' WHERE id=$1 AND checkout_state='CREATING'", [id]); }
  async settle(eventId: string, s: Snapshot) {
    if (!s.orderId || !s.userId || !s.paymentId) throw new BadRequestException('INVALID_PAYMENT_REFERENCE');
    return this.db.transaction(async sql => {
      const order: Order | undefined = (await sql.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [s.orderId])).rows[0];
      if (!order || order.provider !== s.provider || order.user_id !== s.userId || order.amount_minor !== s.amountMinor || order.currency !== s.currency || (order.payment_id && order.payment_id !== s.paymentId)) throw new BadRequestException('PAYMENT_MISMATCH');
      const inserted = await sql.query('INSERT INTO payment_events(provider,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id', [s.provider, eventId]);
      if (!inserted.rows.length) return;
      if (s.status === 'PENDING') return;
      if (s.status === 'REVOKED') {
        await sql.query("UPDATE orders SET status='REVOKED',payment_id=$1 WHERE id=$2", [s.paymentId, order.id]);
        await sql.query('UPDATE entitlements SET revoked_at=now() WHERE order_id=$1', [order.id]);
      } else if (order.status !== 'REVOKED') {
        await sql.query("UPDATE orders SET status='PAID',payment_id=$1 WHERE id=$2", [s.paymentId, order.id]);
        await sql.query('INSERT INTO entitlements(attempt_id,user_id,order_id) VALUES($1,$2,$3) ON CONFLICT(attempt_id) DO NOTHING', [order.attempt_id, order.user_id, order.id]);
      }
    });
  }
}
