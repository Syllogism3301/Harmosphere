import { getTranslations } from 'next-intl/server';
import { Collection } from '../../../features/content/collection';
export default async function Journal() {
  const t = await getTranslations('content');
  return <section className="content-page"><header className="content-heading"><p className="eyebrow">HARMOSPHERE / JOURNAL</p><h1>{t('journalTitle')}</h1><p>{t('journalIntro')}</p></header><Collection kind="ARTICLE" /></section>;
}
