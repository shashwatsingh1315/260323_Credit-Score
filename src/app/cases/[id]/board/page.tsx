import { createClient } from '@/utils/supabase/server';
import { ChevronRight, ShieldAlert, CheckSquare, XSquare, MinusSquare } from 'lucide-react';
import { submitBoardVote } from './actions';
import styles from './page.module.css';
import { notFound } from 'next/navigation';

export default async function BoardVotingPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: c } = await supabase.from('credit_cases').select('*, customer:parties(legal_name)').eq('id', id).single();
  
  if (!c && process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();
  
  const caseData = c || { id: 'mock', case_number: 'CASE-1025', customer: { legal_name: 'Acme Corp' } };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.breadcrumbs}>
          <span>Cases</span>
          <ChevronRight size={16} />
          <span>{caseData.case_number}</span>
          <ChevronRight size={16} />
          <span className={styles.currentBreadcrumb}>Board Voting Portal</span>
        </div>
        <h1 className={styles.title}>Committee Ambiguity Review</h1>
        <p className={styles.subtitle}>Case requires 7-person board majority due to policy ambiguity flags.</p>
      </div>

      <div className={styles.votingGrid}>
        <div className={`card ${styles.leftPanel}`}>
           <h2>Committee Roster & Status</h2>
           <div className={styles.voterList}>
             <div className={styles.voterRow}>
               <div>
                  <strong>Risk Director (CRO)</strong>
                  <div className={styles.overrideBadge}>Override Power</div>
               </div>
               <span className={`badge success`}>Approved</span>
             </div>
             <div className={styles.voterRow}>
               <div><strong>Region Manager (North)</strong></div>
               <span className={`badge danger`}>Rejected</span>
             </div>
             <div className={styles.voterRow}>
               <div><strong>Underwriting Lead</strong></div>
               <span className={`badge default`}>Pending</span>
             </div>
           </div>

           <div className={styles.tally}>
              <h3>Current Tally</h3>
              <div className={styles.tallyBar}>
                <div style={{ flex: 1, backgroundColor: 'var(--success)', color: 'white', padding: '0.25rem', textAlign: 'center'}}>1 Approve</div>
                <div style={{ flex: 1, backgroundColor: 'var(--danger)', color: 'white', padding: '0.25rem', textAlign: 'center'}}>1 Reject</div>
                <div style={{ flex: 5, backgroundColor: 'var(--border-color)', color: 'var(--text-muted)', padding: '0.25rem', textAlign: 'center'}}>5 Pending</div>
              </div>
              <p className={styles.requirement}>Requires 4 Approvals for progression unless CRO Override activated.</p>
           </div>
        </div>

        <div className={`card ${styles.rightPanel}`}>
           <h2>Cast Your Vote</h2>
           <p className={styles.helperText}>As a member of the Ambiguity Board, record your decision below.</p>
           
           <form action={submitBoardVote} className={styles.voteForm}>
             <input type="hidden" name="caseId" value={caseData.id} />
             
             <div className={styles.inputGroup}>
                <label>Rationale / Memo</label>
                <textarea name="rationale" rows={5} className={styles.input} required placeholder="Detail the reasoning for your decision based on the financial package..."></textarea>
             </div>

             <div className={styles.actionRow}>
                <button type="submit" name="decision" value="Approve" className={styles.voteBtnApprove}>
                  <CheckSquare size={20} /> Approve Request
                </button>
                <button type="submit" name="decision" value="Reject" className={styles.voteBtnReject}>
                  <XSquare size={20} /> Reject Request
                </button>
                <button type="submit" name="decision" value="Abstain" className={styles.voteBtnAbstain}>
                  <MinusSquare size={20} /> Abstain / Recuse
                </button>
             </div>
           </form>
        </div>
      </div>
    </div>
  );
}
