'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '../../lib/api';
type Entry = { id: string; slug: string; title: string; excerpt: string; category: string };
export function Collection({ kind }: { kind: 'ARTICLE' | 'RESOURCE' }) {
  const t = useTranslations('content'); const locale = useLocale();
  const [items, setItems] = useState<Entry[] | null>(null); const [error, setError] = useState(false); const [category, setCategory] = useState('all');
  async function load() {
    setError(false);
    try { setItems(await api<Entry[]>(`/content?kind=${kind}&locale=${locale}`)); } catch { setError(true); }
  }
  useEffect(() => { void load(); }, [locale, kind]);
  const visible = items?.filter(item => category === 'all' || item.category === category);
  return <><div className="content-filters">{['all','LISTENING','PIANO','PRACTICE'].map(value => <button key={value} className="filter-button" aria-pressed={category === value} onClick={() => setCategory(value)}>{t(value)}</button>)}</div>
    {error ? <div role="alert" className="empty-state"><p>{t('error')}</p><button className="button secondary" onClick={load}>{t('retry')}</button></div> : !items ? <p role="status" className="empty-state">{t('loading')}</p> : <><div className="content-grid">{visible?.map(item => <article className="content-card" key={item.id}><div className={`content-cover ${item.category.toLowerCase()}`} aria-hidden="true"><span>{item.category === 'PIANO' ? '♬' : item.category === 'PRACTICE' ? 'H' : '𝄞'}</span></div><div className="content-card-body"><p className="eyebrow">{t(item.category)}{kind === 'RESOURCE' ? ` · ${t('free')}` : ''}</p><h2>{item.title}</h2><p>{item.excerpt}</p><Link className="card-link" href={`/${locale}/${kind === 'ARTICLE' ? 'journal' : 'resources'}/${item.slug}`}>{t(kind === 'ARTICLE' ? 'read' : 'open')} <span aria-hidden="true">→</span></Link></div></article>)}</div>{visible?.length === 0 && <p className="empty-state">{t('empty')}</p>}</>}
  </>;
}
