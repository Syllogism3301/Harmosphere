import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { StripeAdapter, MercadoPagoAdapter } from './adapters';
import { PaymentsRepository } from './payments.repository';
import { Provider } from './payment.types';

@Injectable()
export class PaymentsService {
  constructor(@Inject(CONFIG) private readonly c: Config, @Inject(PaymentsRepository) private readonly repo: PaymentsRepository,
    @Inject(StripeAdapter) private readonly stripe: StripeAdapter, @Inject(MercadoPagoAdapter) private readonly mercado: MercadoPagoAdapter) {}
  offers() {
    return { enabled: this.c.PAYMENTS_ENABLED === 'true', offers: [
      { provider: 'stripe', amountMinor: this.c.STRIPE_PRICE_MINOR, currency: this.c.STRIPE_CURRENCY },
      { provider: 'mercadopago', amountMinor: this.c.MERCADOPAGO_PRICE_MINOR, currency: 'brl' },
    ] };
  }
  async checkout(userId: string, attemptId: string, provider: Provider, locale: string) {
    if (this.c.PAYMENTS_ENABLED !== 'true') throw new ServiceUnavailableException('PAYMENTS_UNAVAILABLE');
    const offer = this.offers().offers.find(o => o.provider === provider)!;
    const { order, create } = await this.repo.reserve(userId, attemptId, provider, offer.amountMinor, offer.currency);
    if (!create) return { url: order.checkout_url };
    try {
      const checkout = await (provider === 'stripe' ? this.stripe : this.mercado).create(order, locale);
      await this.repo.attach(order.id, checkout);
      return { url: checkout.url };
    } catch (error) { await this.repo.uncertain(order.id); throw error; }
  }
  async stripeWebhook(raw: Buffer, signature: string) {
    const event = await this.stripe.notification(raw, signature);
    if (event.snapshot) await this.repo.settle(event.eventId, event.snapshot);
    return { received: true };
  }
  async mercadoWebhook(signature: string, requestId: string, dataId: string) {
    const event = await this.mercado.notification(signature, requestId, dataId);
    await this.repo.settle(event.eventId, event.snapshot);
    return { received: true };
  }
}
