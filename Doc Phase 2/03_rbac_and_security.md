# Doc Phase 2: RBAC & Security Boundaries

Operating a post-issuance financial ledger demands stringent access management. Phase 2 extends the permissions mapping explicitly to prevent manipulation of margins and delays.

---

## 1. The Relationship Manager (RM)
RMs are the deal-owners. They input the operational parameters but are securely locked out of execution to prevent altering history.
* **Permissions Assigned:**
  - `UPDATE`: Ability to type and repeatedly submit the `decided_bill_amount` and `promised_bill_amount`.
  - `UPDATE`: Setting the `billing_date` timer.
* **Security Lock Rule:** The exact millisecond a KAM saves the primary row in the `repayments` table, RM access immediately cascades into a `READ-ONLY` state.

---

## 2. Key Account Manager (KAM)
KAMs are directly tasked with capital extraction and physical ledger maintenance.
* **Permissions Assigned:**
  - `INSERT` / `UPDATE` / `DELETE`: Active dominion over the `repayments` ledger.
  - `UPDATE`: Allowed to physically extend Tranche Deadlines to prevent immediate failure penalties when negotiating gracefully with customers.
* **Prevention Limits:** Admin Settings constrain Tranche restructuring via a hard cap metric `MAX_TRANCHE_EXTENSION_DAYS`. Extending past this systematically refuses the action.

---

## 3. Founders / Admin
The highest security tier tasked with resolving absolute financial anomalies and overriding disputes.
* **Permissions Assigned:**
  - `UPDATE`: Exclusive authority to unblock a case stalled securely in the `Pending Write-Off Approval` queue.
  - `INSERT` / `UPDATE`: Total dominion over global thresholds in the `system_settings` table (e.g., Slippage configurations).
  - `UPDATE`: Absolute authority to Approve/Deny `credit_notes` when structural flaws occurred in RM provisioning and require post-lock mathematical reduction.

---

## 4. BDOs and Board Members (The Evaluators)
Roles designed exactly as credit evaluators in Phase 1 now ingest Phase 2 data safely for contextual analysis.
* **Permissions Assigned:**
  - `SELECT`: Explicit Read-Only visibility over historical Repayment logs, Delay histories, and Contractor Reputation markers specifically designed to inform the approval/rejection loop on *future* cases targeting identical Contractor profiles.

---

## 5. Audit Traceability
* **Mistake Logging:** Typo-corrections structurally execute freely for KAMs altering `repayments` rows. However, each `UPDATE` or `DELETE` trigger physically routes an immutable snapshot packet to the backend `audit_events` ledger for retrospective Founder auditing.
