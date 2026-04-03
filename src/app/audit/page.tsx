import { fetchGlobalAuditLog } from '../admin/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

export default async function AuditPage() {
  const events = await fetchGlobalAuditLog(200);

  return (
    <div className="space-y-10 pb-12 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit & Logs</h1>
        <p className="text-sm font-medium text-muted-foreground">Immutable record of all system events</p>
      </div>

      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-6 border-b border-border/30 bg-muted/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                <FileText size={20} />
              </div>
              System Event Log
            </CardTitle>
            <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm bg-background border-border/50">
              {events.length} events
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="relative pl-8 space-y-0">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border/60 rounded-full" />
            {events.length === 0 && <p className="text-muted-foreground font-medium text-sm py-8 text-center">No events yet.</p>}
            {events.map((e: any, idx: number) => (
              <div key={e.id} className={`relative pb-8 ${idx === events.length - 1 ? 'pb-0' : ''}`}>
                <div className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-background border border-primary/20" />
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-muted/10 p-5 rounded-xl border border-border/40 hover:bg-muted/20 transition-colors w-full">
                  <div className="flex-1 min-w-0 space-y-3">
                    <Badge variant="secondary" className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm bg-background border-border/50">
                      {e.event_type?.replace(/_/g, ' ')}
                    </Badge>
                    <p className="text-base font-bold text-foreground leading-snug">{e.description}</p>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span className="text-foreground/70">{e.actor?.full_name || e.actor?.email || 'System'}</span>
                      {e.case_id && (
                        <>
                          <span className="opacity-30">·</span>
                          <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border/30">Case {e.case_id.slice(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 bg-background px-3 py-1.5 rounded-lg border border-border/50 shadow-sm self-start">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
