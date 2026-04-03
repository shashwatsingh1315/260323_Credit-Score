import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateSystemSetting } from '@/app/cases/[id]/billing-actions';
import { Settings, ShieldAlert } from 'lucide-react';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    redirect('/unauthorized');
  }

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .order('key');

  const settingMeta: Record<string, { label: string; description: string; unit: string }> = {
    WRITE_OFF_SLIPPAGE_PERCENTAGE: {
      label: 'Write-Off Slippage Threshold',
      description: 'Maximum % gap between Actual and Promised collection before the case is blocked for Admin write-off approval.',
      unit: '%',
    },
    MAX_TRANCHE_EXTENSION_DAYS: {
      label: 'Max Tranche Extension Days',
      description: 'Maximum number of days a KAM is allowed to push a tranche due date from its original scheduled date.',
      unit: 'days',
    },
  };

  return (
    <div className="space-y-10 max-w-3xl pb-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <Settings size={20} />
          </div>
          System Settings
        </h1>
        <p className="text-sm font-medium text-muted-foreground">
          Global configuration parameters. Changes are effective immediately across all users.
        </p>
      </div>

      <div className="bg-warning/10 border border-warning/30 text-warning rounded-xl px-5 py-4 flex items-start gap-3 shadow-sm">
        <ShieldAlert size={20} className="mt-0.5 shrink-0" />
        <p className="font-bold text-sm leading-relaxed">These settings affect live business logic and automated routing. Modify with extreme caution.</p>
      </div>

      <div className="space-y-6 pt-2">
        {(settings ?? []).map((s: any) => {
          const meta = settingMeta[s.key];
          return (
            <Card key={s.key} className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-4 border-b border-border/30 bg-muted/5">
                <CardTitle className="text-base font-bold tracking-tight">
                  {meta?.label ?? s.key}
                </CardTitle>
                {meta?.description && (
                  <p className="text-sm font-medium text-muted-foreground mt-1.5">{meta.description}</p>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <form action={updateSystemSetting} className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <input type="hidden" name="key" value={s.key} />
                  <div className="relative flex-1 max-w-sm">
                    <Input
                      type="number"
                      name="value"
                      defaultValue={s.value}
                      step="0.1"
                      min="0"
                      className="pr-16 h-12 rounded-xl text-lg font-semibold bg-background border-border/60 focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                      required
                    />
                    {meta?.unit && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold uppercase tracking-wider text-muted-foreground pointer-events-none">
                        {meta.unit}
                      </span>
                    )}
                  </div>
                  <Button type="submit" size="sm" className="h-12 px-8 rounded-xl font-bold shadow-sm w-full sm:w-auto">Save Changes</Button>
                </form>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/40">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Last updated:</span>
                  <span className="text-[11px] font-semibold text-foreground/70">{s.updated_at ? new Date(s.updated_at).toLocaleString('en-IN') : 'Never'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!settings || settings.length === 0) && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground opacity-60">No system settings found. Run the Phase 2 SQL migration first.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
