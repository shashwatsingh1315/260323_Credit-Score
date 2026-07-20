import { fetchPolicyVersions, createNewDraft, fetchPolicyVersionCounts, resolvePolicyVersion } from './actions';
import PolicyContextBar, { policyVersionQuery } from './PolicyContextBar';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Sliders, GitBranch, BarChart3, CircleDot, CheckCircle2, Archive, FolderOpen } from 'lucide-react';
import PolicyVersionActions from './PolicyVersionActions';

export default async function PolicyPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const [versions, version] = await Promise.all([fetchPolicyVersions(), resolvePolicyVersion(v)]);
  const countsByVersion = new Map(await Promise.all(versions.map(async (policyVersion: any) => [policyVersion.id, await fetchPolicyVersionCounts(policyVersion.id)] as const)));
  const activeVersion = versions.find((policyVersion: any) => policyVersion.is_active);
  const emptyCounts = { parameters: 0, bands: 0, personas: 0, weights: 0 };
  const vq = policyVersionQuery(version);

  const pipelineSections = [
    { title: 'Evidence & measurement', description: 'What evidence is collected and how answers become grades.', pages: [
      { href: '/policy/parameters', label: 'Scoring Parameters', icon: Sliders, desc: 'Define evidence, rubrics, mappings, weight, and workflow ownership.' },
      { href: '/policy/grades', label: 'Grade Scales', icon: BarChart3, desc: 'Configure the shared grade labels and numeric values.' },
    ] },
    { title: 'Importance', description: 'How parameter importance changes by persona.', pages: [
      { href: '/policy/personas', label: 'Personas', icon: GitBranch, desc: 'Manage weight profiles and optional minimum-score gates.' },
      { href: '/policy/weights', label: 'Weight Matrices', icon: BarChart3, desc: 'See defaults and persona overrides in one matrix.' },
    ] },
    { title: 'Aggregation', description: 'How weighted grades become a normalized case score.', pages: [
      { href: '/policy/stages', label: 'Stage Max Totals', icon: CircleDot, desc: 'Define cumulative normalization totals and inspect drift.' },
      { href: '/policy/dominance', label: 'Dominance', icon: GitBranch, desc: 'Configure how customer and contractor scores combine.' },
    ] },
    { title: 'Outcome & lifecycle', description: 'What the score means and how far an approval must travel.', pages: [
      { href: '/policy/bands', label: 'Score Bands', icon: CircleDot, desc: 'Map score ranges to recommended credit days.' },
      { href: '/policy/routing', label: 'Routing', icon: Sliders, desc: 'Enforce the minimum review stage from exposure, scenario, and score.' },
      { href: '/policy/validity', label: 'Validity', icon: CheckCircle2, desc: 'Stamp approval expiry and show non-blocking warnings.' },
    ] },
    { title: 'Tools', description: 'Inspect the policy before publishing.', pages: [
      { href: '/policy/simulation', label: 'Simulation', icon: Sliders, desc: 'Preview scoring and ambiguity behavior; richer case-file simulation remains planned.' },
    ] },
  ];

  const getVersionStatus = (pv: any) => {
    if (pv.is_active) return 'published';
    if (pv.is_draft) return 'draft';
    return 'archived';
  };

  const getVersionIcon = (pv: any) => {
    const status = getVersionStatus(pv);
    if (status === 'published') return <CheckCircle2 size={16} className="text-success" />;
    if (status === 'archived') return <Archive size={16} className="text-muted-foreground" />;
    return <ShieldCheck size={16} className="text-warning" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Policy & Scoring Engine</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Version-controlled scoring configuration. Stage changes in a draft, then publish.
          </p>
        </div>
        <form action={createNewDraft}>
          <Button type="submit" variant="outline" size="sm">
            + New Draft
          </Button>
        </form>
      </div>

      {/* Which version the config screens below will open */}
      <PolicyContextBar version={version} />

      {/* Sub-page Navigation Cards — carry the version context */}
      <div className="space-y-6">
        {pipelineSections.map((section, sectionIndex) => <section key={section.title} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{sectionIndex + 1}. {section.title}</h2>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.pages.map((sp) => {
          const Icon = sp.icon;
          return (
            <Link key={sp.href} href={`${sp.href}${vq}`}>
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
        </section>)}
      </div>

      <Separator />

      {/* Policy Version History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy Version History</CardTitle>
          <CardDescription>Open a version to view or edit its configuration. Archived versions are read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No policy versions yet. Create a new draft above.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((pv: any) => {
                const status = getVersionStatus(pv);
                const isCurrentContext = version?.id === pv.id;
                return (
                  <div key={pv.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isCurrentContext ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                    <div className="flex items-center gap-3">
                      {getVersionIcon(pv)}
                      <div>
                        <p className="text-sm font-medium">
                          {pv.version_label}
                          {isCurrentContext && <span className="ml-2 text-tiny font-semibold uppercase tracking-wider text-primary">Current context</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(pv.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={status === 'published' ? 'success' : status === 'archived' ? 'secondary' : 'warning'}>
                        {status}
                      </Badge>
                      {!isCurrentContext && (
                        <Link href={pv.is_active ? '/policy' : `/policy?v=${pv.id}`}>
                          <Button size="sm" variant="ghost"><FolderOpen size={14} /> Open</Button>
                        </Link>
                      )}
                      {status === 'draft' && (
                        <PolicyVersionActions version={pv} counts={countsByVersion.get(pv.id) || emptyCounts} outgoingCounts={activeVersion ? countsByVersion.get(activeVersion.id) || emptyCounts : emptyCounts} />
                      )}
                      {status === 'archived' && (
                        <PolicyVersionActions version={pv} counts={countsByVersion.get(pv.id) || emptyCounts} outgoingCounts={activeVersion ? countsByVersion.get(activeVersion.id) || emptyCounts : emptyCounts} />
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
