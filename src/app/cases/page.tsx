import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Briefcase, ChevronRight, ChevronLeft } from 'lucide-react';
import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';
import { StatusBadge } from '@/components/creditflow/StatusBadge';
import { EmptyState } from '@/components/creditflow/EmptyState';
import { CaseLifecycleActions } from '@/components/creditflow/CaseLifecycleActions';
import { PHASE_FILTERS, getStatusMeta, describeScenario } from '@/lib/vocabulary';
import { formatCompactINR, formatDateIST, relativeDays } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

/**
 * Cases index — the searchable system of record (doctrine §11.1, §12.2).
 * Users filter by user-facing phases, not the 14-value internal state model,
 * and each row answers: what is it, where is it, who owns it, what's next.
 */
export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; phase?: string; party?: string; page?: string; archived?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const statusFilter = sp.status || '';
  const phaseFilter = sp.phase || '';
  const partyFilter = sp.party || '';
  // '' = active only (default), 'include' = active + archived, 'only' = archived only
  const archivedMode = sp.archived === 'include' || sp.archived === 'only' ? sp.archived : '';
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const supabase = await createClient();
  const activeRole = await getImpersonationRole();
  const user = await getCurrentUser();

  // Broad search: match case number OR party legal name / code (two-step).
  let partyIdsFromSearch: string[] = [];
  let searchParty: any = null;
  if (q) {
    const { data: matchedParties } = await supabase
      .from('parties')
      .select('id')
      .or(`legal_name.ilike.%${q}%,customer_code.ilike.%${q}%`)
      .limit(50);
    partyIdsFromSearch = (matchedParties || []).map((p: any) => p.id);
  }
  if (partyFilter) {
    const { data: p } = await supabase.from('parties').select('id, legal_name, customer_code').eq('id', partyFilter).single();
    searchParty = p;
  }

  let query = supabase
    .from('credit_cases')
    .select(`
      id, case_number, status, substatus, case_scenario, bill_amount, composite_credit_days, created_at, updated_at,
      billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches, archived_at, rm_user_id, kam_user_id,
      customer:parties!credit_cases_customer_party_id_fkey(legal_name),
      contractor:parties!credit_cases_contractor_party_id_fkey(legal_name),
      rm:profiles!credit_cases_rm_user_id_fkey(full_name),
      kam:profiles!credit_cases_kam_user_id_fkey(full_name),
      review_cycles(approved_credit_days, is_active, active_stage)
    `, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (user) {
    if (activeRole === 'rm') query = query.eq('rm_user_id', user.id);
    else if (activeRole === 'kam') query = query.eq('kam_user_id', user.id);
  }

  if (archivedMode === '') query = query.is('archived_at', null);
  else if (archivedMode === 'only') query = query.not('archived_at', 'is', null);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  } else if (phaseFilter) {
    const phase = PHASE_FILTERS.find((p) => p.key === phaseFilter);
    if (phase && phase.statuses.length > 0) query = query.in('status', phase.statuses);
  }

  if (partyFilter) {
    query = query.or(`customer_party_id.eq.${partyFilter},contractor_party_id.eq.${partyFilter}`);
  }

  if (q) {
    if (partyIdsFromSearch.length > 0) {
      const idList = partyIdsFromSearch.map((id) => `"${id}"`).join(',');
      query = query.or(`case_number.ilike.%${q}%,customer_party_id.in.(${idList}),contractor_party_id.in.(${idList})`);
    } else {
      query = query.ilike('case_number', `%${q}%`);
    }
  }

  const { data: cases, count, error: queryError } = await query;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const canCreateCase = activeRole === 'rm' || activeRole === 'founder_admin';
  const isAdminRole = activeRole === 'founder_admin';
  // Mirrors ARCHIVABLE_STATUSES in ./actions.ts — only finished cases can be archived.
  const archivableStatuses = ['Closed', 'Rejected', 'Cancelled', 'Withdrawn', 'Expired'];
  const canArchiveCase = (c: any) =>
    isAdminRole ||
    (activeRole === 'rm' && c.rm_user_id === user?.id) ||
    (activeRole === 'kam' && c.kam_user_id === user?.id);

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { q, status: statusFilter, phase: phaseFilter, party: partyFilter, archived: archivedMode, page: String(page), ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v && !(k === 'page' && v === '1')) params.set(k, v);
    });
    const s = params.toString();
    return `/cases${s ? `?${s}` : ''}`;
  };

  // Next-action / owner derivation for prioritization context.
  const getTrancheStatus = (c: any) => {
    if (!['Billing Active', 'Pending Write-Off Approval'].includes(c.status)) return null;
    if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) return null;

    const now = new Date();
    const billingDate = new Date(c.billing_date);
    let remaining = c.actual_bill_amount ?? 0;

    for (const t of c.proposed_tranches as any[]) {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * c.decided_bill_amount)
        : Math.round(t.value);
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      const fill = Math.min(remaining, amt);
      remaining -= fill;
      const unpaid = amt - fill;
      if (unpaid > 0) {
        const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);
        return daysOverdue > 0
          ? { type: 'delayed' as const, text: `${formatCompactINR(unpaid)} overdue ${daysOverdue}d` }
          : { type: 'upcoming' as const, text: `${formatCompactINR(unpaid)} due ${formatDateIST(due)}` };
      }
    }
    return null;
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} {archivedMode === 'only' ? 'archived ' : ''}case{total !== 1 ? 's' : ''}
            {archivedMode === 'include' && ' (including archived)'}
            {searchParty && <> for <strong>{searchParty.legal_name}</strong> ({searchParty.customer_code})</>}
            {q && <> matching <strong>&ldquo;{q}&rdquo;</strong></>}
          </p>
        </div>
        {canCreateCase && (
          <Button asChild>
            <Link href="/cases/new"><PlusCircle size={16} aria-hidden="true" /> New Case</Link>
          </Button>
        )}
      </div>

      {/* Search + phase filters */}
      <div className="space-y-2.5">
        <form id="case-filters" className="flex gap-2 max-w-md" role="search">
          <label htmlFor="case-search" className="sr-only">Search cases by number or party</label>
          <input
            id="case-search"
            name="q"
            defaultValue={q}
            placeholder="Search case number or party…"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {phaseFilter && <input type="hidden" name="phase" value={phaseFilter} />}
          {partyFilter && <input type="hidden" name="party" value={partyFilter} />}
          <Button type="submit" size="sm" variant="secondary">Search</Button>
          {(q || partyFilter) && (
            <Button asChild size="sm" variant="ghost">
              <Link href={buildUrl({ q: '', party: '', page: '1' })}>Clear</Link>
            </Button>
          )}
        </form>
        {archivedMode !== 'only' && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground w-fit cursor-pointer">
            <input
              type="checkbox"
              name="archived"
              value="include"
              form="case-filters"
              defaultChecked={archivedMode === 'include'}
              className="h-3.5 w-3.5 rounded border-input accent-primary"
            />
            Include archived cases in search results
          </label>
        )}
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Filter by lifecycle phase">
          {PHASE_FILTERS.map((p) => (
            <Link key={p.key} href={buildUrl({ phase: p.key, status: '', archived: archivedMode === 'only' ? '' : archivedMode, page: '1' })}>
              <Button
                size="sm"
                variant={phaseFilter === p.key && !statusFilter && archivedMode !== 'only' ? 'default' : 'secondary'}
                className="text-xs"
                aria-pressed={phaseFilter === p.key && !statusFilter && archivedMode !== 'only'}
              >
                {p.label}
              </Button>
            </Link>
          ))}
          <Link href={buildUrl({ phase: '', status: '', archived: 'only', page: '1' })}>
            <Button
              size="sm"
              variant={archivedMode === 'only' ? 'default' : 'secondary'}
              className="text-xs"
              aria-pressed={archivedMode === 'only'}
            >
              Archived
            </Button>
          </Link>
        </div>
      </div>

      {/* A failed query must never masquerade as an empty list (doctrine: tell the truth) */}
      {queryError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive-strong">The case list could not be loaded</p>
          <p className="text-foreground/80 mt-0.5">
            Database error: {queryError.message}
            {queryError.message.includes('archived_at') && (
              <> — the case-archival migration (<span className="font-mono">20260721000000_case_archival.sql</span>) has not been applied to this database yet.</>
            )}
          </p>
        </div>
      )}

      {/* Rows */}
      {queryError ? null : !cases || cases.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No cases found"
          body={archivedMode === 'only'
            ? 'No archived cases. Finished cases can be archived from this list to keep it tidy.'
            : q || phaseFilter || partyFilter ? 'Try clearing the search or choosing a different phase.' : 'Cases you originate or work on will appear here.'}
          actionHref={canCreateCase && !q && !phaseFilter ? '/cases/new' : undefined}
          actionLabel="Create your first case"
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {cases.map((c: any) => {
            const ts = getTrancheStatus(c);
            const meta = getStatusMeta(c.status);
            const cycle = c.review_cycles?.find((r: any) => r.is_active) || c.review_cycles?.[0];
            const isApprovedPlus = ['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status);
            const ownerName = meta.ownerRole === 'rm' ? c.rm?.full_name
              : meta.ownerRole === 'kam' ? c.kam?.full_name
              : null;

            const showActions = canArchiveCase(c) && (c.archived_at || archivableStatuses.includes(c.status));

            return (
              <Card key={c.id} className={cn('transition-colors', c.archived_at ? 'opacity-80' : 'hover:border-primary/50')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Link href={`/cases/${c.id}`} className="flex-1 min-w-0 space-y-1.5 group">
                      {/* Line 1: identity + state */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{c.case_number}</span>
                        <span className="text-sm text-foreground/90 truncate">
                          {(c.customer as any)?.legal_name || (c.contractor as any)?.legal_name || 'No party'}
                        </span>
                        <StatusBadge status={c.status} substatus={c.substatus} />
                        {c.archived_at && (
                          <span className="text-tiny font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            Archived
                          </span>
                        )}
                        {ts && (
                          <span className={cn(
                            'text-tiny font-semibold px-1.5 py-0.5 rounded',
                            ts.type === 'delayed' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'
                          )}>
                            {ts.text}
                          </span>
                        )}
                      </div>
                      {/* Line 2: what it is */}
                      <p className="text-xs text-muted-foreground">
                        {formatCompactINR(c.bill_amount)} bill ·{' '}
                        {isApprovedPlus && cycle?.approved_credit_days != null
                          ? <span className="text-success font-medium">{cycle.approved_credit_days}d approved terms</span>
                          : <>{c.composite_credit_days || 0}d requested terms</>}
                        {' · '}{describeScenario(c.case_scenario)}
                        {cycle?.active_stage && ['In Review', 'Awaiting Input'].includes(c.status) && ` · Stage ${cycle.active_stage}`}
                      </p>
                      {/* Line 3: what happens next + who owns it */}
                      <p className="text-xs">
                        <span className="text-foreground/85 font-medium">Next: {meta.nextAction}</span>
                        {ownerName && <span className="text-muted-foreground"> · {ownerName}</span>}
                        <span className="text-muted-foreground"> · last activity {relativeDays(c.updated_at)}</span>
                      </p>
                    </Link>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-muted-foreground">RM {c.rm?.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Opened {formatDateIST(c.created_at)}</p>
                    </div>
                    {showActions && (
                      <CaseLifecycleActions
                        caseId={c.id}
                        caseNumber={c.case_number}
                        isArchived={!!c.archived_at}
                        canArchive={canArchiveCase(c)}
                        canDelete={isAdminRole}
                      />
                    )}
                    <Link href={`/cases/${c.id}`} aria-label={`Open case ${c.case_number}`} className="shrink-0 self-center text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Case list pagination" className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={buildUrl({ page: String(page - 1) })}>
                  <ChevronLeft size={14} aria-hidden="true" /> Previous
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                <ChevronLeft size={14} aria-hidden="true" /> Previous
              </Button>
            )}
            {page < totalPages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={buildUrl({ page: String(page + 1) })}>
                  Next <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Next <ChevronRight size={14} aria-hidden="true" />
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
