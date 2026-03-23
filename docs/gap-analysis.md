# Credit Issuance Gap Analysis

This document outlines the gaps between the functional requirements specified in the `docs/credit-issuance/` documentation pack and the current implementation found in the repository.

## 1. Workflows & Case Lifecycle

**Missing or Incomplete:**
- **Counter-Offer & Accepted Structure:**
  - The `04-case-intake-and-commercial-structure.md` document specifies a counter-offer negotiation flow if approved days are lower than requested.
  - The system must capture the "Final Accepted Structure" explicitly and store whether it complies with the approved limit.
  - *Current Status:* The `Tranche Builder` only models the draft. There is no counter-offer UI, no distinct "Accepted" phase capturing final agreed terms, and no specific database columns or workflows verifying the final structure against the approved structure.
- **Selective Unlock & Reopen:**
  - The documentation mentions "Selective unlock may target: commercial section only...".
  - *Current Status:* Post-submission edits or partial unlocks are not implemented in the UI or backend. The case is strictly tied to its main status.
- **Cycle Freezing & Carry Forward:**
  - When returning a case or starting a new review cycle, prior scored parameters shouldn't silently carry over into the draft score. Re-scoring behavior on a fresh cycle requires a clean workflow.
  - *Current Status:* `returnForRevision` just sets a substatus. True cycle superseding, where context carries over but live scoring resets, isn't fully built out.

## 2. Appeals & Board Ambiguity

**Missing or Incomplete:**
- **Appeals Workflow:**
  - `07-approvals-appeals-and-ambiguity-review.md` mentions that appeals are distinct from normal ordinary approvals.
  - *Current Status:* An "appeal" hidden input exists in the UI, and an action changes the status to "Appealed", but the distinct lifecycle management of an appealed case vs an ambiguity board case is incomplete. There is no dedicated appeal submission screen requiring appeal rationale.
- **Board Outcomes & Overrides:**
  - Tie or no-effective-vote outcomes must escalate to founder/admin.
  - Board members must be able to override terms with rationale.
  - *Current Status:* A rudimentary `Ambiguity Review` page exists at `cases/[id]/board/page.tsx`, but rules handling 7-member ties, abstentions, and founder escalation are not implemented in the backend voting logic.

## 3. History, Outcomes, & Imports

**Missing or Incomplete:**
- **Outcome Tracking (Collections V1):**
  - `08-party-master-history-imports-and-outcomes.md` dictates capturing "Realized Outcomes" (e.g., whether the deal happened, on-time payment, realized exposure).
  - *Current Status:* A `realized_outcomes` table exists in the database, but there is no UI, API, or Server Action to input or manage these outcomes.
- **Outstanding Exposure & Stale Data Warnings:**
  - Imported exposure data must feed into scores and warn if it is stale.
  - *Current Status:* CSV importing exists broadly in the admin panel, but the specific validation logic for "stale data" warnings on a case, or calculating a risk signal based on stale imported data, is missing.
- **Inline History summary:**
  - Repeat cases should prefill contexts and show an inline history summary of past cases/exposures.
  - *Current Status:* `CaseWorkspace` doesn't implement a robust inline history panel for repeat parties.

## 4. Roles, Governance, & Sensitive Data

**Missing or Incomplete:**
- **Sensitive Section View Logging:**
  - `03-user-roles-and-permissions.md` mandates that when users open sensitive financial sections, the view must be logged.
  - *Current Status:* There is no `sensitive_section_viewed` tracking or API implemented in the application.
- **RM-Facing Curation:**
  - RM should receive a "reviewer-editable business summary" instead of raw internal scoring.
  - *Current Status:* Memos and rationale notes are not partitioned securely between RM and internal approvers in the UI layer.

## 5. Dashboards, Audit, & PDF Generation

**Missing or Incomplete:**
- **Dashboards:**
  - Dashboards must be role-tailored (e.g. RM sees drafts/submitted, KAM sees queue/pending).
  - Queue prioritization needs to factor in urgency signals and SLA aging.
  - *Current Status:* A generic homepage exists that fetches basic counts, but it is not role-tailored or prioritized by urgency signals.
- **Decision Memo PDF:**
  - The documentation demands that finalized cycles generate a formal internal-only decision memo PDF containing the rationale summary and policy version.
  - *Current Status:* A print button (`window.print()`) is present in `CaseWorkspace.tsx`, but true backend PDF document generation (capturing the formal memo state snapshot) is missing.
- **SLA & Aging Pauses:**
  - Waiting reasons should stop the SLA clock.
  - *Current Status:* `setWaiting` records a timestamp and status, but there is no actual SLA aging calculation logic implemented to pause or resume working timers.

## 6. Admin & Policy Engine

**Missing or Incomplete:**
- **Policy Publish / Simulation:**
  - Admins should simulate policies against historical cases before publishing.
  - More specific rule overlaps must reject a publish action (e.g. failing validation for ambiguous overlaps).
  - *Current Status:* A basic `policy` admin route exists, but simulation tools and overlap validation are completely missing.
- **Validations & Windows:**
  - Approval validity windows must be rule-driven (e.g. vary by score/scenario) rather than flat default.
  - *Current Status:* Validity rules table exists, but logic to dynamically apply these validity expirations to approved cases is not active.

## Conclusion

While the core data schema effectively covers most entities described in the documentation, the primary gaps exist in the **business logic and workflow layers**. Exception handling (appeals/counter-offers), robust audit (PDF/sensitive views), SLA tracking, and dynamic policy governance (simulations/validity windows) are the most critical components remaining to align the codebase with the `docs/credit-issuance/` specification.