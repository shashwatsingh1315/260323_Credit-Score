import { fetchCaseDetail } from './actions';
import CaseWorkspace from './CaseWorkspace';
import { notFound } from 'next/navigation';
import { getImpersonationRole } from '@/utils/auth-actions';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, activeRole] = await Promise.all([
    fetchCaseDetail(id),
    getImpersonationRole()
  ]);
  
  if (!data) notFound();

  return <CaseWorkspace data={data} initialActiveRole={activeRole || 'viewer'} />;
}
