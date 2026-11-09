import { formatDateTimeIST } from '@/lib/format';
import { createClient } from '@/utils/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { LoadFailed } from '@/components/creditflow/LoadFailed';

/** One row of audit_events, with the actor profile joined in. */
type AuditEvent = {
  id: string;
  event_type: string | null;
  description: string | null;
  case_id: string | null;
  created_at: string;
  actor?: { full_name?: string | null; email?: string | null } | null;
};

export default async function AuditPage() {
  // Read directly (not via fetchGlobalAuditLog, which hides query errors) so a
  // failed read shows "Couldn't load" rather than "No events yet".
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_events')
    .select('*, actor:profiles!audit_events_actor_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) console.error('[audit] audit log query failed', error);
  const events: AuditEvent[] = error ? [] : ((data ?? []) as AuditEvent[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit & Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Immutable record of all system events</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} className="text-primary" /> System Event Log
            <Badge variant="secondary" className="ml-auto">{error ? 'Unavailable' : `${events.length} events`}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {error ? (
            <div className="py-2"><LoadFailed what="the audit log" /></div>
          ) : (
            <div className="relative pl-6 space-y-0">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
              {events.length === 0 && <p className="text-muted-foreground text-sm py-4">No events yet.</p>}
              {events.map((e: AuditEvent) => (
                <div key={e.id} className="relative pb-4 last:pb-0">
                  <div className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-primary/60" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="secondary" className="text-xs">{e.event_type?.replace(/_/g, ' ')}</Badge>
                      </div>
                      <p className="text-sm">{e.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.actor?.full_name || e.actor?.email || 'System'}
                        {e.case_id && ` · Case ${e.case_id.slice(0, 8)}...`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDateTimeIST(e.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
