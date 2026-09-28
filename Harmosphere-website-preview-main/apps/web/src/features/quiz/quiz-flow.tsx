'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../lib/api';
import { PriceDisclosure } from '../../components/price-disclosure';
type Attempt = { id: string; status: string; revision: number; answers: Record<string, number>; questions: { id: string; text: string }[] };
type Draft = { questionId: string; value: number; revision: number };
function writeDraft(id: string, draft: Draft | null) { try { if (draft) localStorage.setItem(`hs:draft:${id}`, JSON.stringify(draft)); else localStorage.removeItem(`hs:draft:${id}`); } catch { /* Server persistence remains available when local storage is restricted. */ } }

export function QuizFlow() {
  const t = useTranslations('quiz'); const locale = useLocale(); const router = useRouter();
  const [attempt, setAttempt] = useState<Attempt | null>(null); const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [draft, setDraft] = useState<Draft | null>(null);
  async function load() {
    setLoading(true); setError(false);
    try {
      const a = await api<Attempt>(`/quiz/current?locale=${locale}`);
      setAttempt(a); const first = a.questions.findIndex(q => !a.answers[q.id]); setIndex(first < 0 ? a.questions.length - 1 : first);
      try {
        const d = JSON.parse(localStorage.getItem(`hs:draft:${a.id}`) ?? 'null');
        if (d && d.revision === a.revision && Number.isInteger(d.value) && d.value >= 1 && d.value <= 5 && a.questions.some(q => q.id === d.questionId)) { setDraft(d); setIndex(a.questions.findIndex(q => q.id === d.questionId)); }
        else writeDraft(a.id, null);
      } catch { writeDraft(a.id, null); }
    } catch (e) { if (!(e instanceof ApiError && e.status === 404)) setError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [locale]); // Locale changes fetch localized public questions only.
  async function start() {
    setBusy(true); setError(false);
    try { await api('/quiz/attempts', { method: 'POST', body: {} }); await load(); }
    catch { setError(true); } finally { setBusy(false); }
  }
  async function save(value: number) {
    if (!attempt || busy) return;
    const d = { questionId: attempt.questions[index].id, value, revision: attempt.revision };
    setDraft(d); writeDraft(attempt.id, d); setBusy(true); setError(false);
    try {
      const result = await api<{ revision: number; answers: Record<string, number> }>('/quiz/current/answer', { method: 'PUT', body: d });
      setAttempt({ ...attempt, ...result }); setDraft(null); writeDraft(attempt.id, null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) { setDraft(null); writeDraft(attempt.id, null); await load(); }
      setError(true);
    } finally { setBusy(false); }
  }
  async function finish() {
    if (!attempt || busy || draft) return;
    setBusy(true); setError(false);
    try {
      await api('/quiz/current/complete', { method: 'POST', body: {} });
      try { await api('/auth/me', { auth: true }); }
      catch (e) { if (e instanceof ApiError && e.status === 401) { router.push(`/${locale}/signin?claim=1`); return; } throw e; }
      const claimed = await api<{ id: string }>('/quiz/current/claim', { method: 'POST', body: {}, auth: true });
      writeDraft(attempt.id, null); router.push(`/${locale}/results/${claimed.id}`);
    } catch { setError(true); } finally { setBusy(false); }
  }
  if (loading) return <p className="loading" role="status">{t('loading')}</p>;
  if (!attempt) return <section className="center-card"><span className="big-glyph" aria-hidden="true">✳</span><h1>{t('title')}</h1><p>{t('intro')}</p><PriceDisclosure />{error && <p role="alert">{t('error')}</p>}<button className="button primary" disabled={busy} onClick={start}>{t('start')} ↗</button></section>;
  const question = attempt.questions[index]; const selected = draft?.questionId === question.id ? draft.value : attempt.answers[question.id];
  return <section className="quiz-layout"><div className="quiz-heading"><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p>{t('intro')}</p></div><div className="quiz-card">
    <div className="quiz-progress"><span>{t('question', { current: index + 1, total: attempt.questions.length })}</span><span>{Math.round(Object.keys(attempt.answers).length / attempt.questions.length * 100)}%</span></div><progress value={Object.keys(attempt.answers).length} max={attempt.questions.length} aria-label={t('saved')} />
    <fieldset disabled={busy || attempt.status === 'COMPLETED'}><legend>{question.text}</legend><div className="answers">{[1,2,3,4,5].map(value => <label key={value} className={`answer ${selected === value ? 'selected' : ''}`}><input type="radio" name={question.id} value={value} checked={selected === value} onChange={() => void save(value)} /><span className="answer-number">{value}</span><span>{t(`labels.${value}`)}</span><span className="answer-check" aria-hidden="true">{selected === value ? '✓' : '○'}</span></label>)}</div></fieldset>
    <div aria-live="polite" className={`save-state ${error ? 'error' : ''}`}>{busy ? t('saving') : error || draft ? t('error') : t('saved')}{draft && !busy && <button className="text-button" onClick={() => void save(draft.value)}>{t('retry')}</button>}</div>
    <div className="quiz-actions"><button className="button secondary" disabled={index === 0 || busy || !!draft} onClick={() => { setIndex(index - 1); setError(false); }}>{t('back')}</button>{index < attempt.questions.length - 1 ? <button className="button primary" disabled={!selected || busy || !!draft} onClick={() => { setIndex(index + 1); setError(false); }}>{t('next')} →</button> : <button className="button primary" disabled={busy || !!draft || Object.keys(attempt.answers).length !== attempt.questions.length} onClick={finish}>{t('complete')} ↗</button>}</div>
  </div></section>;
}
