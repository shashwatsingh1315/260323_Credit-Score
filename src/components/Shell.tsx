"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LogOut, Home, Briefcase, ShieldCheck, Settings, FileText,
  ChevronRight, Shield
} from 'lucide-react';
import { signOut } from '@/utils/auth-actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import NotificationDropdown from './NotificationDropdown';
import RoleSwitcher from './RoleSwitcher';
import SearchBar from './SearchBar';

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
      { href: '/collections', label: 'Collections', icon: FileText },
      { href: '/admin', label: 'Admin', icon: Shield },
      { href: '/settings', label: 'System Settings', icon: Settings },
    ],
  },
];

export default function Shell({ children, initialActiveRole = 'viewer' }: { children: React.ReactNode, initialActiveRole?: string }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/reset-password';

  if (isAuthPage) return <>{children}</>;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Logic for UI rendering based on role
  const isAdmin = initialActiveRole === 'founder_admin';

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
        <RoleSwitcher initialActiveRole={initialActiveRole} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-border flex items-center px-6 gap-4 shrink-0 bg-card/50 backdrop-blur">
          <SearchBar />
          <div className="ml-auto flex items-center gap-2 relative">
            <NotificationDropdown />
            
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
