'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '../lib/api';
export function PriceDisclosure() {
  const locale = useLocale(); const t = useTranslations('results');
  const [offers, setOffers] = useState<{ provider: string; currency: string; amountMinor: number }[]>([]);
  useEffect(() => { api<{ enabled: boolean; offers: typeof offers }>('/payments/offers').then(data => { if (data.enabled) setOffers(data.offers); }).catch(() => {}); }, []);
  if (!offers.length) return null;
  return <p className="micro">{t('full')}: {offers.map(o => `${o.provider === 'stripe' ? 'Stripe' : 'Mercado Pago'} ${new Intl.NumberFormat(locale, { style: 'currency', currency: o.currency }).format(o.amountMinor / 100)}`).join(' · ')}</p>;
}
