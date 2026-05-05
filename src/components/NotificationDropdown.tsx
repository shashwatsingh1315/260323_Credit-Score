"use client";
import { useState, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fetchMyNotifications, markNotificationRead } from './actions';
import { usePathname } from 'next/navigation';

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const pathname = usePathname();

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

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative">
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
            {loadingNotifs ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No notifications</p>
            ) : notifications.map(n => (
              <div key={n.id} className={cn("p-3 rounded-lg text-sm relative group", !n.is_read ? "bg-primary/5 border border-primary/20" : "hover:bg-muted")}>
                <div className="pr-6">
                  <p className="font-medium text-foreground mb-0.5">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <p className="text-tiny text-muted-foreground mt-2 opacity-70">{new Date(n.created_at).toLocaleString()}</p>
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
    </div>
  );
}
