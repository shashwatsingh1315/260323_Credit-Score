import { fetchAllUsers, fetchParties, fetchGlobalAuditLog } from './actions';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const [users, parties, auditLog] = await Promise.all([
    fetchAllUsers(),
    fetchParties(),
    fetchGlobalAuditLog(50),
  ]);
  return <AdminClient users={users as any[]} parties={parties as any[]} auditLog={auditLog as any[]} />;
}
