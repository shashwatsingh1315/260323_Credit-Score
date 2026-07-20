import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateSystemSetting } from '@/app/cases/[id]/billing-actions';
import { Settings, ShieldAlert, ListChecks, Hash, BookOpen } from 'lucide-react';
import RcaReasonManager from './RcaReasonManager';
import DelayReasonManager from './DelayReasonManager';
import CityCodeManager from './CityCodeManager';
import PrefixManager from './PrefixManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTimeIST } from '@/lib/format';

const humanizeKey = (key: string) => key.toLowerCase().split('_').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect('/unauthorized');

  const supabase = await createClient();
  const [settingsRes, rcaRes, delayRes, citiesRes, prefixesRes, pendingWriteOffsRes, activeCasesRes] = await Promise.all([
    supabase.from('system_settings').select('*').order('key'),
    supabase.from('admin_enumerations').select('*').eq('category', 'reason_for_credit').order('sort_order'),
    supabase.from('admin_enumerations').select('*').eq('category', 'delay_reason').order('sort_order'),
    supabase.from('city_codes').select('*').order('name'),
    supabase.from('id_prefixes').select('*').order('entity_type'),
    supabase.from('credit_cases').select('id', { count: 'exact', head: true }).eq('status', 'Pending Write-Off Approval'),
    supabase.from('credit_cases').select('original_tranches, proposed_tranches').in('status', ['Billing Active', 'Pending Write-Off Approval']),
  ]);

  const maxExtensionInUse = (activeCasesRes.data || []).reduce((maximum: number, creditCase: any) => {
    const original = Array.isArray(creditCase.original_tranches) ? creditCase.original_tranches : [];
    const current = Array.isArray(creditCase.proposed_tranches) ? creditCase.proposed_tranches : [];
    return Math.max(maximum, ...current.map((tranche: any, index: number) => Number(tranche.days_after_billing || 0) - Number(original[index]?.days_after_billing || 0)), 0);
  }, 0);

  const settingMeta: Record<string, { label: string; description: string; unit: string; blastRadius: string }> = {
    WRITE_OFF_SLIPPAGE_PERCENTAGE: {
      label: 'Write-off slippage threshold', unit: '%',
      description: 'Maximum gap between actual and promised collection before Admin write-off approval is required.',
      blastRadius: `${pendingWriteOffsRes.count || 0} case(s) are currently pending write-off approval.`,
    },
    MAX_TRANCHE_EXTENSION_DAYS: {
      label: 'Maximum tranche extension', unit: 'days',
      description: 'Maximum number of days a KAM may push a tranche beyond its original schedule.',
      blastRadius: `The largest extension currently in use is ${maxExtensionInUse} day(s).`,
    },
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Settings size={22} /> System settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Controls grouped by the intent of the administrator changing them.</p>
      </div>

      <Tabs defaultValue="risk" className="space-y-6">
        <TabsList>
          <TabsTrigger value="risk" className="gap-2"><ListChecks size={16} />Risk controls</TabsTrigger>
          <TabsTrigger value="vocabulary" className="gap-2"><BookOpen size={16} />Vocabulary</TabsTrigger>
          <TabsTrigger value="identity" className="gap-2"><Hash size={16} />Identity formats</TabsTrigger>
        </TabsList>

        <TabsContent value="risk" className="space-y-5">
          <div className="flex max-w-2xl items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-strong"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><p>These controls affect live business logic immediately.</p></div>
          <div className="max-w-2xl space-y-4">
            {(settingsRes.data || []).map((setting: any) => {
              const meta = settingMeta[setting.key];
              return <Card key={setting.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{meta?.label || humanizeKey(setting.key)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{meta?.description || 'No description registered — add it to settingMeta.'}</p>
                </CardHeader>
                <CardContent>
                  <form action={updateSystemSetting} className="flex items-center gap-3">
                    <input type="hidden" name="key" value={setting.key} />
                    <div className="relative max-w-xs flex-1"><Input type="number" name="value" defaultValue={setting.value} step="0.1" min="0" className="pr-14" required />{meta?.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{meta.unit}</span>}</div>
                    <Button type="submit" size="sm">Save</Button>
                  </form>
                  <p className="mt-2 text-xs text-foreground">{meta?.blastRadius || 'Blast radius is not yet registered for this control.'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Last updated: {setting.updated_at ? formatDateTimeIST(setting.updated_at) : 'Never'}</p>
                </CardContent>
              </Card>;
            })}
          </div>
        </TabsContent>

        <TabsContent value="vocabulary" className="grid gap-6 md:grid-cols-2">
          <Card><CardHeader className="border-b pb-3"><CardTitle className="text-base">Credit justification reasons</CardTitle><CardDescription>Used in the Site & handoff step of new-case intake.</CardDescription></CardHeader><CardContent className="pt-4"><RcaReasonManager reasons={rcaRes.data || []} /></CardContent></Card>
          <Card><CardHeader className="border-b pb-3"><CardTitle className="text-base">SLA delay reasons</CardTitle><CardDescription>Used when an operator completes a task after its SLA deadline.</CardDescription></CardHeader><CardContent className="pt-4"><DelayReasonManager reasons={delayRes.data || []} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="identity" className="space-y-5">
          <div><h2 className="text-xl font-bold">Entity ID logic</h2><p className="text-sm text-muted-foreground">Manage city codes and stable prefixes used to assemble reference IDs.</p></div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>City codes</CardTitle><CardDescription>Three-letter constants used in site IDs.</CardDescription></CardHeader><CardContent><CityCodeManager cityCodes={citiesRes.data || []} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Prefix mappings</CardTitle><CardDescription>Static prefixes attached to entity IDs.</CardDescription></CardHeader><CardContent><PrefixManager prefixes={prefixesRes.data || []} /></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
