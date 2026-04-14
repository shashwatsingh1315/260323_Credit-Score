import { fetchPolicyVersions, fetchActivePolicy, createNewDraft, publishDraftPolicy } from './actions';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Sliders, GitBranch, BarChart3, CircleDot, CheckCircle2, Archive } from 'lucide-react';

// Animation imports
import { SpotlightCard } from '@/components/animations/SpotlightCard';
import { GlowPulse } from '@/components/animations/GlowPulse';
import { BlurText } from '@/components/animations/BlurText';
import { ShinyText } from '@/components/animations/ShinyText';
import { StaggeredFade } from '@/components/animations/StaggeredFade';
import { StarBorder } from '@/components/animations/StarBorder';

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
    if (status === 'published') return <CheckCircle2 size={16} className="text-success" />;
    if (status === 'archived') return <Archive size={16} className="text-muted-foreground" />;
    return <ShieldCheck size={16} className="text-warning" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <BlurText text="Policy & Scoring Engine" className="text-2xl font-bold text-foreground" />
          <ShinyText 
            text={active
              ? `Active: ${active.version_label} · Published ${new Date(active.published_at || active.created_at).toLocaleDateString()}`
              : 'No active policy published yet'}
            className="text-muted-foreground mt-1 text-sm"
          />
        </div>
        <form action={createNewDraft}>
          <button type="submit" className="focus:outline-none focus-visible:ring-2 ring-primary rounded-xl">
            <StarBorder className="rounded-xl p-[1px]">
              <span className="text-sm font-medium px-2 py-1 block">+ New Draft</span>
            </StarBorder>
          </button>
        </form>
      </div>

      {/* Sub-page Navigation Cards */}
      <StaggeredFade staggerDelay={0.04} className="grid grid-cols-2 gap-4">
        {subPages.map((sp) => {
          const Icon = sp.icon;
          return (
            <Link key={sp.href} href={sp.href}>
              <SpotlightCard className="hover:scale-[1.02] transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <CardTitle className="text-base">{sp.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{sp.desc}</p>
                </CardContent>
              </SpotlightCard>
            </Link>
          );
        })}
      </StaggeredFade>

      <Separator />

      {/* Policy Version History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy Version History</CardTitle>
          <CardDescription>Drafts, published, and archived versions</CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No policy versions yet. Create a new draft above.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v: any) => {
                const status = getVersionStatus(v);
                return (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3">
                      {status === 'published' ? (
                        <GlowPulse variant="success">{getVersionIcon(v)}</GlowPulse>
                      ) : getVersionIcon(v)}
                      <div>
                        <p className="text-sm font-medium">{v.version_label}</p>
                        <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={status === 'published' ? 'success' : status === 'archived' ? 'secondary' : 'warning'}>
                        {status}
                      </Badge>
                      {status === 'draft' && (
                        <form action={publishDraftPolicy}>
                          <input type="hidden" name="versionId" value={v.id} />
                          <Button type="submit" size="sm" variant="default">Publish</Button>
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
