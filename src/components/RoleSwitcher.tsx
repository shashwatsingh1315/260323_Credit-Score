"use client";
import { useState, useEffect } from 'react';
import { UserCircle } from 'lucide-react';
import { fetchSessionInfo } from './actions';
import { switchImpersonationRole } from '@/utils/auth-actions';
import { usePathname, useRouter } from 'next/navigation';

export default function RoleSwitcher({ initialActiveRole = 'viewer' }: { initialActiveRole?: string }) {
  const [activeRole, setActiveRole] = useState<string>(initialActiveRole);
  const [sessionUser, setSessionUser] = useState<{ id: string, full_name: string, roles: string[] } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === '/login' || pathname === '/reset-password';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveRole(initialActiveRole);
  }, [initialActiveRole]);

  useEffect(() => {
    if (isAuthPage) return;

    fetchSessionInfo().then(u => {
      if (u) setSessionUser(u);
    }).catch(console.error);
  }, [isAuthPage]);

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <UserCircle size={32} className="text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{sessionUser?.full_name || 'Operator'}</p>
          <p className="text-xs text-muted-foreground capitalize">{activeRole.replace('_', ' ')}</p>
        </div>
      </div>
      <div className="mt-2 text-xs">
        <p className="text-muted-foreground font-semibold mb-1">Impersonate Role:</p>
        <select
          value={activeRole}
          onChange={async (e) => {
            setActiveRole(e.target.value);
            await switchImpersonationRole(e.target.value);
            router.refresh();
          }}
          className="w-full bg-muted border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
        >
          {sessionUser?.roles?.length ? (
            sessionUser.roles.map(r => <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>)
          ) : (
            <option value={activeRole}>{activeRole.replace('_', ' ').toUpperCase()}</option>
          )}
        </select>
      </div>
    </div>
  );
}
