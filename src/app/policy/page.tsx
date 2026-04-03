import { fetchPolicyVersions, fetchActivePolicy, createNewDraft, publishDraftPolicy } from './actions';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Sliders, GitBranch, BarChart3, CircleDot, CheckCircle2, Archive } from 'lucide-react';

export default async function PolicyPage() {
  const [versions, active] = await Promise.all([fetchPolicyVersions(), fetchActivePolicy()]);

  const subPages = [
    { href: '/policy/parameters', label: 'Scoring Parameters', icon: Sliders, desc: 'Define and weight parameters used in scoring assessments' },
    { href: '/policy/grades', label: 'Grade Scales', icon: BarChart3, desc: 'Configure grade labels, ranges, and numeric values' },
    { href: '/policy/personas', label: 'Personas', icon: GitBranch, desc: 'Manage persona models and default configurations' },
    { href: '/policy/bands', label: 'Score Bands', icon: CircleDot, desc: 'Map score ranges to approved credit day buckets' },
    { href: '/policy/dominance', label: 'Dominance Categories', icon: GitBranch, desc: 'Configure how customer and contractor scores are blended together' },
    { href: '/policy/weights', label: 'Weight Matrices', icon: BarChart3, desc: 'Assign specific parameter weights mapped to personas' },
    { href: '/policy/routing', label: 'Routing Thresholds', icon: Sliders, desc: 'JSON-based context rules for automatically routing deeper stages' },
    { href: '/policy/validity', label: 'Validity Rules', icon: CheckCircle2, desc: 'Configure dynamic approval-validity windows (e.g. 90 days)' },
    { href: '/policy/stages', label: 'Stage Max Totals', icon: CircleDot, desc: 'Define score max totals for normalization per stage' },
    { href: '/policy/simulation', label: 'Policy Simulation', icon: Sliders, desc: 'Test score results and credit-day mapping before publishing policy' },
  ];

  const getVersionStatus = (v: any) => {
    if (v.is_active) return 'published';
    if (v.is_draft) return 'draft';
    return 'archived';
  };

  const getVersionIcon = (v: any) => {
    const status = getVersionStatus(v);
    if (status === 'published') return <CheckCircle2 size={16} className="text-emerald-400" />;
    if (status === 'archived') return <Archive size={16} className="text-muted-foreground" />;
    return <ShieldCheck size={16} className="text-amber-400" />;
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Policy & Scoring Engine</h1>
          <p className="text-sm font-medium text-muted-foreground mt-2 flex items-center gap-2">
            {active ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 text-success text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 size={12} /> Active: {active.version_label}
                </span>
                <span className="opacity-50">·</span>
                Published {new Date(active.published_at || active.created_at).toLocaleDateString()}
              </>
            ) : (
              'No active policy published yet'
            )}
          </p>
        </div>
        <form action={createNewDraft}>
          <Button type="submit" variant="outline" className="h-11 px-6 rounded-xl font-bold shadow-sm transition-all hover:shadow-md active:scale-[0.98]">
            + New Draft Version
          </Button>
        </form>
      </div>

      {/* Sub-page Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {subPages.map((sp) => {
          const Icon = sp.icon;
          return (
            <Link key={sp.href} href={sp.href} className="group block outline-none">
              <Card className="h-full rounded-2xl border-border/50 shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:border-primary/30 active:scale-[0.99] overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors duration-300">
                      <Icon size={20} className="text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                    </div>
                    <CardTitle className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors">{sp.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed ml-16 pl-1">{sp.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Policy Version History */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-6 border-b border-border/30 bg-muted/10">
          <CardTitle className="text-xl font-bold tracking-tight">Policy Version History</CardTitle>
          <CardDescription className="text-sm font-medium mt-1">Drafts, published, and archived versions</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {versions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground opacity-60">No policy versions yet. Create a new draft above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v: any) => {
                const status = getVersionStatus(v);
                return (
                  <div key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/40 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${status === 'published' ? 'bg-success/10 border-success/20' : status === 'archived' ? 'bg-muted border-border' : 'bg-warning/10 border-warning/20'}`}>
                        {getVersionIcon(v)}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-base font-bold text-foreground">{v.version_label}</p>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{new Date(v.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={status === 'published' ? 'success' : status === 'archived' ? 'secondary' : 'warning'} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm">
                        {status}
                      </Badge>
                      {status === 'draft' && (
                        <form action={publishDraftPolicy}>
                          <input type="hidden" name="versionId" value={v.id} />
                          <Button type="submit" size="sm" variant="default" className="h-9 px-5 rounded-lg font-bold shadow-sm">Publish</Button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
