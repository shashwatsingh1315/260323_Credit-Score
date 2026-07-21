"use client";
import { use, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TrendingUp } from 'lucide-react';
import { handleChangePersona, handleSelectiveUnlock, handleCounterOffer } from './actions';
import { adjustedOverdueDays, formatDataFreshness } from '@/utils/dateHelpers';
import { TermsLadder } from '@/components/creditflow/TermsLadder';
import { daysUntil, formatCompactINR, formatDateIST } from '@/lib/format';

export default function OverviewTab({ coreData, promises, activeRole, liveScore, showCounterOffer, setShowCounterOffer, showUnlock, setShowUnlock, showPersonaChange, setShowPersonaChange }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const { auditEvents } = use(promises.auditPromise as Promise<any>);
  const data = { auditEvents };
  const isApproved = c.status === 'Approved';
  const [personaReceipt, setPersonaReceipt] = useState(false);

  // Layers of truth (doctrine Principle 4): requested / recommended / approved
  // / accepted / realized are never collapsed into one mutable value.
  const isApprovedPlus = ['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status);
  const isAcceptedPlus = ['Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status);
  const validityDaysLeft = daysUntil(cycle?.validity_expires_at);
  const validityProvenance = cycle?.validity_expires_at
    ? validityDaysLeft != null && validityDaysLeft < 0
      ? `Expired ${Math.abs(validityDaysLeft)} day${Math.abs(validityDaysLeft) === 1 ? '' : 's'} ago — consider re-approval`
      : `Valid until ${formatDateIST(cycle.validity_expires_at)} (${validityDaysLeft} day${validityDaysLeft === 1 ? '' : 's'} left)`
    : null;
  const termsLayers = [
    {
      layer: 'requested' as const,
      value: `${formatCompactINR(c.requested_exposure_amount || c.bill_amount)} exposure · ${c.composite_credit_days || 0} days`,
      provenance: `Submitted by ${c.rm?.full_name || 'RM'} · ${formatDateIST(c.submitted_at || c.created_at)}`,
      governing: !cycle && !isApprovedPlus,
    },
    ...(cycle?.approved_credit_days != null ? [{
      layer: (isApprovedPlus ? 'approved' : 'recommended') as 'approved' | 'recommended',
      value: `${cycle.approved_credit_days} days`,
      provenance: isApprovedPlus
        ? validityProvenance || `Authorized through the approval process${cycle.finalized_at ? ` · ${formatDateIST(cycle.finalized_at)}` : ''}`
        : `Policy engine output${cycle.score_band_name ? ` · band ${cycle.score_band_name}` : ''} — awaiting decision`,
      governing: isApprovedPlus && !isAcceptedPlus,
      attention: validityDaysLeft != null && validityDaysLeft < 0,
    }] : []),
    ...(isAcceptedPlus && c.final_composite_credit_days != null ? [{
      layer: 'accepted' as const,
      value: `${c.final_composite_credit_days} days${Array.isArray(c.final_accepted_tranches) ? ` · ${c.final_accepted_tranches.length} tranches` : ''}`,
      provenance: 'Accepted by the customer in negotiation',
      governing: isAcceptedPlus,
    }] : []),
    ...(c.actual_bill_amount != null && ['Billing Active', 'Pending Write-Off Approval', 'Closed'].includes(c.status) ? [{
      layer: 'realized' as const,
      value: `${formatCompactINR(c.actual_bill_amount)} collected${c.promised_bill_amount != null ? ` of ${formatCompactINR(c.promised_bill_amount)} promised` : ''}`,
      provenance: 'Billing record',
      governing: false,
    }] : []),
  ];

  return (
    <div className="space-y-4 mt-6">

          {showPersonaChange && cycle && (
            <Card className="mb-4 bg-muted/20 border-border print:hidden">
              <CardContent className="p-4">
                <form action={async (formData) => { await handleChangePersona(formData); setShowPersonaChange(false); setPersonaReceipt(true); }} className="space-y-3">
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle.id} />
                  <h3 className="font-semibold text-sm">Change Personas & Dominance</h3>
                  <p className="text-xs text-muted-foreground mb-2">The case rescored immediately. “Default (no persona)” uses each parameter&apos;s default weight.</p>

                  <div className="flex flex-wrap gap-2 mb-2">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Customer persona
                      <select name="customerPersonaId" defaultValue={cycle.customer_persona_id || ''} className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                        <option value="">Default (no persona)</option>
                        {(coreData.policyOptions?.personas || []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Contractor persona
                      <select name="contractorPersonaId" defaultValue={cycle.contractor_persona_id || ''} className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                        <option value="">Default (no persona)</option>
                        {(coreData.policyOptions?.personas || []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Dominance model
                      <select name="dominanceCategoryId" defaultValue={cycle.dominance_category_id || ''} className="flex h-9 w-56 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                        <option value="">Scenario default</option>
                        {(coreData.policyOptions?.dominanceCategories || []).map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.combination_method})</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="default">Update Configuration</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowPersonaChange(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {personaReceipt && (
            <p role="status" className="mb-4 rounded-md border border-success/25 bg-success/10 px-3 py-2 text-sm text-success-strong">
              Personas updated. The case has been rescored and the score and band shown here now reflect the new configuration.
            </p>
          )}

          {cycle?.is_active && showUnlock && (
            <Card className="mb-4 bg-muted/20 border-warning print:hidden">
              <CardContent className="p-4">
                <form action={handleSelectiveUnlock} className="space-y-3" onSubmit={() => setShowUnlock(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <h3 className="font-semibold text-sm">Selective Unlock</h3>
                  <p className="text-xs text-muted-foreground mb-2">Unlocking a section allows editing but requires a manual re-review if changes are material.</p>
                  <div className="flex gap-2 mb-2">
                    <select name="section" className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                      <option value="commercial">Commercial Section</option>
                      <option value="parties">Parties</option>
                      <option value="history">History Classification</option>
                    </select>
                    <Input name="reason" placeholder="Reason for unlock" className="h-9 flex-1" required />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="default">Unlock Section</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowUnlock(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {cycle?.is_active && showCounterOffer && isApproved && (
            <Card className="mb-4 bg-card border-border print:hidden">
              <CardContent className="p-4">
                <form action={handleCounterOffer} className="space-y-3" onSubmit={() => setShowCounterOffer(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle?.id} />
                  <h3 className="font-semibold text-sm text-foreground">Counter-Offer / Negotiate Terms</h3>
                  <p className="text-xs text-muted-foreground mb-2">Approved Limit: <strong className="font-bold">{cycle?.approved_credit_days} days</strong>. You may restructure tranches to fit within this limit without requiring a new review.</p>

                  <div className="flex items-center gap-2 mb-2">
                    <Input type="number" name="compositeDays" placeholder="New Composite Days" className="h-9 w-48" required max={cycle?.approved_credit_days} />
                    <span className="text-xs text-muted-foreground">(Must be ≤ {cycle?.approved_credit_days})</span>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" name="outcome" value="accepted" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">Accept New Terms</Button>
                    <Button type="submit" name="outcome" value="dropped" size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">Customer Declined</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowCounterOffer(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <TermsLadder layers={termsLayers} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Commercial Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Bill Amount', value: `₹${(c.bill_amount || 0).toLocaleString('en-IN')}` },
                  { label: 'Requested Exposure', value: `₹${(c.requested_exposure_amount || 0).toLocaleString('en-IN')}` },
                  { label: 'Requested terms (composite days)', value: `${c.composite_credit_days || 0} days` },
                  { label: 'Branch', value: c.branch?.name || '—' },
                ].map(d => (
                  <div key={d.label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
                    <p className="font-semibold">{d.value}</p>
                  </div>
                ))}
                {c.proposed_tranches && c.proposed_tranches.length > 0 && (
                  <div className="col-span-2">
                    <Separator className="my-3" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tranches</p>
                    <div className="space-y-1">
                      {c.proposed_tranches.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{t.type}</span>
                          <span>{t.type === 'percentage' ? `${t.value}%` : `₹${t.value?.toLocaleString('en-IN')}`}</span>
                          <span className="text-muted-foreground">{t.days_after_billing}d after billing</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">People</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  { label: 'RM', value: c.rm?.full_name || '—' },
                  { label: 'KAM', value: c.kam?.full_name || 'Unassigned' },
                  { label: 'Customer', value: c.customer?.legal_name || '—' },
                  { label: 'Contractor', value: c.contractor?.legal_name || '—' },
                ].map(d => (
                  <div key={d.label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
                    <p className="font-semibold">{d.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {cycle && (
              <Card className="col-span-2">
                <CardHeader className="pb-3"><CardTitle className="text-base">Review Cycle #{cycle.cycle_number}</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Current Stage', value: `Stage ${cycle.active_stage} of 3` },
                    { label: 'Policy score (0–100, higher is safer)', value: cycle.current_case_score ?? liveScore ?? 'Not computed' },
                    {
                      label: isApprovedPlus ? 'Approved terms' : 'Policy recommendation',
                      value: cycle.approved_credit_days ? `${cycle.approved_credit_days} days` : 'Not yet decided',
                    },
                    { label: 'Decision state', value: cycle.is_ambiguous ? 'Ambiguous — board review' : (cycle.decision ? cycle.decision.replace(/_/g, ' ') : 'In progress') },
                  ].map(d => (
                    <div key={d.label}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
                      <p className="font-semibold">{d.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Relaxation / Negotiation History */}
            {(activeRole === 'rm' || activeRole === 'founder_admin') && (() => {
              const relaxationEvents = data.auditEvents.filter((e: any) =>
                e.event_type === 'counter_offer_accepted' ||
                e.event_type === 'counter_offer_dropped' ||
                e.event_type === 'tranches_restructured'
              );
              if (!relaxationEvents.length) return null;
              return (
                <Card className="col-span-1 lg:col-span-2 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp size={15} className="text-primary" />
                      Relaxation / Negotiation History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {relaxationEvents.map((e: any) => (
                        <div key={e.id} className="flex items-start justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                          <div>
                            <p className="font-medium capitalize">{e.event_type.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 ml-4">
                            {new Date(e.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card className="col-span-1 lg:col-span-2 border-border">
              <CardHeader className="pb-3 border-b border-border/50"><CardTitle className="text-base text-foreground">Party History & Exposure</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div>
                  <h4 className="text-sm font-semibold mb-3 border-b pb-1">Customer: {c.customer?.legal_name || 'N/A'}</h4>
                  {c.customer_exposure ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outstanding</span>
                        <span className="font-semibold">₹{(c.customer_exposure.outstanding_amount || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Overdue</span>
                        <span className={c.customer_exposure.overdue_amount > 0 ? "text-destructive font-bold" : "font-semibold"}>
                          ₹{(c.customer_exposure.overdue_amount || 0).toLocaleString('en-IN')} (
                          <span title={`Import date: ${formatDataFreshness(c.customer_exposure.data_as_of)}`}>
                            {adjustedOverdueDays(c.customer_exposure.overdue_days, c.customer_exposure.data_as_of)} days overdue
                            <span className="text-xs text-muted-foreground ml-1">(as of {formatDataFreshness(c.customer_exposure.data_as_of)})</span>
                          </span>
                          )
                        </span>
                      </div>
                      {c.customer_history && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Orders</span>
                            <span className="font-semibold">{c.customer_history.order_count || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Avg Delay</span>
                            <span className="font-semibold">{c.customer_history.average_delay_days || 0} days</span>
                          </div>
                        </>
                      )}
                      <p className="text-tiny text-muted-foreground pt-1">Data as of: {new Date(c.customer_exposure.data_as_of).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No imported exposure for this party — absence of data is itself a risk signal.</p>
                  )}
                </div>

                {c.contractor && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 border-b pb-1">Contractor: {c.contractor.legal_name}</h4>
                    {c.contractor_exposure ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Outstanding</span>
                          <span className="font-semibold">₹{(c.contractor_exposure.outstanding_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Overdue</span>
                          <span className={c.contractor_exposure.overdue_amount > 0 ? "text-destructive font-bold" : "font-semibold"}>
                            ₹{(c.contractor_exposure.overdue_amount || 0).toLocaleString('en-IN')} (
                            <span title={`Import date: ${formatDataFreshness(c.contractor_exposure.data_as_of)}`}>
                              {adjustedOverdueDays(c.contractor_exposure.overdue_days, c.contractor_exposure.data_as_of)} days overdue
                              <span className="text-xs text-muted-foreground ml-1">(as of {formatDataFreshness(c.contractor_exposure.data_as_of)})</span>
                            </span>
                            )
                          </span>
                        </div>
                        {c.contractor_history && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Orders</span>
                              <span className="font-semibold">{c.contractor_history.order_count || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Avg Delay</span>
                              <span className="font-semibold">{c.contractor_history.average_delay_days || 0} days</span>
                            </div>
                          </>
                        )}
                        <p className="text-tiny text-muted-foreground pt-1">Data as of: {new Date(c.contractor_exposure.data_as_of).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No historical exposure found.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Realized Outcome — superseded by Ledger & Billing tab */}

          </div>

    </div>
  );
}
