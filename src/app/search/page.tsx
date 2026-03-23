import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Briefcase, Building2, Search as SearchIcon } from 'lucide-react';

export default async function SearchResultsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <SearchIcon size={48} className="mb-4 opacity-20" />
        <p>Enter a search query in the top bar to find cases and parties.</p>
      </div>
    );
  }

  const supabase = await createClient();

  const [
    { data: cases },
    { data: parties }
  ] = await Promise.all([
    supabase.from('credit_cases')
      .select('id, case_number, status, case_scenario, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .ilike('case_number', `%${q}%`)
      .limit(10),
    supabase.from('parties')
      .select('id, legal_name, customer_code, party_type, is_active')
      .ilike('legal_name', `%${q}%`)
      .limit(10)
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search Results</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Showing results for <strong>"{q}"</strong></p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Briefcase size={18} className="text-primary" /> Cases ({cases?.length || 0})
          </h2>
          {cases && cases.length > 0 ? (
            <div className="space-y-3">
              {cases.map((c: any) => (
                <Link key={c.id} href={`/cases/${c.id}`}>
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{c.case_number}</p>
                        <p className="text-xs text-muted-foreground">{(c.customer as any)?.legal_name || 'No customer'} · {c.case_scenario?.replace(/_/g, ' ')}</p>
                      </div>
                      <Badge variant="secondary">{c.status}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-card rounded-lg border p-4">No matching cases.</p>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Building2 size={18} className="text-primary" /> Parties ({parties?.length || 0})
          </h2>
          {parties && parties.length > 0 ? (
            <div className="space-y-3">
              {parties.map((p: any) => (
                <Card key={p.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.legal_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.customer_code} · {p.party_type}</p>
                    </div>
                    <Badge variant={p.is_active ? 'success' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-card rounded-lg border p-4">No matching parties.</p>
          )}
        </div>
      </div>
    </div>
  );
}
