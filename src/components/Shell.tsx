"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogOut, LayoutList, Briefcase, ShieldCheck, Settings, FileText,
  ChevronRight, Shield, PlusCircle, Wallet, Menu, X,
} from 'lucide-react';
import { signOut } from '@/utils/auth-actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import NotificationDropdown from './NotificationDropdown';
import RoleSwitcher from './RoleSwitcher';
import SearchBar from './SearchBar';

/**
 * Application shell — doctrine §11 (IA reflects user intent), Principle 14
 * (mobile preserves the work, not the desktop layout).
 *
 * - "My Work" is the operational home for every role.
 * - Collections is a first-class destination for every role that performs or
 *   supervises collections (RM, KAM, Accounts, Admin) — not an admin module.
 * - New Case appears only for roles that can originate a case (no
 *   "click, then get rejected" dead ends).
 * - On mobile the fixed sidebar becomes a drawer with a backdrop.
 */

interface NavLink {
  href: string;
  label: string;
  icon: any;
  exact?: boolean;
  roles?: string[];
}

interface NavSection {
  section: string;
  links: NavLink[];
}

const COLLECTIONS_ROLES = ['rm', 'kam', 'accounts', 'founder_admin'];
const ORIGINATOR_ROLES = ['rm', 'founder_admin'];
const ADMIN_ROLES = ['founder_admin'];

const NAV: NavSection[] = [
  {
    section: 'Work',
    links: [
      { href: '/', label: 'My Work', icon: LayoutList, exact: true },
      { href: '/cases', label: 'Cases', icon: Briefcase },
      { href: '/cases/new', label: 'New Case', icon: PlusCircle, roles: ORIGINATOR_ROLES },
      { href: '/collections', label: 'Collections', icon: Wallet, roles: COLLECTIONS_ROLES },
    ],
  },
  {
    section: 'Administration',
    links: [
      { href: '/policy', label: 'Policy Engine', icon: ShieldCheck, roles: ADMIN_ROLES },
      { href: '/audit', label: 'Audit & Logs', icon: FileText, roles: ADMIN_ROLES },
      { href: '/admin', label: 'Users & Parties', icon: Shield, roles: ADMIN_ROLES },
      { href: '/settings', label: 'System Settings', icon: Settings, roles: ADMIN_ROLES },
    ],
  },
];

export default function Shell({ children, initialActiveRole = 'viewer' }: { children: React.ReactNode; initialActiveRole?: string }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAuthPage = pathname === '/login' || pathname === '/reset-password';

  // Close the drawer with Escape (mobile).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  if (isAuthPage) return <>{children}</>;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === '/cases/new') return pathname === '/cases/new';
    if (href === '/cases') return pathname.startsWith('/cases') && pathname !== '/cases/new';
    return pathname.startsWith(href);
  };

  const visibleLinks = (links: NavLink[]) =>
    links.filter((l) => !l.roles || l.roles.includes(initialActiveRole));

  const navContent = (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
      {NAV.map((section) => {
        const links = visibleLinks(section.links);
        if (links.length === 0) return null;
        return (
          <div key={section.section}>
            <p className="px-2 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {links.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href, link.exact);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{link.label}</span>
                    {active && <ChevronRight size={14} className="ml-auto opacity-50" aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm" aria-hidden="true">C</div>
      <span className="font-semibold text-foreground tracking-tight">CreditFlow</span>
    </div>
  );

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card shrink-0">
        {brand}
        {navContent}
        <Separator />
        <RoleSwitcher initialActiveRole={initialActiveRole} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col shadow-xl">
            <div className="flex items-center justify-between border-b border-border pr-3">
              {brand}
              <Button variant="ghost" size="icon" aria-label="Close navigation menu" onClick={() => setDrawerOpen(false)} className="shrink-0">
                <X size={18} />
              </Button>
            </div>
            {navContent}
            <Separator />
            <RoleSwitcher initialActiveRole={initialActiveRole} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center px-3 sm:px-6 gap-2 sm:gap-4 shrink-0 bg-card/50 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={18} />
          </Button>
          <SearchBar />
          <div className="ml-auto flex items-center gap-2 relative">
            <NotificationDropdown />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                <LogOut size={15} className="sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">Log Out</span>
                <span className="sr-only sm:hidden">Log Out</span>
              </Button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
