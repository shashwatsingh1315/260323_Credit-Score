import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Briefcase, Building2, Search as SearchIcon } from 'lucide-react';
import { StatusBadge } from '@/components/creditflow/StatusBadge';
import { formatCompactINR, relativeDays } from '@/lib/format';
import { getImpersonationRole } from '@/utils/auth-actions';
import { getCurrentUser } from '@/utils/auth';

/**
 * Global search — doctrine §11.3: find cases and parties with the identifiers
 * users naturally know (case number, party name, customer/contractor code,
 * RM/KAM name). Every result is actionable — a party leads to its cases.
 * Case results respect role scoping: RMs and KAMs only see their own cases.
 */
export default async function SearchResultsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const { q, archived } = await searchParams;
  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <SearchIcon size={48} className="mb-4 opacity-20" aria-hidden="true" />
        <p>Search by case number, party name or code, or RM/KAM name.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const activeRole = await getImpersonationRole();
  const user = await getCurrentUser();
  const includeArchived = archived === '1';
  const term = q.trim();
  const like = `%${term}%`;

  // Find matching parties (name OR code) and matching users (RM/KAM) first,
  // then include their cases — one round trip each, no row caps hidden.
  const [
    { data: parties },
    { data: matchedUsers },
  ] = await Promise.all([
    supabase.from('parties')
      .select('id, legal_name, customer_code, party_type, is_active')
      .or(`legal_name.ilike.${like},customer_code.ilike.${like}`)
      .limit(20),
    supabase.from('profiles')
      .select('id, full_name')
      .ilike('full_name', like)
      .limit(10),
  ]);

  const partyIds = (parties || []).map((p: any) => p.id);
  const userIds = (matchedUsers || []).map((u: any) => u.id);

  const orClauses: string[] = [`case_number.ilike.${like}`];
  if (partyIds.length > 0) {
    const ids = partyIds.map((id: string) => `"${id}"`).join(',');
    orClauses.push(`customer_party_id.in.(${ids})`, `contractor_party_id.in.(${ids})`);
  }
  if (userIds.length > 0) {
    const ids = userIds.map((id: string) => `"${id}"`).join(',');
    orClauses.push(`rm_user_id.in.(${ids})`, `kam_user_id.in.(${ids})`);
  }

  let caseQuery = supabase.from('credit_cases')
    .select('id, case_number, status, case_scenario, bill_amount, updated_at, archived_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name), rm:profiles!credit_cases_rm_user_id_fkey(full_name), kam:profiles!credit_cases_kam_user_id_fkey(full_name)')
    .or(orClauses.join(','))
    .order('updated_at', { ascending: false })
    .limit(25);

  // Role scoping mirrors /cases — RMs and KAMs search only their own book.
  if (user) {
    if (activeRole === 'rm') caseQuery = caseQuery.eq('rm_user_id', user.id);
    else if (activeRole === 'kam') caseQuery = caseQuery.eq('kam_user_id', user.id);
  }
  if (!includeArchived) caseQuery = caseQuery.is('archived_at', null);

  const { data: cases } = await caseQuery;

  // Case counts per matched party so results are actionable.
  const partyCaseCounts: Record<string, number> = {};
  if (partyIds.length > 0) {
    const { data: partyCases } = await supabase.from('credit_cases')
      .select('customer_party_id, contractor_party_id')
      .or(partyIds.map((id: string) => `customer_party_id.eq.${id},contractor_party_id.eq.${id}`).join(','))
      .limit(200);
    for (const pc of partyCases || []) {
      if (pc.customer_party_id && partyIds.includes(pc.customer_party_id)) {
        partyCaseCounts[pc.customer_party_id] = (partyCaseCounts[pc.customer_party_id] || 0) + 1;
      }
      if (pc.contractor_party_id && partyIds.includes(pc.contractor_party_id)) {
        partyCaseCounts[pc.contractor_party_id] = (partyCaseCounts[pc.contractor_party_id] || 0) + 1;
      }
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Search Results</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {(cases?.length || 0)} case{(cases?.length || 0) !== 1 ? 's' : ''} and {parties?.length || 0} part{(parties?.length || 0) !== 1 ? 'ies' : 'y'} matching <strong>&ldquo;{term}&rdquo;</strong>
          {includeArchived ? (
            <> · including archived · <Link href={`/search?q=${encodeURIComponent(term)}`} className="underline underline-offset-2">hide archived</Link></>
          ) : (
            <> · <Link href={`/search?q=${encodeURIComponent(term)}&archived=1`} className="underline underline-offset-2">include archived cases</Link></>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section aria-label="Matching cases">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Briefcase size={18} className="text-primary" aria-hidden="true" /> Cases ({cases?.length || 0})
          </h2>
          {cases && cases.length > 0 ? (
            <div className="space-y-2">
              {cases.map((c: any) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{c.case_number}</p>
                          <StatusBadge status={c.status} />
                          {c.archived_at && <Badge variant="secondary">Archived</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {(c.customer as any)?.legal_name || 'No customer'} · {formatCompactINR(c.bill_amount)} · RM {(c.rm as any)?.full_name || '—'} · activity {relativeDays(c.updated_at)}
                        </p>
                      </div>
                      <ChevronRight size={15} className="text-muted-foreground shrink-0 group-hover:text-foreground" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-card rounded-lg border p-4">No matching cases.</p>
          )}
        </section>

        <section aria-label="Matching parties">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Building2 size={18} className="text-primary" aria-hidden="true" /> Parties ({parties?.length || 0})
          </h2>
          {parties && parties.length > 0 ? (
            <div className="space-y-2">
              {parties.map((p: any) => (
                <Link key={p.id} href={`/cases?party=${p.id}`} className="block group" title={`View all cases for ${p.legal_name}`}>
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{p.legal_name}</p>
                          <Badge variant={p.is_active ? 'success' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {p.customer_code || 'No code'} · {p.party_type} · {partyCaseCounts[p.id] || 0} case{(partyCaseCounts[p.id] || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ChevronRight size={15} className="text-muted-foreground shrink-0 group-hover:text-foreground" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
              <p className="text-tiny text-muted-foreground">Opening a party shows its cases, exposure and activity.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-card rounded-lg border p-4">No matching parties.</p>
          )}
        </section>
      </div>
    </div>
  );
}
