"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, CheckSquare, XSquare, MinusSquare, Gavel, Scale, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { submitBoardVote, finalizeBoardDecision } from './actions';
import { fetchSessionInfo } from '@/components/actions';
import { formatDateTimeIST } from '@/lib/format';

/**
 * Board portal — doctrine §12.7: independence and governance.
 * While voting is open, members see participation status only — never how
 * others voted. After closure, the vote record and outcome are revealed.
 * The final outcome is linked to the tally; a conflicting choice is an
 * explicit, governed override.
 */
export default function BoardClient({ data }: { data: any }) {
  const { caseData, approvalRound, boardRound, votes, rosterMembers } = data;
  const [override, setOverride] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionInfo().then((s) => setCurrentUserId(s?.id ?? null)).catch(() => {});
  }, []);

  if (!boardRound) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-destructive">Board Review Not Found</h2>
        <p className="text-muted-foreground">This case does not have an active board review round.</p>
        <Link href={`/cases/${caseData?.id}`} passHref>
          <Button variant="outline">Return to Case</Button>
        </Link>
      </div>
    );
  }

  // Voting stats
  const approvals = votes.filter((v: any) => v.decision === 'approve').length;
  const rejections = votes.filter((v: any) => v.decision === 'reject').length;
  const abstains = votes.filter((v: any) => v.decision === 'abstain').length;
  const totalVotesCast = approvals + rejections + abstains;
  const isClosed = boardRound?.status === 'closed';

  const windowEnd = new Date(boardRound.vote_window_end);
  const isExpired = windowEnd < new Date();

  const rosterCount = rosterMembers.length || 1;
  const approvalPct = (approvals / rosterCount) * 100;
  const rejectionPct = (rejections / rosterCount) * 100;
  const abstainPct = (abstains / rosterCount) * 100;

  const myVote = currentUserId ? votes.find((v: any) => v.voter_id === currentUserId) : null;

  // Tally-derived expected outcome — finalizing against it is a governed override.
  const tallyOutcome = approvals > rejections ? 'uphold' : rejections > approvals ? 'reject' : 'tie';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 px-3 sm:px-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/cases" className="hover:text-foreground transition-colors">Cases</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href={`/cases/${caseData.id}`} className="hover:text-foreground transition-colors">{caseData.case_number}</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="text-foreground font-medium">Board Portal</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale size={24} className="text-brand" aria-hidden="true" />
            {approvalRound?.round_type === 'appeal' ? 'Committee Appeal Review' : 'Committee Ambiguity Review'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {approvalRound?.round_type === 'appeal'
              ? 'This case is under governed reconsideration after an appeal.'
              : `Policy ambiguity requires a ${rosterCount}-member board decision.`}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <Badge variant={isClosed ? "secondary" : "default"} className="text-sm py-1 px-3">
            {isClosed ? 'Voting Closed' : 'Voting Open'}
          </Badge>
          {!isClosed && (
            <span className={`text-xs mt-1 ${isExpired ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
              Window {isExpired ? 'expired' : 'closes'}: {formatDateTimeIST(windowEnd)}
            </span>
          )}
        </div>
      </div>

      {/* Decision packet stays one click away — voters should not lose context */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-foreground/85">
          Review the frozen decision packet (terms, scores, evidence) before voting.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/cases/${caseData.id}`} target="_blank">
            Open decision packet <ExternalLink size={13} className="ml-1.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Committee Roster ({rosterCount})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {rosterMembers.map((member: any) => {
                const vote = votes.find((v: any) => v.voter_id === member.id);
                const isMine = currentUserId === member.id;
                return (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {member.full_name}{isMine && <span className="text-muted-foreground"> (you)</span>}
                      </p>
                    </div>
                    {isClosed ? (
                      vote ? (
                        <Badge
                          variant={vote.decision === 'approve' ? 'success' : vote.decision === 'reject' ? 'destructive' : 'secondary'}
                          className="text-tiny capitalize"
                        >
                          {vote.decision}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-tiny">No vote</Badge>
                      )
                    ) : (
                      /* While open: participation only — votes stay private (§17.5). */
                      vote ? (
                        <Badge variant="secondary" className="text-tiny">
                          {isMine ? `You voted: ${vote.decision}` : 'Voted'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-tiny">Pending</Badge>
                      )
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{isClosed ? 'Final Tally' : 'Participation'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isClosed ? (
                <>
                  <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex" role="img" aria-label={`${approvals} approve, ${rejections} reject, ${abstains} abstain`}>
                    <div style={{ width: `${approvalPct}%` }} className="bg-success" />
                    <div style={{ width: `${rejectionPct}%` }} className="bg-destructive" />
                    <div style={{ width: `${abstainPct}%` }} className="bg-muted-foreground/40" />
                  </div>
                  <div className="flex justify-between text-tiny font-bold mt-1">
                    <div className="text-success">{approvals} approve</div>
                    <div className="text-destructive">{rejections} reject</div>
                    <div className="text-muted-foreground">{abstains} abstain</div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <span className="text-2xl font-bold text-foreground tabular-nums">{totalVotesCast}</span>
                  <span className="text-muted-foreground"> of {rosterCount} members have voted.</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
                Decision rule: the majority of votes cast guides the outcome. The founder finalizes the result; a decision that conflicts with the tally is recorded as a governed override. Ties escalate to the founder.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 lg:col-span-2 space-y-6">

          {/* Casting Vote Section */}
          {!isClosed && (
            <Card className="border-brand/20 shadow-sm">
              <CardHeader className="bg-brand/5 pb-4">
                <CardTitle className="text-lg text-brand">
                  {myVote ? 'Revise Your Vote' : 'Cast Your Vote'}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Your vote is private until the window closes{myVote ? ' — you may change it until then.' : '.'}
                  {myVote && (
                    <span className="block mt-1">
                      Current vote: <Badge variant="secondary" className="capitalize text-tiny">{myVote.decision}</Badge>
                    </span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <form action={submitBoardVote} className="space-y-4">
                  <input type="hidden" name="caseId" value={caseData.id} />
                  <input type="hidden" name="boardRoundId" value={boardRound.id} />

                  <div className="space-y-2">
                    <Label htmlFor="vote-rationale">Rationale / Memo (preserved, revealed after closure)</Label>
                    <Textarea id="vote-rationale" name="comment" rows={3} required placeholder="Detail the reasoning for your decision based on the decision packet…" defaultValue={myVote?.comment ?? ''} />
                  </div>

                  <div className="flex gap-3 pt-2 flex-col sm:flex-row">
                    <Button type="submit" name="decision" value="approve" className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
                      <CheckSquare size={16} className="mr-2" aria-hidden="true" /> Approve
                    </Button>
                    <Button type="submit" name="decision" value="reject" className="flex-1" variant="destructive">
                      <XSquare size={16} className="mr-2" aria-hidden="true" /> Reject
                    </Button>
                    <Button type="submit" name="decision" value="abstain" className="flex-1" variant="secondary">
                      <MinusSquare size={16} className="mr-2" aria-hidden="true" /> Abstain
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Finalize Section (Admins/Founders) — irreversible: consequence preview first */}
          {!isClosed && totalVotesCast >= rosterMembers.length / 2 && (
            <Card className="border-warning/20 shadow-sm">
              <CardHeader className="bg-warning/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-warning">
                  <Gavel size={18} aria-hidden="true" /> Finalize Board Outcome
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Authority boundary: only the founder finalizes. Closing is irreversible and permanently audited.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <form action={finalizeBoardDecision} className="space-y-4">
                  <input type="hidden" name="caseId" value={caseData.id} />
                  <input type="hidden" name="cycleId" value={approvalRound.review_cycle_id} />
                  <input type="hidden" name="approvalRoundId" value={approvalRound.id} />
                  <input type="hidden" name="boardRoundId" value={boardRound.id} />

                  <div className="space-y-2">
                    <Label htmlFor="board-decision">Board Decision</Label>
                    <select
                      id="board-decision"
                      name="boardDecision"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      onChange={(e) => setOverride(e.target.value === 'override')}
                    >
                      <option value="uphold">Uphold Existing Terms (Approve normally)</option>
                      <option value="reject">Reject Entirely</option>
                      <option value="override">Override Terms</option>
                    </select>
                    {tallyOutcome !== 'tie' && (
                      <p className="text-xs text-muted-foreground">
                        Tally so far suggests: <strong className="capitalize">{tallyOutcome === 'uphold' ? 'uphold' : 'reject'}</strong>.
                        Choosing a different outcome must be justified below as a governed override.
                      </p>
                    )}
                  </div>

                  {override && (
                    <div className="p-4 bg-muted/30 border rounded-lg space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="override-days">Override Credit Days *</Label>
                        <Input id="override-days" type="number" name="overrideDays" required min={0} placeholder="e.g. 15" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="override-reason">Override Reason Code *</Label>
                        <Input id="override-reason" name="overrideReason" required placeholder="e.g. EX-01 Board Discretion" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="override-expl">Override Explanation *</Label>
                        <Textarea id="override-expl" name="overrideExplanation" required placeholder="Mandatory explanatory text for the override…" />
                      </div>
                    </div>
                  )}

                  {!confirmFinalize ? (
                    <Button type="button" className="w-full bg-warning text-warning-foreground hover:bg-warning/90" onClick={() => setConfirmFinalize(true)}>
                      Review and finalize…
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-3">
                      <p className="text-sm font-semibold">Confirm final outcome</p>
                      <ul className="text-xs space-y-1 list-disc pl-4 text-foreground/85">
                        <li>Voting closes immediately and cannot be reopened.</li>
                        <li>The case moves to the finalized state and all parties are notified.</li>
                        <li>The decision, tally and your rationale are permanently audited.</li>
                        {override && <li>The override terms replace the policy recommendation as the governing terms.</li>}
                      </ul>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          className="bg-warning text-warning-foreground hover:bg-warning/90"
                          onClick={(e) => {
                            if (override) {
                              const form = e.currentTarget.form;
                              const overrideDays = form?.elements.namedItem('overrideDays') as HTMLInputElement;
                              if (!overrideDays?.value) {
                                e.preventDefault();
                                return;
                              }
                            }
                          }}
                        >
                          Finalize Decision & Close Voting
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setConfirmFinalize(false)}>Back</Button>
                      </div>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Visibility of all votes once closed */}
          {isClosed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recorded Votes</CardTitle>
                <p className="text-sm text-muted-foreground">Final outcome: <strong className="uppercase">{boardRound.board_decision}</strong></p>
                {boardRound.board_decision === 'override' && (
                  <div className="mt-2 text-sm bg-muted/50 p-3 rounded">
                    <p><strong>Overridden Days:</strong> {boardRound.override_credit_days}</p>
                    <p><strong>Reason:</strong> {boardRound.override_reason_code}</p>
                    <p><strong>Explanation:</strong> {boardRound.override_explanation}</p>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {votes.map((v: any) => (
                  <div key={v.id} className="p-3 border rounded-lg bg-muted/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-sm">{v.voter?.full_name}</span>
                      <Badge variant={v.decision === 'approve' ? 'success' : v.decision === 'reject' ? 'destructive' : 'secondary'} className="capitalize">
                        {v.decision}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground italic">&ldquo;{v.comment}&rdquo;</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Governance note */}
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <ShieldCheck size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
            Board votes are private while the window is open. Individual choices and rationale are revealed only after closure, with the final outcome and any override.
          </p>
        </div>
      </div>
    </div>
  );
}
