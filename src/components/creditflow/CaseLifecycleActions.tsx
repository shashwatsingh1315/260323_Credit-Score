"use client";
import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/creditflow/ConfirmDialog';
import { handleArchiveCase, handleRestoreCase, handleDeleteCase } from '@/app/cases/actions';

/**
 * Archive / restore / permanently-delete controls for a case row.
 * Rendered outside the row's navigation link so clicks don't open the case.
 * - Archive: case owner (RM/KAM) or admin, finished cases only.
 * - Restore: same actors.
 * - Delete: admin only, archived cases only, retype-the-case-number confirm.
 */
export function CaseLifecycleActions({
  caseId,
  caseNumber,
  isArchived,
  canArchive,
  canDelete,
}: {
  caseId: string;
  caseNumber: string;
  isArchived: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canArchive && !canDelete) return null;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {canArchive && !isArchived && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          title="Archive case"
          aria-label={`Archive case ${caseNumber}`}
          onClick={() => setArchiveOpen(true)}
        >
          <Archive size={15} aria-hidden="true" />
        </Button>
      )}
      {canArchive && isArchived && (
        <form action={handleRestoreCase}>
          <input type="hidden" name="caseId" value={caseId} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            title="Restore from archive"
            aria-label={`Restore case ${caseNumber} from archive`}
          >
            <ArchiveRestore size={15} aria-hidden="true" />
          </Button>
        </form>
      )}
      {canDelete && isArchived && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Delete permanently"
          aria-label={`Permanently delete case ${caseNumber}`}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 size={15} aria-hidden="true" />
        </Button>
      )}

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${caseNumber}?`}
        description="Archiving tidies the working views — nothing is lost."
        consequences={[
          'The case disappears from the case list, search and My Work by default.',
          'It stays fully readable via the "Archived" filter and can be restored any time.',
          'All data, history and audit events are kept.',
        ]}
        confirmLabel="Archive case"
        reasonLabel=""
        action={handleArchiveCase}
        hiddenFields={{ caseId }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Permanently delete ${caseNumber}?`}
        description="This removes the case and every record attached to it from the database."
        consequences={[
          'Review cycles, tasks, approvals, board votes, repayments, credit notes, comments and documents for this case are all deleted.',
          'The case-level audit trail is deleted with it; only a single deletion record remains.',
          'Party master data and learnings captured from this case are kept.',
        ]}
        irreversible
        tone="destructive"
        confirmLabel="Delete forever"
        reasonLabel=""
        requireMatchText={caseNumber}
        action={handleDeleteCase}
        hiddenFields={{ caseId }}
      />
    </div>
  );
}
