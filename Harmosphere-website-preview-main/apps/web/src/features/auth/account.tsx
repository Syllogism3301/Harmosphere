'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api';
type Profile = { email: string; email_verified_at: string | null; canEdit: boolean };

export function Account() {
  const t = useTranslations('account'); const locale = useLocale(); const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function load() {
    try { setProfile(await api<Profile>('/auth/account', { auth: true })); }
    catch (e) { if (e instanceof ApiError && e.status === 401) router.replace(`/${locale}/signin`); else setMessage('error'); }
  }
  useEffect(() => { void load(); }, []);
  async function verify() {
    setBusy(true); setMessage('');
    try { await api('/auth/account/request-verification', { method: 'POST', body: { locale }, auth: true }); setMessage('verifySent'); }
    catch { setMessage('error'); } finally { setBusy(false); }
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST', body: {} }); router.replace(`/${locale}`); } catch { setMessage('error'); }
  }
  return <section className="account-layout"><p className="eyebrow">HARMOSPHERE</p><h1>{t('title')}</h1><p>{t('intro')}</p>{message && <p role="status" className={message === 'error' ? 'error' : 'success'}>{t(message)}</p>}{profile ? <><article className="account-panel"><p className="eyebrow">{t('email')}</p><h2>{profile.email}</h2><p>{t(profile.email_verified_at ? 'verified' : 'unverified')}</p>{!profile.email_verified_at && <button disabled={busy} className="button secondary" onClick={verify}>{t(busy ? 'busy' : 'requestVerify')}</button>}</article><div className="account-links"><Link className="button primary" href={`/${locale}/results`}>{t('results')}</Link><Link className="button secondary" href={`/${locale}/forgot-password`}>{t('forgot')}</Link>{profile.canEdit && <Link className="button secondary" href={`/${locale}/studio`}>{t('editor')}</Link>}<button className="text-button" onClick={logout}>{t('logout')}</button></div></> : <p role="status">{t('busy')}</p>}</section>;
}

export function AccountAction({ mode }: { mode: 'forgot' | 'reset' | 'verify' }) {
  const t = useTranslations('account'); const locale = useLocale();
  const [rawToken, setToken] = useState(''); const [busy, setBusy] = useState(false); const [success, setSuccess] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    function receiveToken() {
      if (mode === 'forgot') return;
      const received = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (received) {
        setToken(received); setSuccess(false); setError('');
        history.replaceState(null, '', window.location.pathname);
      }
    }
    receiveToken(); window.addEventListener('hashchange', receiveToken);
    return () => window.removeEventListener('hashchange', receiveToken);
  }, [mode]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const path = mode === 'forgot' ? 'forgot-password' : mode === 'reset' ? 'reset-password' : 'verify-email';
      const body = mode === 'forgot' ? { email: String(data.get('email')).trim(), locale } : mode === 'reset' ? { token: rawToken, password: data.get('password') } : { token: rawToken };
      await api(`/auth/account/${path}`, { method: 'POST', body }); setSuccess(true);
    } catch (e) { setError(e instanceof ApiError && e.status === 400 ? 'invalid' : 'error'); } finally { setBusy(false); }
  }
  return <section className="token-form"><p className="eyebrow">HARMOSPHERE</p><h1>{t(`${mode}Title`)}</h1><p>{t(`${mode}Intro`)}</p>{success ? <div className="account-panel"><p role="status" className="success">{t(mode === 'forgot' ? 'sent' : mode === 'reset' ? 'resetDone' : 'done')}</p><Link className="button secondary" href={`/${locale}/${mode === 'verify' ? 'account' : 'signin'}`}>{t(mode === 'verify' ? 'title' : 'login')}</Link></div> : <form className="auth-card" onSubmit={submit}>{mode === 'forgot' && <label>{t('email')}<input name="email" type="email" maxLength={254} autoComplete="email" required /></label>}{mode === 'reset' && <><label>{t('password')}<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><small>{t('passwordHint')}</small></>}{error && <p role="alert" className="error">{t(error)}</p>}<button className="button primary" disabled={busy || (mode !== 'forgot' && !rawToken)}>{t(busy ? 'busy' : mode === 'forgot' ? 'send' : mode)}</button></form>}</section>;
}
