'use client';
import { useTranslations } from 'next-intl';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('content');
  return <section className="center-card"><p role="alert">{t('error')}</p><button className="button secondary" onClick={reset}>{t('retry')}</button></section>;
}
