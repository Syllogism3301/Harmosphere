import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { Navigation } from '../../components/navigation';
import { SocialLinks } from '../../components/social-links';
import '../globals.css';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const t = await getTranslations('nav'); const home = await getTranslations('home');
  return { title: `Harmosphere — ${t('quiz')}`, description: home('intro') };
}
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations('home');
  return <html lang={locale} data-scroll-behavior="smooth"><body><NextIntlClientProvider><div className="site-shell"><Navigation /><main>{children}</main><footer className="site-footer"><div><span className="brand">harmosphere.</span><p>{t('footer')}</p></div><SocialLinks /><small>© {new Date().getFullYear()} Harmosphere</small></footer></div></NextIntlClientProvider></body></html>;
}
