import { getTranslations } from 'next-intl/server';
export default async function NotFound() { const t = await getTranslations('content'); return <section className="center-card"><h1>404</h1><p>{t('notFound')}</p></section>; }
