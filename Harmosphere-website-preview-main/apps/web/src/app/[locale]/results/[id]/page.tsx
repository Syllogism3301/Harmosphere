import { Result } from '../../../../features/results/results';
import { notFound } from 'next/navigation';
export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <Result id={id} />;
}
