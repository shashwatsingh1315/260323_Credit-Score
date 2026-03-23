import { fetchCaseDetail } from './actions';
import CaseWorkspace from './CaseWorkspace';
import { notFound } from 'next/navigation';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchCaseDetail(id);
  if (!data) notFound();

  return <CaseWorkspace data={data} />;
}
