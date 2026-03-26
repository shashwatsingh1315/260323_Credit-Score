"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, CheckSquare, XSquare, MinusSquare, Gavel, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { submitBoardVote, finalizeBoardDecision } from './actions';

export default function BoardClient({ data }: { data: any }) {
  const { caseData, approvalRound, boardRound, votes, rosterMembers } = data;
  const [override, setOverride] = useState(false);

  // Voting stats
  const approvals = votes.filter((v: any) => v.decision === 'approve').length;
  const rejections = votes.filter((v: any) => v.decision === 'reject').length;
  const abstains = votes.filter((v: any) => v.decision === 'abstain').length;
  const totalVotesCast = approvals + rejections + abstains;
  const isClosed = boardRound?.status === 'closed';

  const windowEnd = new Date(boardRound.vote_window_end);
  const isExpired = windowEnd < new Date();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/cases" className="hover:text-foreground transition-colors">Cases</Link>
            <ChevronRight size={14} />
            <Link href={`/cases/${caseData.id}`} className="hover:text-foreground transition-colors">{caseData.case_number}</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Board Portal</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale size={24} className="text-indigo-600" />
            {approvalRound?.round_type === 'appeal' ? 'Committee Appeal Review' : 'Committee Ambiguity Review'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {approvalRound?.round_type === 'appeal'
              ? 'Case requires exception workflow due to KAM/RM appeal.'
              : 'Case requires 7-person board majority due to policy ambiguity flags.'}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <Badge variant={isClosed ? "secondary" : "default"} className="text-sm py-1 px-3">
            {isClosed ? 'Voting Closed' : 'Voting Open'}
          </Badge>
          {!isClosed && (
            <span className={`text-xs mt-1 ${isExpired ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
              Closes: {windowEnd.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Committee Roster</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {rosterMembers.map((member: any) => {
                const vote = votes.find((v: any) => v.voter_id === member.id);
                const isPending = !vote;
                return (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{member.full_name}</p>
                    </div>
                    {isPending ? (
                      <Badge variant="outline" className="text-[10px]">Pending</Badge>
                    ) : (
                      <Badge
                        variant={vote.decision === 'approve' ? 'success' : vote.decision === 'reject' ? 'destructive' : 'secondary'}
                        className="text-[10px] capitalize"
                      >
                        {vote.decision}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Current Tally</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex h-6 rounded-full overflow-hidden mb-3 bg-muted">
                <div style={{ width: `${(approvals / rosterMembers.length) * 100}%` }} className="bg-emerald-500" />
                <div style={{ width: `${(rejections / rosterMembers.length) * 100}%` }} className="bg-red-500" />
                <div style={{ width: `${(abstains / rosterMembers.length) * 100}%` }} className="bg-slate-400" />
              </div>
              <div className="grid grid-cols-3 text-center text-sm font-medium">
                <div className="text-emerald-600">{approvals} App</div>
                <div className="text-red-600">{rejections} Rej</div>
                <div className="text-slate-600">{abstains} Abs</div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3 border-t pt-3">Decision basis: Majority of votes cast. Ties escalate to Founder/Admin.</p>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2 space-y-6">

          {/* Casting Vote Section */}
          {!isClosed && (
            <Card className="border-indigo-100 shadow-sm">
              <CardHeader className="bg-indigo-50/50 pb-4">
                <CardTitle className="text-lg text-indigo-900">Cast Your Vote</CardTitle>
                <p className="text-xs text-indigo-700">Record your decision. You may change your vote until the window closes.</p>
              </CardHeader>
              <CardContent className="pt-4">
                <form action={submitBoardVote} className="space-y-4">
                  <input type="hidden" name="caseId" value={caseData.id} />
                  <input type="hidden" name="boardRoundId" value={boardRound.id} />

                  <div className="space-y-2">
                    <Label>Rationale / Memo</Label>
                    <Textarea name="comment" rows={3} required placeholder="Detail the reasoning for your decision based on the financial package..." />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" name="decision" value="approve" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                      <CheckSquare size={16} className="mr-2" /> Approve
                    </Button>
                    <Button type="submit" name="decision" value="reject" className="flex-1" variant="destructive">
                      <XSquare size={16} className="mr-2" /> Reject
                    </Button>
                    <Button type="submit" name="decision" value="abstain" className="flex-1" variant="secondary">
                      <MinusSquare size={16} className="mr-2" /> Abstain
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Finalize Section (Admins/Founders) */}
          {!isClosed && totalVotesCast >= rosterMembers.length / 2 && (
            <Card className="border-warning shadow-sm">
              <CardHeader className="bg-amber-50/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
                  <Gavel size={18} /> Finalize Board Outcome
                </CardTitle>
                <p className="text-xs text-amber-700">Close the voting window and record the final organizational decision.</p>
              </CardHeader>
              <CardContent className="pt-4">
                <form action={finalizeBoardDecision} className="space-y-4">
                  <input type="hidden" name="caseId" value={caseData.id} />
                  <input type="hidden" name="cycleId" value={approvalRound.review_cycle_id} />
                  <input type="hidden" name="approvalRoundId" value={approvalRound.id} />
                  <input type="hidden" name="boardRoundId" value={boardRound.id} />

                  <div className="space-y-2">
                    <Label>Board Decision</Label>
                    <select
                      name="boardDecision"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      onChange={(e) => setOverride(e.target.value === 'override')}
                    >
                      <option value="uphold">Uphold Existing Terms (Approve normally)</option>
                      <option value="reject">Reject Entirely</option>
                      <option value="override">Override Terms</option>
                    </select>
                  </div>

                  {override && (
                    <div className="p-4 bg-muted/30 border rounded-lg space-y-4">
                      <div className="space-y-2">
                        <Label>Override Credit Days *</Label>
                        <Input type="number" name="overrideDays" required min={0} placeholder="e.g. 15" />
                      </div>
                      <div className="space-y-2">
                        <Label>Override Reason Code *</Label>
                        <Input name="overrideReason" required placeholder="e.g. EX-01 Board Discretion" />
                      </div>
                      <div className="space-y-2">
                        <Label>Override Explanation *</Label>
                        <Textarea name="overrideExplanation" required placeholder="Mandatory explanatory text for the override..." />
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">Finalize Decision & Close Voting</Button>
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

        </div>
      </div>
    </div>
  );
}