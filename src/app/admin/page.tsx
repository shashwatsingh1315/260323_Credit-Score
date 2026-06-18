import { fetchAllUsers, fetchParties, fetchGlobalAuditLog, fetchActiveRoster } from './actions';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const [users, parties, auditLog, roster] = await Promise.all([
    fetchAllUsers(),
    fetchParties(),
    fetchGlobalAuditLog(50),
    fetchActiveRoster(),
  ]);
  return <AdminClient users={users as any[]} parties={parties as any[]} auditLog={auditLog as any[]} activeRoster={roster} />;  // eslint-disable-line @typescript-eslint/no-explicit-any
}
