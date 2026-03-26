# Gap Analysis: Implemented System vs. Documentation Requirements

This document provides a highly granular analysis comparing the codebase implementation (as of the current V1 delivery) against the requirements specified in the `docs/credit-issuance/` markdown files.

## High-Level Summary
The current codebase has successfully implemented the foundation of **Phase 1 (Core Reactive Workflow)** and portions of **Phase 2 (Policy And Scoring Administration)**. The database schema is extremely robust and closely mirrors the documentation. However, large portions of the frontend UI and backend API routes required for **Phase 2** and almost all of **Phase 3 (Exception Workflows, Imports, And Operational Reporting)** are either missing, stubbed, or incomplete.

---

## 1. Phase 1: Core Reactive Workflow (Mostly Complete, Some Gaps)

### Case Intake & Commercial Structure
- ✅ **Implemented:** 3-stage workflow shell, RM creates draft/submits, KAM assignment, Branch tagging, Fixed roles, Case attributes/enumerations.
- ✅ **Implemented:** Tranche builder (amounts and percentages), live composite days calculation, exact bill amount reconciliation constraint.
- ❌ **Missing/Incomplete:**
  - **Counter-Offer Restructuring UI:** The documentation (`04-case-intake-and-commercial-structure.md`) requires the ability to restructure tranches live when requested terms exceed approved limits, without triggering a new review (if bill amount/parties/scenario are unchanged). The `CaseWorkspace.tsx` does not have a UI for counter-offer negotiations or tracking negotiation outcomes (accepted, revised again, dropped, escalated).
  - **Selective Unlock/Reopen:** The doc states "Post-submission commercial edits are controlled through reopen or selective unlock, not free editing." There is no "Unlock" or "Reopen" functionality built into the UI or `actions.ts`.
  - **Party Candidate Creation:** `08-party-master.md` states RM/KAM can create candidate parties if not found. The current `NewCasePage.tsx` only allows selecting existing parties from a dropdown; there is no UI to add a new/candidate party.

### Reactive Workflow & Lifecycle
- ✅ **Implemented:** Tasks run in parallel, KAM forces stage progression, basic return-for-revision, waiting state.
- ❌ **Missing/Incomplete:**
  - **SLA Clock & Aging:** SLA deadlines and paused durations (`sla_deadline`, `sla_paused_duration` in DB) are not visibly calculated or displayed in the UI queues/dashboards.
  - **Force-Ready with Missing Items:** `05-reactive-workflow.md` allows KAM to force-ready a stage before all tasks are complete, recording a missing-items list and making it ambiguity-prone. The `progressStage` function simply checks if tasks are done; there's no UI/backend flow for the KAM to explicitly bypass incomplete required tasks with a reason code.
  - **Related-Party Warnings:** The UI does not show warnings for open reviews, valid active approvals, or recent closures when starting a new case for the same party.

---

## 2. Phase 2: Policy And Scoring Administration (Partially Complete)

### Admin Configuration Engine
- ✅ **Implemented:** Parameter definitions, grade scale, score bands, basic draft/publish policy versioning.
- ❌ **Missing/Incomplete:**
  - **Simulation Tools:** `09-admin-configuration.md` requires simulation tools to preview score results, approved credit-day outputs, routing behavior, and ambiguity implications before publishing a draft policy. This is completely missing.
  - **Dominance Category Configuration:** The DB has `dominance_categories` to control how customer/contractor scores blend (weighted, power_law, etc.). However, there is no UI in `src/app/policy/` to manage these dominance categories.
  - **Weight Matrices Administration:** The DB has `weight_matrices` connecting personas to parameters with specific weights. There is no UI to manage these weights.
  - **Routing Thresholds & Validity Rules:** The DB schemas exist (`routing_thresholds`, `validity_rules`), but there is no frontend admin UI or backend logic applying these rules (e.g., automatically routing a case to Stage 3 based on exposure).
  - **Conditional Applicability Rules:** The `parameter_definitions.conditional_rules` field exists in the DB, but the scoring engine (`generateStageTasks`) does not evaluate these rules to dynamically show/hide/require parameters based on persona or history classification.
  - **Stage Max Totals Management:** No UI exists to edit `stage_max_totals`.

