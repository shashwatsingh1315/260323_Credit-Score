import { getImpersonationRole } from '@/utils/auth-actions'
import { unauthorized } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/utils/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const activeRole = await getImpersonationRole()

  if (!user || !hasRole(user, 'founder_admin') || activeRole !== 'founder_admin') {
    unauthorized()
  }

  return <>{children}</>
}
