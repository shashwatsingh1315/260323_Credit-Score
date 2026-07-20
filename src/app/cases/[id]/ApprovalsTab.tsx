"use client";
import { use, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, ShieldQuestion, Clock } from 'lucide-react';
import { handleCreateApprovalRound, handleApprovalDecision, handleBoardVote } from './actions';
import { fetchSessionInfo } from '@/components/actions';
import { TermsLadder } from '@/components/creditflow/TermsLadder';
import { SubmitButton } from '@/components/ui/submit-button';
import { formatCompactINR, formatDateIST, daysUntil } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Decision tab — doctrine §12.6 (approval begins with a decision brief, not
 * action buttons) and §12.7 (board voting independence: voters never see
 * others' votes while the window is open).
 */

const DECISION_CONSEQUENCES: Record<string, string[]> = {
  approve: [
    'Your approval will be recorded with your name and timestamp.',
    'If all required approvers approve, the case moves to Approved and the RM is notified to negotiate with the customer.',
    'The credit days shown in this confirmation become governing terms only when the round fully approves.',
  ],
  reject: [
    'The case will immediately move to Rejected and the round will close.',
    'The RM will be notified and may appeal with new evidence.',
    'This decision is permanently audited.',
  ],
  return_for_revision: [
    'The case returns to In Review and the RM is notified.',
    'Your correction checklist becomes the required rework.',
    'The review SLA restarts when the RM resubmits.',
  ],
};

export default function ApprovalsTab({ coreData, promises, activeRole }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const { approvalRounds, boardRounds } = use(promises.approvalsPromise as Promise<any>);
  const tasksBundle = use(promises.tasksPromise as Promise<any>);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    fetchSessionInfo().then((s) => setCurrentUserId(s?.id ?? null)).catch(() => {});
  }, []);

  // Pending decision UX state
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [revisionItems, setRevisionItems] = useState<Record<string, boolean>>({});
  const [useFounderOverride, setUseFounderOverride] = useState(false);
  const [founderOverrideDays, setFounderOverrideDays] = useState('');
  const [founderOverrideReason, setFounderOverrideReason] = useState('');

  const openRound = approvalRounds.find((r: any) => r.status === 'open');
  const currentStageTasks = (tasksBundle?.tasks || []).filter((t: any) => t.stage === (openRound?.stage ?? cycle?.active_stage));
  const missingRequired = currentStageTasks.filter((t: any) => t.is_required && t.status !== 'Completed' && !t.is_waived);

  const tranches: any[] = Array.isArray(c.proposed_tranches) ? c.proposed_tranches : [];
  const exposure = c.customer_exposure;
  const history = c.customer_history;

  const selectedRevisionTasks = currentStageTasks.filter((t: any) => revisionItems[t.id]);
  const policyRecommendedDays = Number(coreData.founderOverride?.metadata?.policy_recommended_credit_days ?? cycle?.approved_credit_days);
  const founderOverrideDaysNumber = Number(founderOverrideDays);
  const founderOverrideIsValid = !useFounderOverride || (
    activeRole === 'founder_admin'
    && Number.isInteger(founderOverrideDaysNumber)
    && founderOverrideDaysNumber > policyRecommendedDays
    && founderOverrideReason.trim().length > 0
  );

  const composedComment = (() => {
    if (pendingDecision !== 'return_for_revision') return comment;
    const checklist = selectedRevisionTasks.map((t: any) => t.description);
    const parts = [];
    if (checklist.length > 0) parts.push(`Corrections required: ${checklist.join(' · ')}`);
    if (comment.trim()) parts.push(comment.trim());
    return parts.join('\n');
  })();

  const canSubmitDecision = pendingDecision === 'approve'
    ? founderOverrideIsValid
    : !!(pendingDecision && comment.trim().length > 0 && (pendingDecision !== 'return_for_revision' || selectedRevisionTasks.length > 0));

  return (
    <div className="space-y-4 mt-4">

      {/* Ambiguity banner — a modeled exception with an owner and path */}
      {cycle?.is_ambiguous && (
        <div className="rounded-lg border border-attention/40 bg-attention/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-attention" aria-hidden="true" />
            <h3 className="font-semibold text-sm text-attention">Ambiguous case — board review required</h3>
          </div>
          <p className="text-xs text-foreground/80">
            This case was force-readied with missing items, so an ordinary deterministic decision is not safe.
            A board round must be convened before a final decision.
          </p>
          {(activeRole === 'founder_admin' || activeRole === 'kam') && (
            <form action={handleCreateApprovalRound} className="mt-3">
              <input type="hidden" name="caseId" value={c.id} />
              <input type="hidden" name="cycleId" value={cycle.id} />
              <input type="hidden" name="stage" value={cycle.active_stage} />
              <input type="hidden" name="roundType" value="appeal" />
              <Button type="submit" size="sm" variant="outline" className="border-attention text-attention">
                Convene ambiguity board
              </Button>
            </form>
          )}
        </div>
      )}

      {/* ── Decision brief — one page to understand the whole decision ── */}
      {openRound && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              Decision brief
              <Badge variant="warning" className="text-xs">
                {openRound.round_type === 'appeal' ? 'Appeal' : openRound.round_type === 'ambiguity_board' ? 'Ambiguity board' : `Stage ${openRound.stage} approval`}
              </Badge>
              <span className="text-xs font-normal text-muted-foreground">
                opened {formatDateIST(openRound.created_at)} · waiting {daysUntil(openRound.created_at) !== null ? Math.abs(daysUntil(openRound.created_at)!) : 0}d
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TermsLadder
              layers={[
                {
                  layer: 'requested',
                  value: `${formatCompactINR(c.requested_exposure_amount || c.bill_amount)} exposure · ${c.composite_credit_days || 0} days`,
                  provenance: `Submitted by ${c.rm?.full_name || 'RM'} · ${formatDateIST(c.submitted_at || c.created_at)}`,
                  governing: false,
                },
                ...(cycle?.current_case_score != null || cycle?.approved_credit_days != null
                  ? [{
                      layer: 'recommended' as const,
                      value: `${Number.isFinite(policyRecommendedDays) ? policyRecommendedDays : '—'} days${cycle.current_case_score != null ? ` · score ${cycle.current_case_score}/100` : ''}${cycle.score_band_name ? ` · ${cycle.score_band_name}` : ''}`,
                      provenance: 'Policy engine output — not a human decision',
                      governing: false,
                    }]
                  : []),
                ...(cycle?.decision === 'approved' && cycle.approved_credit_days != null
                  ? [{
                      layer: 'approved' as const,
                      value: `${cycle.approved_credit_days} days`,
                      provenance: coreData.founderOverride
                        ? `Founder override by ${coreData.founderOverride.actor?.full_name || 'Founder Admin'} · ${formatDateIST(coreData.founderOverride.created_at)} · ${coreData.founderOverride.metadata?.override_reason || 'Reason recorded in audit'}`
                        : cycle.finalized_at ? `Finalized ${formatDateIST(cycle.finalized_at)}` : undefined,
                      governing: true,
                      attention: !!coreData.founderOverride,
                    }]
                  : []),
              ]}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {/* Proposed tranche schedule */}
              <div className="rounded-lg border border-border p-3">
                <p className="text-tiny font-semibold uppercase tracking-wider text-muted-foreground mb-2">Proposed repayment schedule</p>
                {tranches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tranches proposed.</p>
                ) : (
                  <ul className="space-y-1">
                    {tranches.map((t: any, i: number) => (
                      <li key={i} className="text-xs flex justify-between gap-2">
                        <span>Tranche {i + 1}</span>
                        <span className="tabular-nums font-medium">
                          {t.type === 'percentage' ? `${t.value}%` : formatCompactINR(t.value)} · {t.days_after_billing}d after billing
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Party exposure + history with provenance */}
              <div className="rounded-lg border border-border p-3">
                <p className="text-tiny font-semibold uppercase tracking-wider text-muted-foreground mb-2">Party track record</p>
                {exposure || history ? (
                  <ul className="space-y-1 text-xs">
                    {exposure && (
                      <li className="flex justify-between gap-2">
                        <span>Current outstanding</span>
                        <span className="tabular-nums font-medium">{formatCompactINR(exposure.outstanding_amount)}</span>
                      </li>
                    )}
                    {exposure && (
                      <li className="flex justify-between gap-2">
                        <span>Overdue amount</span>
                        <span className={cn('tabular-nums font-medium', exposure.overdue_amount > 0 && 'text-destructive')}>
                          {formatCompactINR(exposure.overdue_amount)}{exposure.overdue_days > 0 ? ` · ${exposure.overdue_days}d` : ''}
                        </span>
                      </li>
                    )}
                    {history && (
                      <li className="flex justify-between gap-2">
                        <span>History</span>
                        <span className="tabular-nums font-medium">
                          {history.order_count} orders · avg delay {Number(history.average_delay_days || 0).toFixed(0)}d
                        </span>
                      </li>
                    )}
                    <li className="text-tiny text-muted-foreground pt-1">
                      Imported data as of {formatDateIST((exposure || history)?.data_as_of)}
                    </li>
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No imported exposure or history for this party — absence of data is itself a risk signal.</p>
                )}
              </div>
            </div>

            {/* Critical missing inputs */}
            {missingRequired.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                <p className="text-xs font-semibold text-warning mb-1.5">
                  {missingRequired.length} required input{missingRequired.length !== 1 ? 's' : ''} still missing
                </p>
                <ul className="text-xs space-y-1 list-disc pl-4 text-foreground/80">
                  {missingRequired.map((t: any) => <li key={t.id}>{t.description}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Rounds ── */}
      {approvalRounds.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm space-y-1">
            <ShieldQuestion size={28} className="mx-auto opacity-40" aria-hidden="true" />
            <p className="font-medium text-foreground">No decision rounds yet</p>
            <p>Complete the required stage tasks in the Work tab, then submit the stage. The decision brief will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvalRounds.map((round: any) => {
            const boardRound = boardRounds?.find((br: any) => br.approval_round_id === round.id);
            const canDecide = ['ordinary_approver', 'board_member', 'founder_admin'].includes(activeRole);
            const canBoardVote = ['board_member', 'founder_admin'].includes(activeRole);
            const isOpen = round.status === 'open';

            return (
              <Card key={round.id} className={cn(isOpen && 'border-primary/30')}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">
                      Round #{round.round_number || 1} — Stage {round.stage}
                      <Badge variant="secondary" className="ml-2 text-xs capitalize">
                        {round.round_type?.replace('_', ' ')}
                      </Badge>
                    </CardTitle>
                    <Badge variant={
                      round.status === 'approved' ? 'success' :
                      round.status === 'rejected' ? 'destructive' :
                      round.status === 'open' ? 'warning' : 'secondary'
                    }>
                      {round.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Recorded decisions */}
                  {round.decisions?.map((d: any) => (
                    <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium">{d.approver?.full_name || 'Unknown'}</span>
                          <Badge variant={d.decision === 'approve' ? 'success' : d.decision === 'reject' ? 'destructive' : 'warning'} className="text-xs capitalize">
                            {d.decision?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        {d.comment && <p className="text-sm text-muted-foreground whitespace-pre-line">{d.comment}</p>}
                      </div>
                    </div>
                  ))}

                  {/* ── Structured decision form with consequence preview ── */}
                  {isOpen && round.round_type !== 'ambiguity_board' && canDecide && (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your decision</p>

                      <div className="space-y-1.5">
                        <label htmlFor={`comment-${round.id}`} className="text-xs text-muted-foreground">
                          Rationale {pendingDecision !== 'approve' && <span className="text-destructive">(required for reject / return)</span>}
                        </label>
                        <Textarea
                          id={`comment-${round.id}`}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="State the business reasoning behind your decision…"
                          rows={2}
                        />
                      </div>

                      {/* Return for revision → explicit correction checklist */}
                      {pendingDecision === 'return_for_revision' && (
                        <fieldset className="rounded-lg border border-border p-3 space-y-2">
                          <legend className="text-xs font-semibold px-1">Corrections required — the RM receives this checklist</legend>
                          {currentStageTasks.length === 0 && (
                            <p className="text-xs text-muted-foreground">No stage tasks to reference — describe the correction above.</p>
                          )}
                          {currentStageTasks.map((t: any) => (
                            <label key={t.id} className="flex items-start gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={!!revisionItems[t.id]}
                                onChange={(e) => setRevisionItems((prev) => ({ ...prev, [t.id]: e.target.checked }))}
                              />
                              <span>{t.description}</span>
                            </label>
                          ))}
                        </fieldset>
                      )}

                      {/* Step 1: choose decision · Step 2: preview consequence and confirm */}
                      {!pendingDecision ? (
                        <div className="flex gap-2 flex-wrap">
                          <Button onClick={() => setPendingDecision('approve')} className="bg-success hover:bg-success/90 text-success-foreground">
                            <CheckCircle2 size={15} className="mr-1.5" aria-hidden="true" /> Approve terms
                          </Button>
                          <Button onClick={() => setPendingDecision('reject')} variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10">
                            Reject
                          </Button>
                          <Button onClick={() => setPendingDecision('return_for_revision')} variant="outline">
                            Return for revision
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Confirm: {pendingDecision.replace(/_/g, ' ')}
                          </p>
                          <ul className="text-sm space-y-1 list-disc pl-4 text-foreground/90">
                            {DECISION_CONSEQUENCES[pendingDecision].map((x, i) => <li key={i}>{x}</li>)}
                            {useFounderOverride && (
                              <li className="text-attention-strong">Founder override: {founderOverrideDays || '—'} days will replace the {policyRecommendedDays}-day policy recommendation.</li>
                            )}
                          </ul>

                          {pendingDecision === 'approve' && activeRole === 'founder_admin' && Number.isFinite(policyRecommendedDays) && (
                            <fieldset className="rounded-lg border border-attention/40 bg-attention/5 p-3 space-y-3">
                              <label className="flex items-start gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={useFounderOverride}
                                  onChange={(e) => setUseFounderOverride(e.target.checked)}
                                />
                                <span>
                                  <span className="font-medium">Approve higher credit days</span>
                                  <span className="block text-xs text-muted-foreground">Founder Admin exception above the system recommendation of {policyRecommendedDays} days.</span>
                                </span>
                              </label>
                              {useFounderOverride && (
                                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                                  <div className="space-y-1.5">
                                    <label htmlFor={`override-days-${round.id}`} className="text-xs font-medium">Approved credit days *</label>
                                    <Input
                                      id={`override-days-${round.id}`}
                                      type="number"
                                      min={policyRecommendedDays + 1}
                                      step="1"
                                      value={founderOverrideDays}
                                      onChange={(e) => setFounderOverrideDays(e.target.value)}
                                      placeholder={`>${policyRecommendedDays}`}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label htmlFor={`override-reason-${round.id}`} className="text-xs font-medium">Override rationale *</label>
                                    <Textarea
                                      id={`override-reason-${round.id}`}
                                      value={founderOverrideReason}
                                      onChange={(e) => setFounderOverrideReason(e.target.value)}
                                      placeholder="Why should this case receive more credit days than policy recommends?"
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              )}
                            </fieldset>
                          )}

                          <form action={handleApprovalDecision} className="flex gap-2 flex-wrap">
                            <input type="hidden" name="roundId" value={round.id} />
                            <input type="hidden" name="caseId" value={c.id} />
                            <input type="hidden" name="comment" value={composedComment} />
                            {useFounderOverride && pendingDecision === 'approve' && activeRole === 'founder_admin' && (
                              <>
                                <input type="hidden" name="overrideCreditDays" value={founderOverrideDays} />
                                <input type="hidden" name="overrideReason" value={founderOverrideReason} />
                              </>
                            )}
                            <SubmitButton
                              type="submit"
                              name="decision"
                              value={pendingDecision}
                              disabled={!canSubmitDecision}
                              className={pendingDecision === 'approve' ? 'bg-success hover:bg-success/90 text-success-foreground' : pendingDecision === 'reject' ? 'border-destructive text-destructive hover:bg-destructive/10' : ''}
                              variant={pendingDecision === 'approve' ? 'default' : 'outline'}
                            >
                              Confirm {pendingDecision.replace(/_/g, ' ')}
                            </SubmitButton>
                            <Button type="button" variant="ghost" onClick={() => { setPendingDecision(null); setUseFounderOverride(false); setFounderOverrideDays(''); setFounderOverrideReason(''); }}>
                              Back
                            </Button>
                          </form>
                          {!canSubmitDecision && pendingDecision !== 'approve' && (
                            <p className="text-xs text-destructive">
                              {pendingDecision === 'return_for_revision' && selectedRevisionTasks.length === 0
                                ? 'Select at least one correction item or pick a different decision.'
                                : 'A written rationale is required for this decision.'}
                            </p>
                          )}
                          {!canSubmitDecision && pendingDecision === 'approve' && useFounderOverride && (
                            <p className="text-xs text-destructive">Enter whole credit days above {policyRecommendedDays} and provide the override rationale.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Board voting — independence preserved while open ── */}
                  {round.round_type === 'ambiguity_board' && boardRound && (
                    <BoardSection
                      boardRound={boardRound}
                      caseId={c.id}
                      canBoardVote={canBoardVote}
                      currentUserId={currentUserId}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoardSection({ boardRound, caseId, canBoardVote, currentUserId }: any) {
  const rosterSize = Array.isArray(boardRound.roster_snapshot) ? boardRound.roster_snapshot.length : null;
  const votes = boardRound.votes || [];
  const isOpen = boardRound.status === 'open';
  const myVote = currentUserId ? votes.find((v: any) => v.voter?.id === currentUserId || v.voter_id === currentUserId) : null;
  const until = daysUntil(boardRound.vote_window_end);

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Board ballot</p>
        <Badge variant={boardRound.status === 'closed' ? 'success' : 'warning'} className="text-xs">
          {boardRound.status} · window {until !== null && until >= 0 ? `closes ${until === 0 ? 'today' : `in ${until}d`}` : `closed ${formatDateIST(boardRound.vote_window_end)}`}
        </Badge>
      </div>

      {isOpen ? (
        /* While voting is open: participation status only — never individual
           votes, so members decide independently (§12.7, §17.5). */
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <p className="text-sm flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" aria-hidden="true" />
            {votes.length} of {rosterSize ?? '…'} board members have voted
          </p>
          <p className="text-xs text-muted-foreground">
            Individual votes stay hidden until the window closes. Your vote is private and {myVote ? 'has been recorded' : 'not yet cast'}.
          </p>
          {myVote && (
            <p className="text-xs">
              Your vote: <Badge variant="secondary" className="text-xs capitalize ml-1">{myVote.decision}</Badge>
            </p>
          )}
        </div>
      ) : (
        /* After closure: the permitted vote record and the computed outcome. */
        <div className="space-y-2">
          {votes.map((v: any) => (
            <div key={v.id} className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-medium">{v.voter?.full_name}</span>
              <Badge variant={v.decision === 'approve' ? 'success' : v.decision === 'reject' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                {v.decision}
              </Badge>
              {v.comment && <span className="text-muted-foreground text-xs">— {v.comment}</span>}
            </div>
          ))}
          {boardRound.board_decision && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-semibold capitalize">Outcome: {boardRound.board_decision}</p>
              {boardRound.board_decision === 'override' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Override terms: {boardRound.override_credit_days} days
                  {boardRound.override_reason_code && ` · reason ${boardRound.override_reason_code}`}
                  {boardRound.override_explanation && ` — ${boardRound.override_explanation}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {isOpen && canBoardVote && !myVote && (
        <form action={handleBoardVote} className="space-y-2 border-t border-border pt-2">
          <input type="hidden" name="boardRoundId" value={boardRound.id} />
          <input type="hidden" name="caseId" value={caseId} />
          <label htmlFor={`vote-comment-${boardRound.id}`} className="text-xs text-muted-foreground">
            Vote rationale (preserved, revealed after the window closes)
          </label>
          <Textarea id={`vote-comment-${boardRound.id}`} name="comment" rows={2} placeholder="Why are you voting this way?" />
          <div className="flex gap-2 flex-wrap">
            <SubmitButton type="submit" name="decision" value="approve" size="sm" className="bg-success hover:bg-success/90 text-success-foreground">Vote approve</SubmitButton>
            <SubmitButton type="submit" name="decision" value="reject" size="sm" variant="outline" className="border-destructive/50 text-destructive">Vote reject</SubmitButton>
            <SubmitButton type="submit" name="decision" value="abstain" size="sm" variant="ghost">Abstain</SubmitButton>
          </div>
        </form>
      )}
      {isOpen && canBoardVote && myVote && (
        <p className="text-xs text-muted-foreground border-t border-border pt-2">
          Your ballot is recorded. Contact the founder if you need to revise it before the window closes.
        </p>
      )}
    </div>
  );
}
