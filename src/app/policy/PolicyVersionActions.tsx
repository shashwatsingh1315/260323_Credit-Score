"use client";
import { useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { activateArchivedPolicy, discardDraftPolicy, publishDraftPolicy } from './actions';
import { errorMessage } from './policy-parsing';
import { InlineError } from './PolicyFeedback';

type Counts = { parameters: number; bands: number; personas: number; weights: number };

export default function PolicyVersionActions({ version, counts, outgoingCounts }: { version: any; counts: Counts; outgoingCounts: Counts }) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const comparison = (key: keyof Counts, label: string) => `${label}: ${outgoingCounts[key]} → ${counts[key]}`;

  // Server errors are shown here rather than falling through to the error boundary.
  const run = (action: (formData: FormData) => Promise<void>) => async (formData: FormData) => {
    setError(null);
    try {
      await action(formData);
    } catch (err) {
      // Lets Next's redirect (expired session -> /login) and not-found signals through instead of showing them inline.
      unstable_rethrow(err);
      setError(errorMessage(err));
    }
  };

  const errorLine = error ? <div className="basis-full"><InlineError message={error} /></div> : null;

  if (!version.is_draft && !version.is_active) {
    return <>
      <Button type="button" size="sm" variant="outline" onClick={() => setActivateOpen(true)}>Use this policy</Button>
      {errorLine}
      <ConfirmDialog open={activateOpen} onOpenChange={setActivateOpen} title={`Use ${version.version_label} for new cases?`} description="This archived version will become the live policy. It remains unchanged; only its active status changes." confirmLabel="Use this policy" reasonLabel="" action={run(activateArchivedPolicy)} hiddenFields={{ versionId: version.id }} consequences={[
        comparison('parameters', 'Active parameters'), comparison('bands', 'Score bands'), comparison('personas', 'Personas'), comparison('weights', 'Weight overrides'),
        'The current live version is archived. Existing review cycles keep their captured policy version.',
        `Newly submitted cases will use ${version.version_label}.`,
      ]} />
    </>;
  }

  return <>
    <Button type="button" size="sm" onClick={() => setPublishOpen(true)}>Publish</Button>
    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setDiscardOpen(true)}>Discard draft</Button>
    {errorLine}
    <ConfirmDialog open={publishOpen} onOpenChange={setPublishOpen} title={`Publish ${version.version_label}?`} description="This draft becomes the policy used by newly submitted cases." confirmLabel="Publish policy" reasonLabel="" action={run(publishDraftPolicy)} hiddenFields={{ versionId: version.id }} consequences={[
      comparison('parameters', 'Active parameters'), comparison('bands', 'Score bands'), comparison('personas', 'Personas'), comparison('weights', 'Weight overrides'),
      'The outgoing live version is archived. Existing cycles retain their captured policy version.',
    ]} />
    <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title={`Discard ${version.version_label}?`} description="The unpublished version and all of its child configuration will be deleted." confirmLabel="Discard draft" tone="destructive" irreversible reasonLabel="" action={run(discardDraftPolicy)} hiddenFields={{ versionId: version.id }} consequences={[
      `${counts.parameters} parameters, ${counts.bands} bands, ${counts.personas} personas, and ${counts.weights} weight overrides will be removed.`,
      'The published policy is not changed.',
    ]} />
  </>;
}
