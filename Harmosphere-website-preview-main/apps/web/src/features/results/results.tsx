'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api';
type Preview = { title: string; summary: string };
type Report = Preview & { exercise: string; scores: Record<string, number> };
type Offers = { enabled: boolean; offers: { provider: 'stripe' | 'mercadopago'; amountMinor: number; currency: string }[] };
export function Result({ id }: { id: string }) {
  const t = useTranslations('results'); const locale = useLocale(); const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null); const [report, setReport] = useState<Report | null>(null); const [offers, setOffers] = useState<Offers | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [returned, setReturned] = useState(false);
  async function load() {
    setBusy(true); setError(null);
    try {
      const p = await api<Preview>(`/quiz/results/${id}/preview?locale=${locale}`, { auth: true }); setPreview(p);
      try { setReport(await api<Report>(`/quiz/results/${id}/full?locale=${locale}`, { auth: true })); }
      catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; setReport(null); }
      setOffers(await api<Offers>('/payments/offers'));
    } catch (e) { if (e instanceof ApiError && e.status === 401) router.replace(`/${locale}/signin`); else setError('error'); }
    finally { setBusy(false); }
  }
  useEffect(() => { setReturned(new URLSearchParams(window.location.search).has('checkout')); void load(); }, [id, locale]);
  async function checkout(provider: string) {
    setBusy(true); setError(null);
    try {
      const { url } = await api<{ url: string }>('/payments/checkout', { method: 'POST', body: { attemptId: id, provider, locale }, auth: true });
      const destination = new URL(url);
      if (destination.protocol !== 'https:' || !['checkout.stripe.com', 'www.mercadopago.com.br', 'sandbox.mercadopago.com.br'].includes(destination.hostname)) throw new Error('INVALID_CHECKOUT_URL');
      window.location.assign(url);
    } catch { setError('checkoutError'); setBusy(false); }
  }
  return <section className="result-layout"><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1>{error && <p className="error" role="alert">{t(error)}</p>}{!preview && <p role="status">{busy ? t('loading') : t('error')}</p>}{preview && <>
    <article className="profile-card"><div className="profile-art" aria-hidden="true">✳</div><div><p className="eyebrow">{t(report ? 'full' : 'free')}</p><h2>{preview.title}</h2><p>{preview.summary}</p></div></article>
    {report ? <article className="report-card">{Object.entries(report.scores).map(([dimension, value]) => <div className="dimension" key={dimension}><div><label htmlFor={`score-${dimension}`}>{t(`dimensions.${dimension}`)}</label><strong>{value}/100</strong></div><meter id={`score-${dimension}`} min={0} max={100} value={value} /></div>)}<p className="micro">{t('scoreNote')}</p><h2>{t('exercise')}</h2><p>{report.exercise}</p></article> : <article className="paywall"><span className="pill">HARMOSPHERE / {t('full')}</span><h2>{t('lockedTitle')}</h2><p>{t('lockedText')}</p>{offers?.enabled ? <div className="payment-options">{offers.offers.map(o => <button className="button primary" disabled={busy} key={o.provider} onClick={() => void checkout(o.provider)}>{t('buy', { provider: o.provider === 'stripe' ? 'Stripe' : 'Mercado Pago', price: new Intl.NumberFormat(locale, { style: 'currency', currency: o.currency }).format(o.amountMinor / 100) })}</button>)}</div> : <p className="notice">{t('unavailable')}</p>}{offers?.enabled && returned && <p className="micro">{t('pending')}</p>}</article>}
    <Link className="text-button" href={`/${locale}/quiz`}>{t('again')} ↗</Link></>}<button className="button secondary" disabled={busy} onClick={load}>{t('check')}</button></section>;
}
type History = { id: string; created_at: string; title: Record<string, string>; unlocked: boolean };
export function ResultsHistory() {
  const t = useTranslations('results'); const nav = useTranslations('nav'); const locale = useLocale(); const router = useRouter();
  const [items, setItems] = useState<History[] | null>(null); const [error, setError] = useState(false);
  async function load() { setError(false); try { setItems(await api<History[]>('/quiz/results', { auth: true })); } catch (e) { if (e instanceof ApiError && e.status === 401) router.replace(`/${locale}/signin`); else setError(true); } }
  useEffect(() => { void load(); }, []);
  async function logout() { try { await api('/auth/logout', { method: 'POST', body: {} }); router.replace(`/${locale}`); } catch { setError(true); } }
  return <section className="history-layout"><p className="eyebrow">HARMOSPHERE / YOU</p><h1>{t('history')}</h1>{error && <p className="error" role="alert">{t('error')}</p>}{!items && !error && <p>{t('loading')}</p>}{items?.length === 0 && <p>{t('empty')}</p>}<div className="history-grid">{items?.map(item => <Link className="history-card" key={item.id} href={`/${locale}/results/${item.id}`}><span className="step-index" aria-hidden="true">✳</span><p className="micro">{new Intl.DateTimeFormat(locale).format(new Date(item.created_at))}</p><h2>{item.title?.[locale]}</h2><span>{t('view')} ↗</span></Link>)}</div><div className="quiz-actions"><Link className="button primary" href={`/${locale}/quiz`}>{t('again')} ↗</Link><button className="text-button" onClick={logout}>{nav('logout')}</button></div>{error && <button className="button secondary" onClick={load}>{t('check')}</button>}</section>;
}
