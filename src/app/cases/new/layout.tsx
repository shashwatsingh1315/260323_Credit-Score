import { getImpersonationRole } from '@/utils/auth-actions'
import { unauthorized } from 'next/navigation'

export default async function NewCaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const activeRole = await getImpersonationRole()

  if (activeRole !== 'rm' && activeRole !== 'founder_admin') {
    unauthorized()
  }

  return <>{children}</>
}
