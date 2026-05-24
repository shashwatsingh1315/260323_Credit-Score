"use client";
import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import { handleCreateApprovalRound, handleApprovalDecision, handleBoardVote } from './actions';

export default function ApprovalsTab({ coreData, promises, activeRole }: any) {
  const c = coreData.case;
  const cycle = coreData.cycle;

  const { approvalRounds, boardRounds } = use(promises.approvalsPromise as Promise<any>);
  const data = { approvalRounds, boardRounds };

  return (
    <div className="space-y-4 mt-6">

          {/* Ambiguity Warning Banner */}
          {cycle?.is_ambiguous && (
            <div className="mb-4 rounded-lg border border-attention/40 bg-attention/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-amber-500" />
                <h3 className="font-semibold text-sm text-amber-600 dark:text-amber-400">
                  Ambiguous Case — Board Review Required
                </h3>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 opacity-90">
                This case was force-readied with missing items. A board round must be convened before a final decision.
              </p>
              {(activeRole === 'founder_admin' || activeRole === 'kam') && (
                <form action={handleCreateApprovalRound} className="mt-3">
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="cycleId" value={cycle.id} />
                  <input type="hidden" name="stage" value={cycle.active_stage} />
                  <input type="hidden" name="roundType" value="appeal" />
                  <Button type="submit" size="sm" variant="outline" className="border-attention text-attention">
                    Convene Ambiguity Board
                  </Button>
                </form>
              )}
            </div>
          )}

          {data.approvalRounds.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
              No approval rounds yet. Complete all required tasks for a stage, then click "Request Approval" in the Stages tab.
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {data.approvalRounds.map((round: any) => {
                const boardRound = data.boardRounds?.find((br: any) => br.approval_round_id === round.id);
                const canDecide = ['ordinary_approver', 'board_member', 'founder_admin'].includes(activeRole);
                const canBoardVote = ['board_member', 'founder_admin'].includes(activeRole);

                return (
                  <Card key={round.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
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
                          {round.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Existing decisions */}
                      {round.decisions?.map((d: any) => (
                        <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{d.approver?.full_name || 'Unknown'}</span>
                              <Badge variant={d.decision === 'approve' ? 'success' : d.decision === 'reject' ? 'destructive' : 'warning'} className="text-xs capitalize">
                                {d.decision?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            {d.comment && <p className="text-sm text-muted-foreground">{d.comment}</p>}
                          </div>
                        </div>
                      ))}

                      {/* Ordinary/Appeal approval form */}
                      {round.status === 'open' && round.round_type !== 'ambiguity_board' && canDecide && (
                        <form action={handleApprovalDecision} className="space-y-3 pt-2 border-t border-border">
                          <input type="hidden" name="roundId" value={round.id} />
                          <input type="hidden" name="caseId" value={c.id} />
                          <p className="text-xs text-muted-foreground font-semibold">YOUR DECISION</p>
                          <Input name="comment" placeholder="Comment (optional)" />
                          <div className="flex gap-2">
                            <Button type="submit" name="decision" value="approve" className="bg-success hover:bg-success/90">Approve</Button>
                            <Button type="submit" name="decision" value="reject" variant="outline" className="border-destructive text-destructive">Reject</Button>
                            <Button type="submit" name="decision" value="return_for_revision" variant="outline">Return for Revision</Button>
                          </div>
                        </form>
                      )}

                      {/* Board voting section (ambiguity_board rounds) */}
                      {round.round_type === 'ambiguity_board' && boardRound && (
                        <div className="mt-3 border-t border-border pt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground">BOARD VOTES</p>
                            <Badge variant={boardRound.status === 'closed' ? 'success' : 'warning'} className="text-xs">
                              {boardRound.status} | Window closes: {new Date(boardRound.vote_window_end).toLocaleDateString('en-IN')}
                            </Badge>
                          </div>
                          {boardRound.votes?.map((v: any) => (
                            <div key={v.id} className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{v.voter?.full_name}</span>
                              <Badge variant={v.decision === 'approve' ? 'success' : v.decision === 'reject' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                                {v.decision}
                              </Badge>
                              {v.comment && <span className="text-muted-foreground text-xs">— {v.comment}</span>}
                            </div>
                          ))}
                          {/* Board vote form */}
                          {boardRound.status === 'open' && canBoardVote && (
                            <form action={handleBoardVote} className="space-y-2 border-t border-border pt-2">
                              <input type="hidden" name="boardRoundId" value={boardRound.id} />
                              <input type="hidden" name="caseId" value={c.id} />
                              <Input name="comment" placeholder="Vote comment (optional)" className="h-8 text-xs" />
                              <div className="flex gap-2">
                                <Button type="submit" name="decision" value="approve" size="sm" className="bg-success hover:bg-success/90">Vote Approve</Button>
                                <Button type="submit" name="decision" value="reject" size="sm" variant="outline" className="border-destructive text-destructive">Vote Reject</Button>
                                <Button type="submit" name="decision" value="abstain" size="sm" variant="ghost">Abstain</Button>
                              </div>
                            </form>
                          )}
                        </div>
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