### Scoring Engine
- ✅ **Implemented:** Subject-level scoring, cumulative stage scoring, dominance matrix combination (in `engine.ts`), ambiguity checking based on score bands and missing critical signals.
- ❌ **Missing/Incomplete:**
  - **History Classification Context:** First-time vs. repeat classification should be inferred and used as a policy context. The code doesn't dynamically apply this to scoring or defaults.
  - **Persona Selection Mid-Flight:** `06-scoring.md` states KAM can manually select/change personas on a live case. The `CaseWorkspace.tsx` does not provide a UI to change `customer_persona_id` or `contractor_persona_id` for the active cycle.

---

## 3. Phase 3: Exception Workflows, Imports, & Reporting (Largely Missing)

### Exception Workflows (Appeal & Ambiguity Board)
- ⚠️ **Partially Implemented Database:** The schema has `board_rounds`, `board_votes`, and `approval_rounds` (for appeal/ambiguity). `src/app/cases/[id]/board/` exists but appears to be a stub or basic implementation.
- ❌ **Missing/Incomplete:**
  - **Board Voting Rules & Overrides:** Board members must be able to vote (approve/reject/abstain), and the board can *override* terms. The logic handling majority vote counting, tie escalation, and applying an override to the final credit days is not fully built out.
  - **Ambiguity Submission:** There is no dedicated flow for a KAM to submit an unresolved case to the Ambiguity Board with the required payload (unresolved issues summary, missing critical items, KAM recommendation).

### Party History & Imports
- ❌ **Missing/Incomplete:**
  - **CSV Imports:** `08-party-master.md` dictates CSV or admin-led imports for history and exposure, supporting preview, partial import, and append behavior. There is no UI or backend route for data imports.
  - **Derived Metrics & Outstanding Exposure:** The system must compute reusable history metrics (order count, total volume, payment recency, max delay) from imported data and show it inline during case review. The `party_exposure` and `party_history` tables exist, but there is no UI showing this data on the `CaseWorkspace.tsx`.
  - **Stale Data Warnings:** No logic exists to check `data_as_of` in the exposure tables and raise a strong warning/ambiguity signal if the data is stale.
  - **Alias & Merge Rules:** Founder/Admin needs a UI to merge duplicate parties and manage aliases. This does not exist.

### Realized Outcomes
- ❌ **Missing/Incomplete:**
  - The system needs to capture post-decision outcomes (deal happened, payment on time, realized delay). The `realized_outcomes` table exists, but there is no UI or API to record this data post-closure.

### Dashboards, Search, & Audit
- ⚠️ **Partially Implemented:** A basic audit timeline is visible on the case detail page.
- ❌ **Missing/Incomplete:**
  - **Role-Tailored Dashboards:** Dashboards emphasizing pending tasks, stage backlogs, overdue work, and waiting reasons for specific roles (RM, KAM, Accounts) are not implemented. The `CasesPage` is just a basic list.
  - **Decision Memo PDFs:** `10-search-dashboards.md` requires generating an internal-only decision memo PDF upon finalization. The UI has a generic "Export PDF" button `window.print()`, but it does not generate the structured, logged Decision Memo PDF artifact described in the docs.
  - **Sensitive-View Logging:** Opening sensitive financial sections must be explicitly logged. The current audit implementation (`logAuditEvent`) does not track read-access to sensitive sections.
  - **RM-Facing Summary:** RM should see a curated business-facing summary generated from the decision. There is no flow for KAM to draft/edit the `rm_facing_summary` text before the RM sees it.
  - **Concurrent Editing Guard:** No stale-save detection or concurrent editing warnings exist in the UI.

---

## Conclusion
The development team has done an excellent job laying the database schema and the core structural plumbing (Next.js server actions, Supabase integration, fixed 3-stage routing, and math engines).

To reach "Complete Phase" status for V1, the immediate development focus must shift to:
1. **Admin UI:** Building out the missing policy administration screens (Simulation, Dominance, Weights, Routing rules).
2. **Imports & History:** Creating the CSV import utility and surfacing historical exposure data to reviewers.
3. **Exception Workflows:** Completing the Board Voting, Appeal, and Ambiguity workflows.
4. **Commercial Flex:** Adding UI for counter-offers, tranches restructuring post-approval, and selective reopen.