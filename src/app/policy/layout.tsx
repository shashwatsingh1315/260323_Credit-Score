import { getImpersonationRole } from '@/utils/auth-actions'
import { unauthorized } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/utils/auth'

export default async function PolicyLayout({
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
