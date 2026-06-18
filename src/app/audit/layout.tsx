import { getImpersonationRole } from '@/utils/auth-actions'
import { unauthorized } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/utils/auth'  // eslint-disable-line @typescript-eslint/no-unused-vars

export default async function AuditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const activeRole = await getImpersonationRole()

  if (activeRole !== 'founder_admin') {
    unauthorized()
  }

  return <>{children}</>
}
