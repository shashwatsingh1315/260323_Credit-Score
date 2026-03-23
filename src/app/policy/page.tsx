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
    { href: '/policy/personas', label: 'Personas', icon: GitBranch, desc: 'Manage persona models and dominance categories' },
    { href: '/policy/bands', label: 'Score Bands', icon: CircleDot, desc: 'Map score ranges to approved credit day buckets' },
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Policy & Scoring Engine</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {active
              ? `Active: ${active.version_label} · Published ${new Date(active.published_at || active.created_at).toLocaleDateString()}`
              : 'No active policy published yet'}
          </p>
        </div>
        <form action={createNewDraft}>
          <Button type="submit" variant="outline" size="sm">
            + New Draft
          </Button>
        </form>
      </div>

      {/* Sub-page Navigation Cards */}
      <div className="grid grid-cols-2 gap-4">
        {subPages.map((sp) => {
          const Icon = sp.icon;
          return (
            <Link key={sp.href} href={sp.href}>
              <Card className="hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer h-full">
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
              </Card>
            </Link>
          );
        })}
      </div>

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
                      {getVersionIcon(v)}
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
