import { getPublication, Publication } from '../../../../features/content/publication';
type Props = { params: Promise<{ slug: string; locale: string }> };
export async function generateMetadata({ params }: Props) { const { slug, locale } = await params; const entry = await getPublication(slug, locale); return { title: `${entry?.title ?? 'Journal'} — Harmosphere`, description: entry?.excerpt }; }
export default async function Page({ params }: Props) { return <Publication {...await params} kind="ARTICLE" />; }
