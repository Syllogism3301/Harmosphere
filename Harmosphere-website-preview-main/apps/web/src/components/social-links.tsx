const socials = [
  { name: 'YouTube', href: 'https://www.youtube.com/@Harmosphere_ofc' },
  { name: 'Instagram', href: 'https://www.instagram.com/harmosphere_/' },
  { name: 'TikTok', href: 'https://www.tiktok.com/@harmosphere_official' },
];
export function SocialLinks() {
  return <div className="social-links">{socials.map(s => <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer">{s.name} <span aria-hidden="true">↗</span></a>)}</div>;
}
