import { fetchAllUsers, fetchParties, fetchGlobalAuditLog, fetchActiveRoster } from './actions';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const [users, partiesRes, auditRes, roster] = await Promise.all([
    fetchAllUsers(),
    fetchParties(),
    fetchGlobalAuditLog(50),
    fetchActiveRoster(),
  ]);
  return (
    <AdminClient
      users={users as any[]}
      parties={partiesRes.data as any[]}
      partiesError={!!partiesRes.error}
      auditLog={auditRes.data as any[]}
      auditError={!!auditRes.error}
      activeRoster={roster}
    />
  );
}
