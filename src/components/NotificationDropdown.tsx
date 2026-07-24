"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchMyNotifications, markNotificationRead, clearAllNotifications } from './actions';
import { usePathname } from 'next/navigation';
import { formatDateTimeIST } from '@/lib/format';

/**
 * Notifications (doctrine §12.11, Principle 8): every notification should lead
 * directly to the relevant task, decision, or collection — not to a generic
 * page. Actions are always visible (never hover-only) for touch users.
 */
export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  const isAuthPage = pathname === '/login' || pathname === '/reset-password';

  useEffect(() => {
    if (isAuthPage) return;
    fetchMyNotifications().then(n => {
      setNotifications(n);
      setLoadingNotifs(false);
    }).catch(e => {
      console.error(e);
      setLoadingNotifs(false);
    });
  }, [isAuthPage]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!showNotifs) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotifs(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotifs]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const handleMarkAllRead = async () => {
    await clearAllNotifications();
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setShowNotifs(!showNotifs)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={showNotifs}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-tiny font-bold flex items-center justify-center" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {showNotifs && (
        <div className="absolute top-full mt-2 right-0 w-[min(92vw,22rem)] bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-96">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
              >
                <CheckCheck size={13} aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {loadingNotifs ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No notifications</p>
            ) : notifications.map(n => (
              <div
                key={n.id}
                className={cn(
                  'p-3 rounded-lg text-sm',
                  !n.is_read ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted'
                )}
              >
                <p className="font-medium text-foreground mb-0.5">{n.title}</p>
                {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <p className="text-tiny text-muted-foreground/80">{formatDateTimeIST(n.created_at)}</p>
                  <div className="flex items-center gap-2">
                    {n.link_url && (
                      <Link
                        href={n.link_url}
                        onClick={() => {
                          setShowNotifs(false);
                          if (!n.is_read) handleMarkRead(n.id);
                        }}
                        className="text-xs font-semibold text-primary inline-flex items-center gap-0.5 hover:underline"
                      >
                        Open <ArrowRight size={11} aria-hidden="true" />
                      </Link>
                    )}
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        aria-label={`Mark "${n.title}" as read`}
                        className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-0.5 hover:text-foreground"
                      >
                        <Check size={11} aria-hidden="true" /> Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
