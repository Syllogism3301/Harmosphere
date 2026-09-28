'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '../../lib/api';
type Language = 'en' | 'pt-BR' | 'es';
type Translation = { title: string; excerpt: string; paragraphs: string[] };
type Entry = { id?: string; slug: string; kind: 'ARTICLE' | 'RESOURCE'; category: string; translations: Record<Language, Translation>; revision: number; status: 'DRAFT' | 'PUBLISHED' };
const blank = (): Entry => ({ slug: '', kind: 'ARTICLE', category: 'LISTENING', status: 'DRAFT', revision: 0, translations: { en: { title: '', excerpt: '', paragraphs: [''] }, 'pt-BR': { title: '', excerpt: '', paragraphs: [''] }, es: { title: '', excerpt: '', paragraphs: [''] } } });
export function ContentEditor() {
  const t = useTranslations('editor'); const content = useTranslations('content'); const locale = useLocale();
  const [entries, setEntries] = useState<Entry[] | null>(null); const [entry, setEntry] = useState<Entry>(blank); const [language, setLanguage] = useState<Language>('en'); const [denied, setDenied] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function load() { try { setEntries(await api<Entry[]>('/content/editor', { auth: true })); } catch { setDenied(true); } }
  useEffect(() => { void load(); }, []);
  function change(field: 'title' | 'excerpt', value: string) { setEntry({ ...entry, translations: { ...entry.translations, [language]: { ...entry.translations[language], [field]: value } } }); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const { slug, kind, category, translations } = entry;
    // Paragraphs are plain text. No raw HTML or user-supplied embed is rendered.
    const normalized = Object.fromEntries(Object.entries(translations).map(([key, copy]) => [key, { ...copy, paragraphs: copy.paragraphs.map(p => p.trim()).filter(Boolean) }]));
    const input = { slug, kind, category, translations: normalized };
    try {
      const result = await api<Entry>(entry.id ? `/content/editor/${entry.id}` : '/content/editor', { method: entry.id ? 'PUT' : 'POST', body: entry.id ? { revision: entry.revision, entry: input } : input, auth: true });
      setEntry(result); setMessage('saved'); await load();
    } catch { setMessage('error'); } finally { setBusy(false); }
  }
  async function transition() {
    if (!entry.id) return; setBusy(true); setMessage('');
    try { setEntry(await api<Entry>(`/content/editor/${entry.id}/status`, { method: 'POST', body: { revision: entry.revision, status: entry.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT' }, auth: true })); await load(); setMessage('saved'); }
    catch { setMessage('error'); } finally { setBusy(false); }
  }
  if (denied) return <section className="center-card"><h1>{t('title')}</h1><p>{t('denied')}</p></section>;
  if (!entries) return <p className="loading">{t('loading')}</p>;
  return <section className="editor-layout"><p className="eyebrow">HARMOSPHERE</p><h1>{t('title')}</h1><p>{t('intro')}</p><div className="editor-grid"><aside className="editor-list"><button onClick={() => { setEntry(blank()); setMessage(''); }}>{t('new')} +</button>{entries.map(e => <button key={e.id} aria-pressed={e.id === entry.id} onClick={() => { setEntry(structuredClone(e)); setMessage(''); }}>{e.translations[locale as Language].title}<small>{t(e.status)}</small></button>)}</aside><form className="editor-form" onSubmit={save}><p className="micro">{t('required')}</p><label>{t('language')}<select value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">English</option><option value="pt-BR">Português</option><option value="es">Español</option></select></label><fieldset disabled={busy || entry.status === 'PUBLISHED'}><label>{t('slug')}<input value={entry.slug} onChange={e => setEntry({ ...entry, slug: e.target.value })} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} required /></label><label>{t('kind')}<select value={entry.kind} onChange={e => setEntry({ ...entry, kind: e.target.value as Entry['kind'] })}><option value="ARTICLE">{t('ARTICLE')}</option><option value="RESOURCE">{t('RESOURCE')}</option></select></label><label>{t('category')}<select value={entry.category} onChange={e => setEntry({ ...entry, category: e.target.value })}>{['LISTENING','PIANO','PRACTICE'].map(v => <option key={v} value={v}>{content(v)}</option>)}</select></label><label>{t('titleField')}<input value={entry.translations[language].title} onChange={e => change('title', e.target.value)} minLength={3} maxLength={140} required /></label><label>{t('excerpt')}<textarea value={entry.translations[language].excerpt} onChange={e => change('excerpt', e.target.value)} minLength={10} maxLength={400} required /></label><label>{t('body')}<textarea className="body-input" value={entry.translations[language].paragraphs.join('\n\n')} onChange={e => setEntry({ ...entry, translations: { ...entry.translations, [language]: { ...entry.translations[language], paragraphs: e.target.value.split('\n\n') } } })} required /></label><button className="button primary" type="submit">{t('save')}</button></fieldset>{message && <p role="status" className={message === 'error' ? 'error' : 'success'}>{t(message)}</p>}<div className="editor-controls">{entry.id && <button type="button" className="button secondary" disabled={busy} onClick={transition}>{t(entry.status === 'DRAFT' ? 'publish' : 'unpublish')}</button>}{entry.status === 'PUBLISHED' && <Link className="text-button" href={`/${locale}/${entry.kind === 'ARTICLE' ? 'journal' : 'resources'}/${entry.slug}`}>{t('preview')}</Link>}</div></form></div></section>;
}
