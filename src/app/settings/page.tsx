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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings size={22} />
          System Settings
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Global configuration parameters. Changes are effective immediately across all users.
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 rounded-lg px-4 py-3 flex items-start gap-2 text-sm">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <p>These settings affect live business logic. Modify with caution.</p>
      </div>

      <div className="space-y-4">
        {(settings ?? []).map((s: any) => {
          const meta = settingMeta[s.key];
          return (
            <Card key={s.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {meta?.label ?? s.key}
                </CardTitle>
                {meta?.description && (
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <form action={updateSystemSetting} className="flex items-center gap-3">
                  <input type="hidden" name="key" value={s.key} />
                  <div className="relative flex-1 max-w-xs">
                    <Input
                      type="number"
                      name="value"
                      defaultValue={s.value}
                      step="0.1"
                      min="0"
                      className="pr-12"
                      required
                    />
                    {meta?.unit && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                        {meta.unit}
                      </span>
                    )}
                  </div>
                  <Button type="submit" size="sm">Save</Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated: {s.updated_at ? new Date(s.updated_at).toLocaleString('en-IN') : 'Never'}
                </p>
              </CardContent>
            </Card>
          );
        })}

        {(!settings || settings.length === 0) && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No system settings found. Run the Phase 2 SQL migration first.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
