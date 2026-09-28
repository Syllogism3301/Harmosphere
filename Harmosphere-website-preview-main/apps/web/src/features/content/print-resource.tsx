'use client';
import { useTranslations } from 'next-intl';
export function PrintResource() { const t = useTranslations('content'); return <button className="button primary" onClick={() => window.print()}>{t('print')}</button>; }
