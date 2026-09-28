'use client';
import { FormEvent, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
export function AuthForm() {
  const t = useTranslations('auth'); const locale = useLocale(); const router = useRouter(); const query = useSearchParams();
  const [mode, setMode] = useState<'register' | 'login'>('register'); const [busy, setBusy] = useState(false); const [error, setError] = useState<'error' | 'claimError' | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(null);
    try {
      await api(`/auth/${mode}`, { method: 'POST', body: { email: String(data.get('email')).trim(), password: data.get('password') } });
      if (query.get('claim') === '1') {
        try {
          const result = await api<{ id: string }>('/quiz/current/claim', { method: 'POST', body: {}, auth: true });
          try { localStorage.removeItem(`hs:draft:${result.id}`); } catch {}
          router.push(`/${locale}/results/${result.id}`);
        } catch { setError('claimError'); }
      } else router.push(`/${locale}/results`);
    } catch { setError('error'); } finally { setBusy(false); }
  }
  return <section className="auth-layout"><div className="auth-intro"><span className="big-glyph" aria-hidden="true">✳</span><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p>{t('intro')}</p></div><form className="auth-card" onSubmit={submit}><h2>{t(mode)}</h2><label>{t('email')}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label><label>{t('password')}<input name="password" type="password" minLength={12} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} aria-describedby="password-hint" required /></label><small id="password-hint">{t('passwordHint')}</small>{error && <p className="error" role="alert">{t(error)}</p>}<button className="button primary" disabled={busy}>{t(busy ? 'busy' : mode)} ↗</button><p>{t(mode === 'register' ? 'hasAccount' : 'noAccount')} <button type="button" className="text-button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(null); }}>{t(mode === 'register' ? 'login' : 'register')}</button></p>{error === 'claimError' && <Link href={`/${locale}/results`}>{t('results')}</Link>}</form></section>;
}
