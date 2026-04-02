"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LogOut, Home, Briefcase, ShieldCheck, Settings, FileText,
  Bell, Search, UserCircle, PlusCircle, ChevronRight, Check
} from 'lucide-react';
import { fetchMyNotifications, markNotificationRead } from './actions';
import { switchImpersonationRole, getImpersonationRole, signOut } from '@/utils/auth-actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const navItems = [
  {
    section: 'Menu',
    links: [
      { href: '/', label: 'Dashboard', icon: Home, exact: true },
      { href: '/cases', label: 'Cases', icon: Briefcase },
    ],
  },
  {
    section: 'Governance',
    requiresAdmin: true,
    links: [
      { href: '/policy', label: 'Policy Engine', icon: ShieldCheck },
      { href: '/audit', label: 'Audit & Logs', icon: FileText, exact: false },
    ],
  },
  {
    section: 'System',
    requiresAdmin: true,
    links: [
      { href: '/admin', label: 'Admin', icon: Settings },
      { href: '/settings', label: 'System Settings', icon: Settings },
    ],
  },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [activeRole, setActiveRole] = useState<string>('founder_admin');

  useEffect(() => {
    getImpersonationRole().then(r => {
      if (r) setActiveRole(r);
    });
    fetchMyNotifications().then(setNotifications);
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Logic for UI rendering based on role
  const isAdmin = activeRole === 'founder_admin';
  const canCreateCase = activeRole === 'rm' || isAdmin;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border bg-card shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">C</div>
          <span className="font-semibold text-foreground tracking-tight">CreditFlow</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {navItems.map((section) => {
            if (section.requiresAdmin && !isAdmin) return null;
            return (
              <div key={section.section}>
                <p className="px-2 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.section}</p>
                <div className="space-y-0.5">
                  {section.links.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.href, link.exact);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon size={17} />
                        <span>{link.label}</span>
                        {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <Separator />
        {/* User Footer */}
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <UserCircle size={32} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Operator</p>
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
              }}
              className="w-full bg-muted border border-border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="rm">RM</option>
              <option value="kam">KAM</option>
              <option value="accounts">Accounts</option>
              <option value="bdo">BDO</option>
              <option value="ordinary_approver">Ordinary Approver</option>
              <option value="board_member">Board Member</option>
              <option value="founder_admin">Founder / Admin</option>
            </select>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-border flex items-center px-6 gap-4 shrink-0 bg-card/50 backdrop-blur">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-md bg-muted rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-primary">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search cases or parties..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            />
          </form>
          <div className="ml-auto flex items-center gap-2 relative">
            <Button variant="ghost" size="icon" className="relative" onClick={() => setShowNotifs(!showNotifs)}>
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />}
            </Button>
            
            {showNotifs && (
              <div className="absolute top-full mt-2 right-0 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-96">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && <Badge variant="secondary" className="text-xs">{unreadCount} unread</Badge>}
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">No notifications</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className={cn("p-3 rounded-lg text-sm relative group", !n.is_read ? "bg-primary/5 border border-primary/20" : "hover:bg-muted")}>
                      <div className="pr-6">
                        <p className="font-medium text-foreground mb-0.5">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-2 opacity-70">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                      {!n.is_read && (
                        <button onClick={() => handleMarkRead(n.id)} className="absolute top-3 right-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" title="Mark as read">
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                <LogOut size={15} className="mr-1.5" />
                Log Out
              </Button>
            </form>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
