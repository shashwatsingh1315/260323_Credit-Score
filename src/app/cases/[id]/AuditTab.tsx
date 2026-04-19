"use client";
import { use } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function AuditTab({ promises }: any) {
  const { auditEvents } = use(promises.auditPromise as Promise<any>);
  const data = { auditEvents };

  return (
    <div className="space-y-4 mt-6">
          {data.auditEvents.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No audit events yet.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="relative pl-6 space-y-0">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {data.auditEvents.map((e: any) => (
                    <div key={e.id} className="relative pb-5 last:pb-0">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                      <p className="text-sm font-medium leading-tight">{e.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.actor?.full_name || 'System'} · {new Date(e.created_at).toLocaleString()}
                      </p>
                      {e.field_diffs && (
                        <pre className="mt-1.5 text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(e.field_diffs, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}    </div>
  );
}
