"use client";
import { useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { handleChangePersona, handleSelectiveUnlock, handleCounterOffer } from './actions';

export default function OverviewTab({ coreData, promises, activeRole, liveScore, showCounterOffer, setShowCounterOffer, showUnlock, setShowUnlock, showPersonaChange, setShowPersonaChange }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const { auditEvents } = use(promises.auditPromise as Promise<any>);
  const data = { auditEvents };
  const isApproved = c.status === 'Approved';

  return (
    <div className="space-y-4 mt-6">

          {showPersonaChange && cycle && (
            <Card className="mb-4 bg-muted/20 border-border print:hidden">
              <CardContent className="p-4">
                <form action={handleChangePersona} className="space-y-3" onSubmit={() => setShowPersonaChange(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle.id} />
                  <h3 className="font-semibold text-sm">Change Personas & Dominance</h3>
                  <p className="text-xs text-muted-foreground mb-2">Update the evaluation models for this active cycle. Changes affect live scoring.</p>

                  <div className="flex gap-2 mb-2">
                    <Input name="customerPersonaId" placeholder="Customer Persona ID" defaultValue={cycle.customer_persona_id || ''} className="h-9 w-[200px]" />
                    <Input name="contractorPersonaId" placeholder="Contractor Persona ID" defaultValue={cycle.contractor_persona_id || ''} className="h-9 w-[200px]" />
                    <Input name="dominanceCategoryId" placeholder="Dominance Category ID" defaultValue={cycle.dominance_category_id || ''} className="h-9 flex-1" />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="default">Update Configuration</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowPersonaChange(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showUnlock && (
            <Card className="mb-4 bg-muted/20 border-warning print:hidden">
              <CardContent className="p-4">
                <form action={handleSelectiveUnlock} className="space-y-3" onSubmit={() => setShowUnlock(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <h3 className="font-semibold text-sm">Selective Unlock</h3>
                  <p className="text-xs text-muted-foreground mb-2">Unlocking a section allows editing but requires a manual re-review if changes are material.</p>
                  <div className="flex gap-2 mb-2">
                    <select name="section" className="flex h-9 w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
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

          {showCounterOffer && isApproved && (
            <Card className="mb-4 bg-card border-border print:hidden">
              <CardContent className="p-4">
                <form action={handleCounterOffer} className="space-y-3" onSubmit={() => setShowCounterOffer(false)}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle?.id} />
                  <h3 className="font-semibold text-sm text-foreground">Counter-Offer / Negotiate Terms</h3>
                  <p className="text-xs text-muted-foreground mb-2">Approved Limit: <strong className="font-bold">{cycle?.approved_credit_days} days</strong>. You may restructure tranches to fit within this limit without requiring a new review.</p>

                  <div className="flex items-center gap-2 mb-2">
                    <Input type="number" name="compositeDays" placeholder="New Composite Days" className="h-9 w-[200px]" required max={cycle?.approved_credit_days} />
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

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Commercial Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Bill Amount', value: `₹${(c.bill_amount || 0).toLocaleString('en-IN')}` },
                  { label: 'Requested Exposure', value: `₹${(c.requested_exposure_amount || 0).toLocaleString('en-IN')}` },
                  { label: 'Composite Days', value: `${c.composite_credit_days || 0} days` },
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
                <CardContent className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Current Stage', value: `Stage ${cycle.active_stage}` },
                    { label: 'Case Score', value: cycle.current_case_score ?? liveScore ?? '—' },
                    { label: 'Approved Days', value: cycle.approved_credit_days ? `${cycle.approved_credit_days}d` : '—' },
                    { label: 'Status', value: cycle.is_ambiguous ? 'Ambiguous ⚠' : 'Normal' },
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
                <Card className="col-span-2 border-primary/20">
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

            <Card className="col-span-2 border-border">
              <CardHeader className="pb-3 border-b border-border/50"><CardTitle className="text-base text-foreground">Party History & Exposure</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 pt-4">
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
                        <span className={c.customer_exposure.overdue_amount > 0 ? "text-destructive font-bold" : "font-semibold"}>₹{(c.customer_exposure.overdue_amount || 0).toLocaleString('en-IN')} ({c.customer_exposure.overdue_days} days)</span>
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
                    <p className="text-sm text-muted-foreground italic">No historical exposure found.</p>
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
                          <span className={c.contractor_exposure.overdue_amount > 0 ? "text-destructive font-bold" : "font-semibold"}>₹{(c.contractor_exposure.overdue_amount || 0).toLocaleString('en-IN')} ({c.contractor_exposure.overdue_days} days)</span>
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
