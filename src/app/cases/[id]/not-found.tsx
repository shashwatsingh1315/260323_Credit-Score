import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/creditflow/EmptyState';

/** Rendered inside the app shell when /cases/[id] calls notFound(). */
export default function CaseNotFound() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <EmptyState
        icon={FileQuestion}
        title="This case doesn't exist or you don't have access to it"
        body="Check the case ID, or return to the case list to find the case you're looking for."
        actionHref="/cases"
        actionLabel="Back to cases"
      />
    </div>
  );
}
