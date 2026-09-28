export type Provider = 'stripe' | 'mercadopago';
export type Order = { id: string; user_id: string; attempt_id: string; provider: Provider; amount_minor: number; currency: string; status: string; checkout_id: string | null; checkout_url: string | null; checkout_state: string; payment_id: string | null };
export type Snapshot = { orderId: string; userId: string; provider: Provider; paymentId: string; amountMinor: number; currency: string; status: 'PAID' | 'PENDING' | 'REVOKED' };
export interface PaymentAdapter { create(order: Order, locale: string): Promise<{ id: string; url: string }>; }
