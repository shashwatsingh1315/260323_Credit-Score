import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldAlert size={32} className="text-destructive" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          You do not have the required permissions to access this page.
        </p>
      </div>
      <Button asChild className="mt-4">
        <Link href="/">Return to Dashboard</Link>
      </Button>
    </div>
  )
}
