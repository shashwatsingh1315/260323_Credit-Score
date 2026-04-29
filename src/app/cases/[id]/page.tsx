import {
  fetchCaseCore,
  fetchCaseTasks,
  fetchCaseApprovals,
  fetchCaseAudit,
  fetchCaseComments,
  fetchCaseLedger
} from './actions';
import CaseWorkspace from './CaseWorkspace';
import { notFound } from 'next/navigation';
import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corePromise = fetchCaseCore(id);
  const activeRolePromise = getImpersonationRole();
  const userPromise = getCurrentUser();

  const [coreData, activeRole, user] = await Promise.all([corePromise, activeRolePromise, userPromise]);

  if (!coreData || !coreData.case) notFound();

  const c = coreData.case;

  if (activeRole === 'rm' && c.rm_user_id !== user?.id) notFound();
  if (activeRole === 'kam' && c.kam_user_id !== user?.id) notFound();

  const cycle = coreData.cycle;

  const cycleId = cycle?.id || '';
  const caseScenario = c.case_scenario || '';
  const policySnapshotId = cycle?.policy_snapshot_id || '';
  const activeStage = cycle?.active_stage || 1;
  const caseStatus = c.status || '';

  // Initiate all subsequent parallel fetches without awaiting
  const promises = {
    tasksPromise: fetchCaseTasks(cycleId, caseScenario, policySnapshotId, activeStage, id),
    approvalsPromise: fetchCaseApprovals(cycleId, id),
    auditPromise: fetchCaseAudit(id),
    commentsPromise: fetchCaseComments(id),
    ledgerPromise: fetchCaseLedger(id, caseStatus)
  };

  return <CaseWorkspace coreData={coreData} promises={promises} initialActiveRole={activeRole || 'viewer'} />;
}
