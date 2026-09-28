'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
export function Navigation() {
  const t = useTranslations('nav'); const theme = useTranslations('theme'); const locale = useLocale(); const pathname = usePathname(); const router = useRouter();
  const links = [
    { href: `/${locale}#about`, label: theme('aboutNav') }, { href: `/${locale}#listen`, label: theme('listenNav') },
    { href: `/${locale}/journal`, label: theme('journalLabel') }, { href: `/${locale}/resources`, label: theme('resourcesLabel') },
    { href: `/${locale}/quiz`, label: 'Quiz' }, { href: `/${locale}/account`, label: theme('accountNav') },
  ];
  return <header className="site-header"><Link href={`/${locale}`} className="brand" aria-label={`Harmosphere — ${t('home')}`}><span className="brand-icon" aria-hidden="true">H</span><span>HARMOSPHERE</span></Link><nav className="desktop-nav">{links.map(l => <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>{l.label}</Link>)}</nav><div className="header-tools"><label className="locale-label"><span className="sr-only">{t('language')}</span><select value={locale} onChange={e => router.push(pathname.replace(/^\/(en|pt-BR|es)(?=\/|$)/, `/${e.target.value}`) + window.location.search)}><option value="en">EN</option><option value="pt-BR">PT</option><option value="es">ES</option></select></label><details className="mobile-menu"><summary aria-label={theme('menu')}>☰</summary><nav>{links.map(l => <Link key={l.href} href={l.href} onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}>{l.label}</Link>)}</nav></details></div></header>;
}
