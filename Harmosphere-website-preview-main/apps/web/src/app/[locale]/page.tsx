import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PriceDisclosure } from '../../components/price-disclosure';
import { MusicAtmosphere } from '../../components/music-atmosphere';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('theme'); const home = await getTranslations('home');
  const paths = ['quiz', 'journal', 'resources'];
  const socials = [
    { name: 'YouTube', handle: '@Harmosphere_ofc', url: 'https://www.youtube.com/@Harmosphere_ofc', icon: '▶', key: 'youtube' },
    { name: 'Instagram', handle: '@harmosphere_', url: 'https://www.instagram.com/harmosphere_/', icon: '◎', key: 'instagram' },
    { name: 'TikTok', handle: '@harmosphere_official', url: 'https://www.tiktok.com/@harmosphere_official', icon: '♪', key: 'tiktok' },
  ];
  return <>
    <section className="hero"><MusicAtmosphere /><div className="hero-copy">
      <div className="hero-seal" aria-hidden="true"><span>H</span><i>♪</i></div>
      <p className="eyebrow">{t('eyebrow')}</p><h1>HARMOSPHERE</h1><p className="hero-description">{t('intro')}</p>
      <div className="hero-actions"><Link className="button primary" href={`/${locale}/quiz`}>{home('cta')} <span aria-hidden="true">↗</span></Link><a className="button secondary" href="https://www.youtube.com/@Harmosphere_ofc" target="_blank" rel="noopener noreferrer">{t('watch')}</a></div><p className="micro">{home('note')}</p>
    </div><a href="#about" className="scroll-cue"><span>{t('explore')}</span><span aria-hidden="true">↓</span></a></section>
    <section id="about" className="about-section section-pad"><p className="eyebrow">{t('aboutLabel')}</p><h2>{t('aboutTitle')}</h2><p className="section-intro">{t('aboutText')}</p><div className="platform-grid">{paths.map((path, index) => <Link href={`/${locale}/${path}`} className="platform-card" key={path}><span className="card-number">0{index + 1}</span><p className="eyebrow">{t(`${path}Label`)}</p><h3>{t(`${path}Title`)}</h3><p>{t(`${path}Text`)}</p><span className="card-link">{t('enter')} <span aria-hidden="true">→</span></span></Link>)}</div></section>
    <section className="quiz-invitation section-pad"><div className="small-staff" aria-hidden="true">♩ <span>♫</span> ♪</div><p className="eyebrow">{t('quizEyebrow')}</p><h2>{t('quizHeading')}</h2><p className="section-intro">{t('quizIntro')}</p><div className="journey-steps">{[1,2,3].map(n => <article key={n}><span className="step-index">0{n}</span><h3>{home(`step${n}Title`)}</h3><p>{home(`step${n}`)}</p></article>)}</div><Link href={`/${locale}/quiz`} className="button primary">{t('begin')} →</Link><p className="transparency">{home('transparency')}</p><PriceDisclosure /></section>
    <section id="listen" className="listen-section section-pad"><p className="eyebrow">{t('listenLabel')}</p><h2>{t('listenTitle')}</h2><p className="section-intro">{t('listenText')}</p><div className="social-cards">{socials.map(s => <article key={s.key}><span className="social-emblem" aria-hidden="true">{s.icon}</span><h3>{s.name}</h3><p>{t(s.key)}</p><a href={s.url} target="_blank" rel="noopener noreferrer">{s.handle} ↗</a></article>)}</div></section>
    <p className="editorial">{home('editorial')}</p>
  </>;
}
