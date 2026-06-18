import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateSystemSetting } from '@/app/cases/[id]/billing-actions';
import { Settings, ShieldAlert, ListChecks, Hash } from 'lucide-react';
import RcaReasonManager from './RcaReasonManager';
import DelayReasonManager from './DelayReasonManager';
import CityCodeManager from './CityCodeManager';
import PrefixManager from './PrefixManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const { data: rcaReasons } = await supabase
    .from('admin_enumerations')
    .select('*')
    .eq('category', 'reason_for_credit')
    .order('sort_order');

  const { data: delayReasons } = await supabase
    .from('admin_enumerations')
    .select('*')
    .eq('category', 'delay_reason')
    .order('sort_order');

  const { data: cityCodes } = await supabase
    .from('city_codes')
    .select('*')
    .order('name');
    
  const { data: prefixes } = await supabase
    .from('id_prefixes')
    .select('*')
    .order('entity_type');

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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings size={22} />
          System Settings
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Global configuration parameters. Changes are effective immediately across all users.
        </p>
      </div>

      <Tabs defaultValue="variables" className="space-y-6">
        <TabsList>
          <TabsTrigger value="variables" className="flex items-center gap-2">
            <ListChecks size={16} />
            System Variables
          </TabsTrigger>
          <TabsTrigger value="id_engine" className="flex items-center gap-2">
            <Hash size={16} />
            ID Format Engine
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variables" className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 rounded-lg px-4 py-3 flex items-start gap-2 text-sm max-w-2xl">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <p>These settings affect live business logic. Modify with caution.</p>
          </div>

          <div className="space-y-4 max-w-2xl">
            {(settings ?? []).map((s: any) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
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

          <div className="pt-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              Dropdown Enumerations
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3 border-b mb-3">
                  <CardTitle className="text-base">Reason for Credit (RCA)</CardTitle>
                  <p className="text-xs text-muted-foreground">Used in the New Case wizard.</p>
                </CardHeader>
                <CardContent>
                  <RcaReasonManager reasons={rcaReasons || []} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3 border-b mb-3">
                  <CardTitle className="text-base">SLA Delay Reasons</CardTitle>
                  <p className="text-xs text-muted-foreground">Used by operators when completing an overdue task.</p>
                </CardHeader>
                <CardContent>
                   <DelayReasonManager reasons={delayReasons || []} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="id_engine" className="space-y-6">
           <div>
             <h2 className="text-xl font-bold text-foreground mb-1">Entity ID Logic</h2>
             <p className="text-sm text-muted-foreground mb-4">Manage the dynamic variables used by the system to assemble unique Reference IDs for Core Entities.</p>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>City Codes Mapping</CardTitle>
                  <CardDescription>3-letter constants used across all ID variants (e.g. RPR, NAG). Ensure length is exactly 3 characters.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CityCodeManager cityCodes={cityCodes || []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Prefix Mappings</CardTitle>
                  <CardDescription>Modify the static prefixes attached to entity IDs. Note: converted sites typically have no prefix.</CardDescription>
                </CardHeader>
                <CardContent>
                  <PrefixManager prefixes={prefixes || []} />
                </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
