import { getTranslations } from 'next-intl/server';
import { Collection } from '../../../features/content/collection';
export default async function Resources() {
  const t = await getTranslations('content');
  return <section className="content-page"><header className="content-heading"><p className="eyebrow">HARMOSPHERE</p><h1>{t('resourcesTitle')}</h1><p>{t('resourcesIntro')}</p></header><Collection kind="RESOURCE" /></section>;
}
