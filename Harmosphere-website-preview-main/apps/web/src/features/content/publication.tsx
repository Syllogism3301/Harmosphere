import { cache } from 'react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PrintResource } from './print-resource';
type Entry = { title: string; excerpt: string; kind: 'ARTICLE' | 'RESOURCE'; category: string; paragraphs: string[] };
export const getPublication = cache(async (slug: string, locale: string): Promise<Entry | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 100) notFound();
  try {
    const result = await fetch(`http://127.0.0.1:4000/api/content/entry/${slug}?locale=${encodeURIComponent(locale)}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (result.status === 404) return null;
    if (!result.ok) throw new Error('CONTENT_UNAVAILABLE');
    return result.json();
  } catch { throw new Error('CONTENT_UNAVAILABLE'); }
});
export async function Publication({ slug, locale, kind }: { slug: string; locale: string; kind: Entry['kind'] }) {
  const t = await getTranslations('content'); const entry = await getPublication(slug, locale);
  if (!entry || entry.kind !== kind) notFound();
  return <article className="article-page"><p className="eyebrow">HARMOSPHERE / {t(entry.category)}</p><h1>{entry.title}</h1><p className="article-lead">{entry.excerpt}</p><div className="article-body">{entry.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><div className="article-actions"><Link className="button secondary" href={`/${locale}/${kind === 'ARTICLE' ? 'journal' : 'resources'}`}>{t('back')}</Link>{kind === 'RESOURCE' && <PrintResource />}</div></article>;
}
