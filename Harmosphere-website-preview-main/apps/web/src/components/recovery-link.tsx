'use client';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
export function RecoveryLink() { const t = useTranslations('account'); const locale = useLocale(); return <p className="micro"><Link className="text-button" href={`/${locale}/forgot-password`}>{t('forgot')}</Link></p>; }
