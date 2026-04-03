# Credit Scoring System — Cleanup Report

> **Generated:** 2026-04-02
> **Scope:** Full codebase audit — bugs, incomplete features, incorrect implementations, security issues

---

## Table of Contents

1. [Critical Security Vulnerabilities](#1-critical-security-vulnerabilities)
2. [Authentication & Authorization Bugs](#2-authentication--authorization-bugs)
3. [Scoring Engine Logic Errors](#3-scoring-engine-logic-errors)
4. [Database Schema Issues](#4-database-schema-issues)
5. [Missing Error Handling](#5-missing-error-handling)
6. [Incomplete / Stub Features](#6-incomplete--stub-features)
7. [Policy Module Issues](#7-policy-module-issues)
8. [Case & Billing Logic Bugs](#8-case--billing-logic-bugs)
9. [CSV Import Issues](#9-csv-import-issues)
10. [UI / Client Component Bugs](#10-ui--client-component-bugs)
11. [Test Coverage Gaps](#11-test-coverage-gaps)
12. [Configuration & DevOps Issues](#12-configuration--devops-issues)
13. [Data Integrity & Validation Gaps](#13-data-integrity--validation-gaps)
14. [Summary Matrix](#14-summary-matrix)

---

## 1. Critical Security Vulnerabilities

### 1.1 Hardcoded Supabase Secret Key in Source Code
- **File:** `test_supabase.js:3-4`
- **Severity:** CRITICAL
- **Issue:** The Supabase URL and **service-role secret key** are hardcoded in plaintext in a committed file.
- **Impact:** Anyone with repo access can directly read/write the production database, bypassing all RLS.
- **Fix:** Delete `test_supabase.js` from the repo and git history. Revoke and rotate the exposed key immediately. Use `.env` files (gitignored) for all credentials.

### 1.2 XSS via `dangerouslySetInnerHTML`
- **File:** `src/app/cases/new/page.tsx:96-100`
- **Severity:** HIGH
- **Issue:** `formatRubricGuidance()` applies regex substitutions on guidance text and renders it via `dangerouslySetInnerHTML`. If guidance text comes from user-editable admin input, it is an XSS vector.
- **Fix:** Use a safe markdown renderer or sanitize with DOMPurify before rendering.

### 1.3 Overly Permissive Row-Level Security (RLS) Policies
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:609-687`
- **Severity:** HIGH
- **Issue:** Every write policy is a blanket `auth.role() = 'authenticated'` check. Any logged-in user can modify ANY row in `credit_cases`, `approval_decisions`, `board_votes`, `review_cycles`, `repayments`, etc.
- **Impact:** An RM can overwrite board decisions, alter another user's case, or tamper with financial records.
- **Fix:** Implement row-ownership and role-based RLS (e.g., only the assigned RM/KAM can update their own cases; only `founder_admin` can write to `approval_decisions`).

### 1.4 All Authenticated Users Can Read All Sensitive Data
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:610-642`
- **Severity:** HIGH
- **Issue:** Read policies are `auth.role() = 'authenticated'` on every table. Any user can read financial exposure, approval rationale, board votes, and audit events for all parties and cases.
- **Fix:** Add per-role read restrictions (e.g., RMs see only their cases; board members see only cases routed to them).

### 1.5 Unsafe JSON Storage Without Sanitization
- **File:** `src/app/policy/actions.ts:307, 342`
- **Severity:** MEDIUM
- **Issue:** `JSON.parse(formData.get('context_rule'))` is stored directly in the database. If context rules are later evaluated as code or interpolated into queries, this is exploitable.
- **Fix:** Validate JSON structure against a known schema before persisting.

---

## 2. Authentication & Authorization Bugs

### 2.1 Default Role Fallback to `founder_admin`
- **File:** `src/utils/auth-actions.ts:14, 23-26`
- **Severity:** CRITICAL
- **Issue:** `getImpersonationRole()` defaults to `'founder_admin'` in three places:
  1. If the cookie is not set (line 14)
  2. If an exception is thrown (line 26 — catch block returns `'founder_admin'`)
  3. If the user has no roles (`user?.roles?.[0] || 'founder_admin'`)
- **Impact:** Any unauthenticated or misconfigured user gets full admin privileges silently.
- **Fix:** Default to the **least privileged** role (e.g., `'viewer'`), or throw an error / redirect to login.

### 2.2 Same Fallback in CaseWorkspace
- **File:** `src/app/cases/[id]/CaseWorkspace.tsx:53`
- **Severity:** HIGH
- **Issue:** `setActiveRole(r || 'founder_admin')` — if the role fetch fails, the workspace grants admin access.
- **Fix:** Default to a read-only role or block rendering until role is resolved.

### 2.3 No Role Validation on `switchImpersonationRole`
- **File:** `src/utils/auth-actions.ts:6-10`
- **Severity:** HIGH
- **Issue:** Any arbitrary string can be set as the impersonation role cookie. There is no server-side check that the value is a valid `UserRole`.
- **Fix:** Validate against the `USER_ROLES` constant before writing the cookie.

### 2.4 `signOut` Swallows Errors
- **File:** `src/utils/auth-actions.ts:29-34`
- **Severity:** MEDIUM
- **Issue:** `supabase.auth.signOut()` errors are not caught or surfaced. A failed sign-out leaves the user's session active while the UI acts as if they're logged out.

### 2.5 Missing Auth Check on `fetchAllUsers`
- **File:** `src/app/admin/actions.ts:63-70`
- **Severity:** HIGH
- **Issue:** The function queries the database directly without verifying the caller has admin privileges. Any authenticated user can enumerate all user profiles.
- **Fix:** Add `if (!isAdmin(user)) return { success: false, error: 'Forbidden' }`.

### 2.6 Missing Imports Cause Runtime Crashes
- **File:** `src/app/admin/actions.ts:21, 55`
- **Severity:** CRITICAL
- **Issue:** `hasAnyRole()` and `isAdmin()` are called but **never imported**. The import statement only brings in `getCurrentUser` and `logAuditEvent`. Calling `upsertParty` or `deactivateParty` will throw a `ReferenceError` at runtime.
- **Fix:** Add `import { hasAnyRole, isAdmin } from '@/utils/auth'`.

### 2.7 Silent Failure When Profile Is Missing
- **File:** `src/utils/auth.ts:30`
- **Severity:** MEDIUM
- **Issue:** `getCurrentUser()` returns `null` both when the user isn't authenticated AND when their profile row is missing from the database. Callers can't distinguish the two states.
- **Fix:** Return distinct error codes or throw for missing profile.

### 2.8 Audit Event Insertion Errors Silently Ignored
- **File:** `src/utils/auth.ts:84`
- **Severity:** MEDIUM
- **Issue:** `logAuditEvent()` awaits the insert but never checks for errors. Failed audit writes are lost without any indication.
- **Fix:** Check `{ error }` and log/re-throw if insertion fails.

---

## 3. Scoring Engine Logic Errors

### 3.1 Inverted PDCR (Promised Day Collection Rate) Calculation
- **File:** `src/app/page.tsx:142-144`
- **Severity:** HIGH
- **Issue:** Formula is `(totalWeightedProposedDays / totalWeightedActualDays) * 100`. This is inverted — >100% means the customer paid **faster** than promised, <100% means slower. The metric should be actual/proposed, not proposed/actual.
- **Fix:** Swap numerator and denominator: `(totalWeightedActualDays / totalWeightedProposedDays) * 100`.

### 3.2 Potential Division by Zero in Exponent
- **File:** `src/utils/scoring.ts:173-176`
- **Severity:** HIGH
- **Issue:** Power-law formula uses `1 / dom.exponent`. If `dom.exponent` is `0`, this produces `Infinity`, and the entire score becomes `Infinity` or `NaN`.
- **Fix:** Validate `dom.exponent > 0` before calculation; reject or default to `1`.

### 3.3 `Math.max(contractorScore, 1)` Masks Zero Scores
- **File:** `src/utils/scoring.ts:175`
- **Severity:** MEDIUM
- **Issue:** Contractor score of 0 is silently treated as 1, inflating the final score. A contractor with no data gets a free point.
- **Fix:** Handle zero contractor scores explicitly (e.g., skip contractor component, or use 0 and handle the `Math.pow(0, weight)` edge case).

### 3.4 `parseFloat(o.weight as any)` — Unsafe Cast
- **File:** `src/utils/scoring.ts:51-54`
- **Severity:** MEDIUM
- **Issue:** `as any` defeats TypeScript. If `weight` is not a numeric string, `parseFloat` returns `NaN`, silently corrupting the score.
- **Fix:** Validate and type the weight field; throw on `NaN`.

### 3.5 Multiple `.single()` Calls Without Error Handling
- **File:** `src/utils/scoring.ts:85-91, 149-153, 289-295`
- **Severity:** HIGH
- **Issue:** `.single()` throws if zero or multiple rows match. These calls have no try-catch. If a review cycle is missing, or if there are duplicate active policies, the server action crashes.
- **Fix:** Wrap in try-catch or use `.maybeSingle()` with explicit null checks.

### 3.6 `checkAmbiguity` Returns False on Query Failure
- **File:** `src/utils/scoring.ts:261-274`
- **Severity:** MEDIUM
- **Issue:** If the query for incomplete critical parameters fails, the function returns `{ isAmbiguous: false }` — meaning the case proceeds as if there is no ambiguity, even though we don't know.
- **Fix:** Propagate the error so the caller can halt progression.

### 3.7 `mapScoreToCreditDays` Returns `null` Without Logging
- **File:** `src/utils/scoring.ts:225-226`
- **Severity:** LOW
- **Issue:** If no band matches the score, `null` is returned silently. Callers may not handle `null`, causing downstream errors.

### 3.8 `updateCycleScore` Hardcodes Fallback Scenario
- **File:** `src/utils/scoring.ts:289-295`
- **Severity:** MEDIUM
- **Issue:** `case_scenario` defaults to a hardcoded value if not found, instead of throwing an error for missing configuration.

---

## 4. Database Schema Issues

### 4.1 Email Not Unique in Profiles
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:22`
- **Severity:** MEDIUM
- **Issue:** `email text NOT NULL` lacks a `UNIQUE` constraint. Duplicate profile emails are possible.

### 4.2 Missing Indexes on Foreign Keys
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql`
- **Severity:** MEDIUM
- **Issue:** No explicit indexes on `rm_user_id`, `kam_user_id` (credit_cases), `approver_id` (approval_decisions). JOINs on these columns will be slow as data grows.
- **Fix:** `CREATE INDEX idx_credit_cases_rm ON credit_cases(rm_user_id);` etc.

### 4.3 `closure_reason` is Free Text
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:254`
- **Severity:** LOW
- **Issue:** Should be an enum or have a CHECK constraint. Currently allows typos and inconsistent values.

### 4.4 `proposed_tranches` Lacks NOT NULL for Submitted Cases
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:236`
- **Severity:** MEDIUM
- **Issue:** A case can be submitted with `proposed_tranches = NULL`, which would crash tranche-dependent logic.

### 4.5 `case_number` Uniqueness Under Concurrency
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:220`
- **Severity:** MEDIUM
- **Issue:** Auto-generated case numbers rely on a sequence. Under high concurrency, the DEFAULT expression could produce conflicts. Should be validated with a unique index + retry.

### 4.6 Review Cycle Status Transitions Not Enforced
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:301`
- **Severity:** MEDIUM
- **Issue:** No trigger or constraint prevents invalid state transitions (e.g., `approved` → `in_progress`). The workflow state machine is only enforced in application code.

### 4.7 Case `version` Field Never Incremented
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:272`
- **Severity:** HIGH
- **Issue:** `version integer DEFAULT 1` exists for optimistic concurrency, but no UPDATE statement checks or increments it. Concurrent edits silently overwrite each other.
- **Fix:** All updates should include `WHERE version = $current AND ...` and `SET version = version + 1`.

### 4.8 Auth Trigger Doesn't Create Initial Admin
- **File:** `supabase/migrations/20260323000001_auth_triggers.sql:15-16`
- **Severity:** HIGH
- **Issue:** Comment says "optional but helpful" for assigning first user as `founder_admin`, but logic is not implemented. On a fresh deployment, no admin exists and the system is unusable.
- **Fix:** Implement the trigger or document the manual seed step.

### 4.9 Phase 2 Billing Trigger Race Condition
- **File:** `supabase/migrations/phase2_billing_ledger.sql:62-78`
- **Severity:** MEDIUM
- **Issue:** `sync_actual_bill_amount()` recalculates `SUM(amount)` from all repayments on every insert/update. Under concurrent repayment inserts, the final SUM may be stale.

### 4.10 `README_DB_MIGRATION.md` References Wrong Table Name
- **File:** `README_DB_MIGRATION.md:8`
- **Severity:** MEDIUM
- **Issue:** References `scoring_parameters` but the schema uses `parameter_definitions`. The documented migration will fail.

---

## 5. Missing Error Handling

### 5.1 `engine.ts` — No Transaction Support
- **File:** `src/utils/engine.ts:145-171`
- **Severity:** HIGH
- **Issue:** `submitCase()` performs 5+ sequential database operations (update case, insert cycle, generate tasks, log audit, fetch case, send notification) without a transaction. If any step fails mid-way, the database is left in an inconsistent state (e.g., cycle created but tasks missing).
- **Fix:** Wrap in a Supabase RPC or database function with `BEGIN/COMMIT`.

### 5.2 `engine.ts` — `.single()` Without Error Handling
- **File:** `src/utils/engine.ts:138, 399, 435`
- **Severity:** HIGH
- **Issue:** Multiple `.single()` calls in `submitCase`, `returnForRevision`, and `withdrawCase` will throw if 0 or 2+ rows match. No try-catch anywhere.

### 5.3 `engine.ts` — Race Condition in `generateAllCycleTasks`
- **File:** `src/utils/engine.ts:284-288`
- **Severity:** MEDIUM
- **Issue:** Stages are generated sequentially in a loop. If stage 2 fails, stage 3 is never created, leaving the cycle partially built with no rollback.

### 5.4 `engine.ts` — `progressStage` Doesn't Validate Column Existence
- **File:** `src/utils/engine.ts:308`
- **Severity:** LOW
- **Issue:** Query uses `.is('is_waived', false)` without validating the column exists. If the schema changes, this silently returns wrong results.

### 5.5 `components/actions.ts` — All Three Functions Ignore Errors
- **File:** `src/components/actions.ts:9-36`
- **Severity:** HIGH
- **Issue:** `fetchMyNotifications`, `markNotificationRead`, `clearAllNotifications` — none check the Supabase `error` object. Failed queries return empty arrays or silently do nothing.

### 5.6 `billing-actions.ts` — `parseInt` Truncates Decimal Amounts
- **File:** `src/app/cases/[id]/billing-actions.ts:145-146`
- **Severity:** HIGH
- **Issue:** `parseInt()` on billing amounts truncates decimals. If `decidedAmount` is `"100.50"`, it becomes `100`.
- **Fix:** Use `parseFloat()` or store amounts in paisa/cents as integers.

### 5.7 Policy Actions — JSON.parse Without Try-Catch
- **File:** `src/app/policy/actions.ts:307, 342`
- **Severity:** HIGH
- **Issue:** `JSON.parse(formData.get('context_rule') as string || '{}')` will throw on invalid JSON with no catch block.

### 5.8 Shell.tsx — Unhandled Promise Rejections in useEffect
- **File:** `src/components/Shell.tsx:52-57`
- **Severity:** MEDIUM
- **Issue:** Two `.then()` calls with no `.catch()`. If either promise rejects, React gets an unhandled promise rejection.

---

## 6. Incomplete / Stub Features

### 6.1 `runSimulation` Is a Stub
- **File:** `src/app/policy/simulation/actions.ts:5-9`
- **Severity:** HIGH
- **Issue:** Function imports scoring utilities but always returns `{ simulated: true }`. No actual simulation logic exists. The `SimulationClient` does all calculation client-side and never calls this action.
- **Impact:** The "Simulation" feature is half-implemented — client-side only, no server validation.

### 6.2 Conditional Rules (`conditional_rules` JSONB) Not Used
- **File:** Schema: `20260323000000_complete_v1_schema.sql:128`
- **Severity:** HIGH
- **Issue:** `conditional_rules` field on `parameter_definitions` is defined but never queried in `generateStageTasks()`. Parameters can't be conditionally shown based on persona or history.

### 6.3 Routing Thresholds Not Applied
- **File:** Schema: `20260323000000_complete_v1_schema.sql:194-200`
- **Severity:** HIGH
- **Issue:** `routing_thresholds` table exists and is populated, but `progressStage()` never checks it. High-exposure cases that should auto-route to stage 3 or the board are not routed.

### 6.4 Validity Rules Not Enforced
- **File:** Schema: `20260323000000_complete_v1_schema.sql:175-181`
- **Severity:** HIGH
- **Issue:** `validity_rules` table is populated but never queried. Old approvals should expire after their validity window, but they don't.

### 6.5 Board Override Logic Missing
- **File:** Schema: `20260323000000_complete_v1_schema.sql:411-415`
- **Severity:** HIGH
- **Issue:** `board_rounds.override_credit_days` can be set via the UI but is never applied to the case's final approved days. Board decisions have no effect.

### 6.6 SLA Tracking Not Implemented
- **File:** Schema: `20260323000000_complete_v1_schema.sql:342-344`
- **Severity:** MEDIUM
- **Issue:** `sla_deadline` and `sla_paused_duration` fields exist on review tasks but are never calculated or enforced. Tasks can exceed SLA indefinitely without warning.

### 6.7 `handleForceReadyStage` Is Incomplete
- **File:** `src/app/cases/[id]/actions.ts:235-285`
- **Severity:** MEDIUM
- **Issue:** Sets `is_ambiguous = true` but doesn't actually advance the case to the next stage. Stage readiness is recorded, but progression logic is missing.

### 6.8 `handleToggleWaiting` Logic Is Inverted
- **File:** `src/app/cases/[id]/actions.ts:287-313`
- **Severity:** HIGH
- **Issue:** Line 301 checks `if (isWaiting)` to STOP waiting, but the variable represents the new desired state, not the current state. The toggle is backwards.

### 6.9 Board Voting Page Is Empty
- **File:** `src/app/cases/[id]/board/page.tsx`
- **Severity:** HIGH
- **Issue:** The page checks for `boardRound` and `approvalRound` but the `BoardClient` component is never rendered. The board voting workflow is non-functional.

### 6.10 History Classification Not Auto-Computed
- **File:** Schema: `20260323000000_complete_v1_schema.sql:258`
- **Severity:** MEDIUM
- **Issue:** `history_classification` (first_time vs. repeat) must be set manually. Should be inferred from whether the party has any previous approved cases.

### 6.11 Dominance Category Weights Not Used in Scoring
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:101-110`
- **Severity:** HIGH
- **Issue:** `dominance_categories` allows configuring `power_law`, `weighted`, etc. methods, but the scoring engine uses a hardcoded calculation. The admin-configured method is ignored.

### 6.12 Auto-Banding for Numeric Parameters Not Implemented
- **File:** Schema: `20260323000000_complete_v1_schema.sql:129`
- **Severity:** MEDIUM
- **Issue:** `auto_band_config` JSONB on `parameter_definitions` is defined but the scoring engine never uses it to auto-calculate grades from numeric inputs.

### 6.13 Persona Deletion Not Available
- **File:** `src/app/policy/personas/PersonasClient.tsx`
- **Severity:** LOW
- **Issue:** No delete button. Once created, personas cannot be removed. Inconsistent with other policy entities (bands, weights) that have delete functionality.

### 6.14 Grade Deletion Not Available
- **File:** `src/app/policy/grades/GradesClient.tsx`
- **Severity:** LOW
- **Issue:** Same as above — no delete functionality for grade definitions.

---

## 7. Policy Module Issues

### 7.1 Missing Audit Logging in Policy Mutations
- **File:** `src/app/policy/actions.ts:176, 209, 248, 280, 317, 352, 389, 420`
- **Severity:** HIGH
- **Issue:** `upsertGradeDefinition`, `deleteScoreBand`, `upsertPersona`, `upsertDominanceCategory`, `upsertRoutingRule`, `upsertValidityRule`, `upsertStageMaxTotal`, and `upsertWeightMatrix` do NOT call `logAuditEvent()`. Only some policy functions have audit logging. This breaks the audit trail.

### 7.2 `createNewDraft` / `publishDraftPolicy` — No Error Handling or Return Value
- **File:** `src/app/policy/actions.ts:28-49, 51-70`
- **Severity:** HIGH
- **Issue:** Neither function returns success/failure. `revalidatePath` runs even if the database operation fails. `publishDraftPolicy` performs two updates (archive old + publish new) non-atomically — if the first succeeds and the second fails, two versions are active simultaneously.

### 7.3 Forms Close Dialog Before Server Confirmation
- **Files:** All policy client components (`BandsClient`, `DominanceClient`, `GradesClient`, `ParametersClient`, `PersonasClient`, `WeightsClient`, `RoutingClient`, `ValidityClient`, `StagesClient`)
- **Severity:** HIGH
- **Issue:** Every form uses `onSubmit={() => setOpen(false)}` which closes the dialog immediately when the form is submitted, **before** the server action completes. If the action fails, the user sees success but data was not saved.
- **Fix:** Use `useTransition` or `useFormStatus` to close dialog only after action succeeds.

### 7.4 No Validation That `min_score < max_score` in Bands
- **File:** `src/app/policy/bands/BandsClient.tsx:15-19`
- **Severity:** MEDIUM
- **Issue:** Users can create bands where `min_score > max_score`, making the band unmatchable.

### 7.5 Dominance Weights Not Validated to Sum to 1.0
- **File:** `src/app/policy/dominance/DominanceClient.tsx:63-69`
- **Severity:** MEDIUM
- **Issue:** `customer_weight` and `contractor_weight` can be set to any values (e.g., both 0.9). No validation that they sum to 1.0.

### 7.6 CSV Upload in Parameters — No File Validation
- **File:** `src/app/policy/parameters/ParametersClient.tsx:77-104`
- **Severity:** MEDIUM
- **Issue:** No file size limit, no MIME type check, naive comma-split parsing that doesn't handle quoted fields. Could crash on binary uploads.

### 7.7 `Math.max()` on Empty Array Returns `-Infinity`
- **File:** `src/app/policy/bands/BandsClient.tsx:31`
- **Severity:** LOW
- **Issue:** `Math.max(...initialBands.map(b => b.approved_credit_days), 1)` — if `initialBands` is empty, `map()` returns `[]`, and `Math.max(...[], 1)` is fine (returns 1), but the visual bar chart renders nothing without indication.

### 7.8 Simulation Doesn't Validate Score Boundaries
- **File:** `src/app/policy/simulation/SimulationClient.tsx:13-16`
- **Severity:** MEDIUM
- **Issue:** Users can enter negative scores or scores > 100. No bounds checking.

### 7.9 No Delete Confirmation Dialogs
- **Files:** All components with delete buttons
- **Severity:** LOW
- **Issue:** Clicking delete immediately fires the server action. No "Are you sure?" prompt.

### 7.10 No Loading State on Form Submission Buttons
- **Files:** All policy client components
- **Severity:** LOW
- **Issue:** Submit buttons don't show a spinner or disabled state while the server action runs. Users may click multiple times.

---

## 8. Case & Billing Logic Bugs

### 8.1 Inverted PDCR Metric
- **File:** `src/app/page.tsx:142-144`
- **Severity:** HIGH
- *(See section 3.1)*

### 8.2 Tranche Status Only Shows First Unpaid
- **File:** `src/app/cases/page.tsx:80-85`
- **Severity:** MEDIUM
- **Issue:** `getTrancheStatus()` returns status for only the first unpaid tranche. If multiple tranches are overdue, the user only sees the earliest one.

### 8.3 Race Condition in Auto-Close Logic
- **File:** `src/app/cases/[id]/billing-actions.ts:309-320`
- **Severity:** MEDIUM
- **Issue:** `checkAndCloseCase()` runs after logging a payment. If two concurrent payments are logged, both may read the pre-update total and neither closes the case.

### 8.4 Tranche Waterfall Assumes Sequential Order
- **File:** `src/app/cases/[id]/billing-actions.ts:82-102`
- **Severity:** MEDIUM
- **Issue:** Repayments are allocated to tranches in creation order. There is no mechanism for a user to specify which tranche a payment targets.

### 8.5 No Upper Bound on Extension Days
- **File:** `src/app/cases/[id]/billing-actions.ts:654-664`
- **Severity:** LOW
- **Issue:** Checks `extension > maxExtensionDays` but doesn't check for `extension < 0` (negative extension).

### 8.6 Incomplete Audit Trail for Payment Edits
- **File:** `src/app/cases/[id]/billing-actions.ts:362`
- **Severity:** MEDIUM
- **Issue:** `field_diffs` in audit log only captures old amount and date, but omits old URL and description. Partial audit trail.

### 8.7 `decidedAmount` Validation Missing
- **File:** `src/app/cases/[id]/billing-actions.ts:145-152`
- **Severity:** MEDIUM
- **Issue:** No validation that `decidedAmount <= promisedAmount`. The system allows setting Promised lower than Decided, violating accounting logic.

### 8.8 Auto-Band Config Unchecked Array Access
- **File:** `src/app/cases/[id]/actions.ts:206-207`
- **Severity:** MEDIUM
- **Issue:** Accesses `p.auto_band_config.bands` without verifying it's actually an array before calling `.find()`.

### 8.9 `user.roles.includes()` on Potentially Undefined
- **File:** `src/app/cases/[id]/actions.ts:188-193`
- **Severity:** HIGH
- **Issue:** `user.roles` could be `undefined` or `null` if the relationship fetch failed. Calling `.includes()` on it throws a `TypeError`.

---

## 9. CSV Import Issues

### 9.1 Naive Comma-Split Parsing
- **File:** `src/utils/csv.ts:24`
- **Severity:** HIGH
- **Issue:** `line.split(',')` doesn't handle:
  - Quoted fields: `"Smith, John",123` → splits into 3 columns instead of 2
  - Escaped quotes: `"He said ""hello""",456` → broken
  - CRLF line endings: Windows-generated CSVs may fail
- **Fix:** Use a proper CSV parsing library (e.g., `papaparse`).

### 9.2 Random Customer Code Generation — No Uniqueness
- **File:** `src/utils/csv.ts:34`
- **Severity:** MEDIUM
- **Issue:** `CUST-IMP-${Math.random()}` does not check for collisions. Under bulk import, duplicates are possible.
- **Fix:** Use `crypto.randomUUID()` or check uniqueness before insert.

### 9.3 Field Name Mapping Mismatch
- **File:** `src/utils/csv.ts:39-41`
- **Severity:** HIGH
- **Issue:** Code maps `obj.gstin` but the `PartyImportRow` type expects `gst_number`. Similarly `obj.pan` vs `pan_number`, `obj.city` vs `address`. All fields except `legal_name` and `customer_code` silently fail to map.

### 9.4 `"0"` and `"false"` Treated as Empty
- **File:** `src/utils/csv.ts:30`
- **Severity:** MEDIUM
- **Issue:** `if (values[i])` skips falsy strings like `"0"` or `"false"`. Should use `values[i] !== undefined && values[i] !== ''`.

### 9.5 Missing Legal Name Causes Silent "Unknown" Insert
- **File:** `src/utils/csv.ts:37`
- **Severity:** MEDIUM
- **Issue:** `legal_name: obj.legal_name || 'Unknown'` inserts garbage data instead of rejecting the row.

---

## 10. UI / Client Component Bugs

### 10.1 Shell.tsx — Hardcoded Role Dropdown
- **File:** `src/components/Shell.tsx:145-152`
- **Severity:** MEDIUM
- **Issue:** The role switcher dropdown has hardcoded role options that may not match the user's actual roles or the `USER_ROLES` constant.

### 10.2 Shell.tsx — No Loading State for Notifications
- **File:** `src/components/Shell.tsx:52-57`
- **Severity:** LOW
- **Issue:** Notifications load asynchronously but the UI shows "No notifications" immediately while loading.

### 10.3 PartyDialog — `editingParty` Typed as `any`
- **File:** `src/components/admin/PartyDialog.tsx:14`
- **Severity:** MEDIUM
- **Issue:** No type safety on the party object. Form fields may mismatch the actual data shape.

### 10.4 PartyDialog — No Client-Side Validation
- **File:** `src/components/admin/PartyDialog.tsx:20-35`
- **Severity:** MEDIUM
- **Issue:** No validation for GSTIN (15 chars), PAN (10 chars), or credit limit (positive number). Invalid data is sent to the server.

### 10.5 PartyDialog — Loading State Doesn't Disable Inputs
- **File:** `src/components/admin/PartyDialog.tsx:18, 87`
- **Severity:** LOW
- **Issue:** Only the submit button is disabled during submission. Users can still modify form fields.

### 10.6 Cases/New Page — Hardcoded Grade Options
- **File:** `src/app/cases/new/page.tsx:489-493`
- **Severity:** MEDIUM
- **Issue:** Grade options (1-5) are hardcoded instead of loaded from `grade_definitions`. If the policy changes the grading scale, the UI won't reflect it.

### 10.7 Cases/New Page — Unhandled Promise in useEffect
- **File:** `src/app/cases/new/page.tsx:77-94`
- **Severity:** MEDIUM
- **Issue:** The `load()` function inside `useEffect` calls `Promise.all` without a try-catch. Rejected promises are unhandled.

### 10.8 Login Page — No Password Strength Validation
- **File:** `src/app/login/page.tsx:20-46`
- **Severity:** LOW
- **Issue:** Sign-up only requires `minLength={6}`. No uppercase, number, or special character requirements.

### 10.9 Inconsistent Error Handling Pattern in Admin Actions
- **File:** `src/app/admin/actions.ts:17-50`
- **Severity:** MEDIUM
- **Issue:** `upsertParty` returns `{ success: false, error }` objects, while `deactivateParty` throws errors. Callers need to handle both patterns.

---

## 11. Test Coverage Gaps

### 11.1 No Tests for NULL/Undefined Inputs in Scoring
- **Files:** `src/utils/scoring.test.ts`, `tests/unit/scoring.test.ts`
- **Issue:** No tests for `null` customer_persona_id, empty task arrays, or `null` grade_value.

### 11.2 No Tests for Concurrent Operations
- **Issue:** No tests verify behavior when two users submit/update the same case simultaneously.

### 11.3 CSV Test Misses Edge Cases
- **File:** `src/utils/csv.test.ts`
- **Issue:** No tests for quoted fields, escaped commas, CRLF line endings, or empty rows.

### 11.4 E2E Tests Are Minimal
- **File:** `tests/e2e/basic.spec.ts`
- **Issue:** Only tests page title and login form presence. No tests for login flow, navigation, or protected routes.

### 11.5 Mock Supabase Builder Is Fragile
- **File:** `src/utils/engine.test.ts:25-77`
- **Issue:** Mock doesn't properly chain all builder methods. Tests may pass with the mock but fail with real Supabase.

### 11.6 Floating Point Tolerance Not Tested
- **File:** `tests/unit/engine.test.ts`
- **Issue:** `validateTranches` uses exact equality for percentage sum. Floating point `99.99999999` would be rejected. No tolerance tested.

### 11.7 Duplicate Test Files
- **Issue:** Tests exist in both `src/utils/*.test.ts` AND `tests/unit/*.test.ts` for the same modules (auth, engine, scoring). It's unclear which are authoritative.

---

## 12. Configuration & DevOps Issues

### 12.1 Missing `.env.example`
- **Severity:** MEDIUM
- **Issue:** No documentation of required environment variables. Developers must reverse-engineer from code:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 12.2 Dummy Supabase Key Fallbacks
- **Files:** `src/utils/supabase/client.ts:6`, `src/utils/supabase/server.ts:9`
- **Severity:** HIGH
- **Issue:** Both files fall back to `'dummy-key'` if the env var is missing. This silently creates a non-functional Supabase client that will fail on every query without a clear error.
- **Fix:** Throw an error at startup if env vars are missing.

### 12.3 Hardcoded `localhost:54321` Fallback
- **File:** `src/utils/supabase/client.ts:5`
- **Severity:** MEDIUM
- **Issue:** Falls back to `http://localhost:54321` if `NEXT_PUBLIC_SUPABASE_URL` is missing. In production, this causes CORS errors with no clear indication of the root cause.

### 12.4 `proxy.ts` — Inconsistent Env Var Checks
- **File:** `src/proxy.ts:12-18`
- **Severity:** MEDIUM
- **Issue:** Checks if `NEXT_PUBLIC_SUPABASE_URL` exists but uses non-null assertion (`!`) on the key without checking it. If the URL exists but the key doesn't, it passes `undefined` to the Supabase client.

### 12.5 Playwright baseURL Hardcoded
- **File:** `playwright.config.ts:27`
- **Severity:** LOW
- **Issue:** `baseURL: 'http://localhost:3000'` is hardcoded. CI/CD can't override for staging.
- **Fix:** `baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000'`.

### 12.6 `tsconfig.json` Excludes Test Files
- **File:** `tsconfig.json:33`
- **Severity:** LOW
- **Issue:** Test files are excluded from compilation, meaning TypeScript won't catch type errors in tests during `tsc` checks.

### 12.7 README Is Default Next.js Boilerplate
- **File:** `README.md`
- **Severity:** LOW
- **Issue:** Entire README is the default Next.js scaffold. No project-specific docs (architecture, setup, database seeding, running tests).

---

## 13. Data Integrity & Validation Gaps

### 13.1 No Transaction Boundaries in Multi-Step Operations
- **Files:** `src/utils/engine.ts` (submitCase), `src/app/policy/actions.ts` (publishDraftPolicy)
- **Issue:** Multiple related database writes are not wrapped in transactions. Partial failures leave data inconsistent.

### 13.2 Missing Check Constraints on JSONB Fields
- **File:** Schema
- **Issue:** `proposed_tranches`, `case_attributes`, `auto_band_config`, `context_rule` — all JSONB fields have no schema validation. Malformed JSON is accepted and causes runtime crashes.

### 13.3 Repayment Amount Has No Max Bound
- **File:** `supabase/migrations/phase2_billing_ledger.sql:17`
- **Issue:** `CHECK (amount > 0)` exists but no upper bound. A repayment larger than the case's total bill amount is accepted.

### 13.4 Tranche `days_after_billing` Allows Negative Values
- **File:** Schema
- **Issue:** No CHECK constraint. Negative days would mean billing before the invoice date.

### 13.5 `approved_credit_days` in `weight_matrices` Lacks NOT NULL
- **File:** `supabase/migrations/20260323000000_complete_v1_schema.sql:167`
- **Issue:** Can be NULL, which would cause NaN in scoring calculations.

---

## 14. Summary Matrix

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 2 | 3 | 1 | — | **6** |
| Auth & Authz | 2 | 3 | 3 | — | **8** |
| Scoring Logic | — | 3 | 4 | 1 | **8** |
| Database Schema | — | 2 | 5 | 2 | **9** |
| Error Handling | — | 5 | 2 | 1 | **8** |
| Incomplete Features | — | 8 | 4 | 2 | **14** |
| Policy Module | — | 3 | 4 | 3 | **10** |
| Case & Billing | — | 2 | 5 | 1 | **8** |
| CSV Import | — | 2 | 3 | — | **5** |
| UI / Components | — | — | 5 | 4 | **9** |
| Tests | — | — | 4 | 3 | **7** |
| Config / DevOps | — | 1 | 3 | 3 | **7** |
| Data Integrity | — | 1 | 3 | 1 | **5** |
| **TOTAL** | **4** | **33** | **46** | **21** | **104** |

### Priority Action Items

**Immediate (do now):**
1. Delete `test_supabase.js` and rotate the exposed Supabase secret key
2. Fix `admin/actions.ts` missing imports (`hasAnyRole`, `isAdmin`) — causes runtime crash
3. Change `getImpersonationRole()` default from `founder_admin` to least-privileged role
4. Add role-based RLS policies to replace blanket `authenticated` checks

**Short-term (this sprint):**
5. Add try-catch around all `.single()` calls in `engine.ts` and `scoring.ts`
6. Wrap `submitCase()` in a database transaction
7. Fix inverted PDCR calculation
8. Fix CSV parser to handle quoted fields (or use `papaparse`)
9. Fix form dialogs to wait for server confirmation before closing
10. Remove `'dummy-key'` fallbacks; throw on missing env vars

**Medium-term (next sprint):**
11. Implement routing thresholds in `progressStage()`
12. Implement validity rule expiry checks
13. Wire up board override logic to actually affect approved days
14. Add audit logging to all policy mutation actions
15. Implement the `runSimulation` server action properly
16. Fix `handleToggleWaiting` inverted logic
17. Add proper indexes on FK columns

**Backlog:**
18. Replace `dangerouslySetInnerHTML` with safe renderer
19. Implement conditional rules in task generation
20. Add optimistic concurrency (version checks) to case updates
21. Improve test coverage (CSV edge cases, concurrent ops, E2E flows)
22. Write actual project README with setup instructions



# Codebase Audit — Credit Scoring System (main branch)
*Audited: 2026-04-02 | Reviewer: Antigravity*

---

## Executive Summary

The codebase is in a **partially functional Phase 2 state**. Core credit-case lifecycle (create → review → approve) is solid. The Phase 2 Billing & Ledger module is newly merged but has multiple logic gaps, no DB trigger for `actual_bill_amount`, and a number of abandoned/vestigial artifacts. RBAC has inconsistencies. Several features are wired up in the UI but are dead-ends on the backend.

---

## 🔴 BUGS (will cause runtime errors or incorrect behavior)

### B-01 · `handleSaveBillingDetails` doesn't update `actual_bill_amount`
**File:** `src/app/cases/[id]/billing-actions.ts` — `handleSaveBillingDetails`

When billing details are saved, three columns are written: `billing_date`, `decided_bill_amount`, `promised_bill_amount`, and `status = 'Billing Active'`. The column `actual_bill_amount` is **never initialized to 0**. If the DB column has no default value, all downstream math (margin, collect%, PDCR) will silently use `null`, producing `NaN` or wrong results.

**Root cause:** The billing action assumes a DB default of `0` on `actual_bill_amount` but no migration confirms this. The migration SQL (`supabase/migrations/phase2_billing_ledger.sql`) must be verified.

---

### B-02 · `actual_bill_amount` not updated after repayment — relies on missing DB trigger
**File:** `src/app/cases/[id]/billing-actions.ts` — `handleLogPayment` (L284)

Comment says: *"Trigger already ran, re-fetch"*. However, **no trigger is defined** in the Phase 2 migration SQL (or if it is, it must be verified). The code re-reads `actual_bill_amount` expecting the DB to have already summed repayments. If the trigger doesn't exist, `actual_bill_amount` never updates and `checkAndCloseCase` always evaluates against stale/zero values — so auto-close never fires.

---

### B-03 · `handleDeletePayment` doesn't recalculate `actual_bill_amount`
**File:** `src/app/cases/[id]/billing-actions.ts` — `handleDeletePayment` (L418)

After a payment is deleted, the code only checks `if status === 'Closed' && actual < promised` to revert back to `Billing Active`. It does **not recalculate** `actual_bill_amount`. If the trigger doesn't sum repayments on delete, the running total will be wrong indefinitely.

---

### B-04 · Billing lock logic is wrong — `isLocked` is computed from repayment count but editing requires count = 0
**File:** `src/app/cases/[id]/billing-actions.ts` — `fetchLedgerData` (L117)

```ts
isLocked: (repayments?.length ?? 0) > 0,
```

And in `handleSaveBillingDetails` (L163):
```ts
if ((count ?? 0) > 0) throw new Error('Billing details are locked...')
```

Both are consistent, BUT the `LedgerTab.tsx` shows an **Edit button** whenever `!billing.isLocked && isRm && !isClosed`. If even one payment exists, edit is hidden correctly. However **once billing is locked** (payment logged), the RM has no way to correct billing amounts except via a Credit Note — but Credit Notes only reduce `promised_bill_amount`, not `decided_bill_amount`. There's no mechanism to fix a wrong `decided_bill_amount` post-lock.

---

### B-05 · `handleApprovalDecision` queries `approval_decisions` twice for the same data
**File:** `src/app/cases/[id]/actions.ts` — `handleApprovalDecision` (L414, L431)

After inserting a decision and then checking `allApproved`, the code fetches the same `approval_decisions` table **twice**:
- Lines 414–419: to close the round
- Lines 431–435: to send notification

The second fetch happens unconditionally after the first. This is a race condition and a wasted DB call. The second fetch could also return a slightly different dataset if another approver acts in between.

---

### B-06 · `upsertParty` in admin/actions.ts uses `hasAnyRole` before importing it
**File:** `src/app/admin/actions.ts` (L21, L159)

`hasAnyRole` and `isAdmin` are called at **line 21** inside `upsertParty` but are only *imported* at **line 159** (the import statement is at the bottom of the file). In a module system this works because imports are hoisted, but it is a guaranteed source of confusion and future bugs if the file is refactored. This is technically functioning today but is an anti-pattern that could break with transpilation changes.

---

### B-07 · `handleForceReadyStage` is wired in `CaseWorkspace.tsx` import but the button has been removed from the UI
**File:** `src/app/cases/[id]/CaseWorkspace.tsx`

`handleForceReadyStage` is imported on line 21 but there is no render path in the current UI that ever calls it. The `showForceReady` state is declared (L68) and `isAwaitingInput` is defined (L70), but neither is used in the JSX anywhere. The Force Ready feature is **dead code** in the current main branch.

---

### B-08 · `handleToggleWaiting` and `handleSaveOutcome` are imported but never rendered
**File:** `src/app/cases/[id]/CaseWorkspace.tsx` (L21–22)

`handleToggleWaiting` and `handleSaveOutcome` are both imported but 0 UI elements call them. The `handleSaveOutcome` action still exists and the `realized_outcomes` table query runs in `fetchCaseDetail` (only on `status === 'Closed'`) but there's no form/button anywhere in the current CaseWorkspace or its tabs to call it. The Realized Outcomes section was explicitly commented out (L442).

---

### B-09 · `yes_no` input type in `CaseWorkspace` task rendering falls through to wrong branch
**File:** `src/app/cases/[id]/CaseWorkspace.tsx` (L537–563)

The scoring task form has:
```tsx
if (input_type === 'grade_select' || input_type === 'yes_no') → grade select
else if (input_type === 'dropdown' || input_type === 'link_list') → dropdown
else → text/numeric input
```

But in `new/page.tsx` Step 5 (L475–513), `yes_no` is handled in **two different branches**:
- First branch: `grade_select || yes_no` → grade value select (correct)
- Second branch: `link_list || yes_no` → raw_input_value select (this branch also matches `yes_no`)

This means a `yes_no` task in the intake wizard hits **line 475** and renders grade select (1/2/3/4/5 + Yes/No options), but then at **line 497** the `else if (link_list || yes_no)` also catches it. The condition ordering prevents the double-render but the logic is inconsistent between the intake form and the CaseWorkspace. A `yes_no` task in CaseWorkspace returns `gradeValue: 0 or 1` while the intake step maps to `raw_input_value: "Yes"/"No"`.

---

### B-10 · `handleRestructureTranches` — UI to invoke it doesn't exist in LedgerTab
**File:** `src/app/cases/[id]/billing-actions.ts` (L629), `src/app/cases/[id]/LedgerTab.tsx`

`handleRestructureTranches` is imported at the top of `LedgerTab.tsx` (L23) but **there is no UI element** anywhere in `LedgerTab.tsx` that renders a tranche restructure form or calls this function. Dead import + dead backend action. The tranche waterfall is read-only display only.

---

### B-11 · `handleCancelBilling` state conflict — button condition is self-contradictory
**File:** `src/app/cases/[id]/LedgerTab.tsx` (L525)

```tsx
{isKam && (billingActive || pendingWriteOff) && repayments.length > 0 && !pendingWriteOff && (
```

This evaluates `(billingActive || pendingWriteOff)` AND then `!pendingWriteOff`. So the condition simplifies to `isKam && billingActive && repayments.length > 0`. But the **cancel button** (`handleCancelBilling`) is supposed to appear only when `repayments.length === 0` (per the backend guard). The **"Mark as Settled / Close"** button (which calls `handleAttemptClose`) shows only when `repayments.length > 0`, and that's correct. The `Cancel / Abort Order` button correctly shows at L694 only when `repayments.length === 0`. So the condition at L525 is for the "Settle/Close" button — but it says `repayments.length > 0 && !pendingWriteOff` which silently hides the button during write-off approval, even though it should still be possible to log more payments. This is a logic gap rather than a crash.

---

## 🟡 INCOMPLETE FEATURES (wired partially, not functional end-to-end)

### I-01 · Contractor Reputation Module is a static checklist — not integrated
**File:** `src/app/cases/[id]/LedgerTab.tsx` (L649–691)

The "Contractor Reputation Checks" card displays 3 hardcoded ground-truth instructions. There is **no form, no data entry, no storage, no scoring integration**. It's a read-only reference panel. The Phase 2 plan described this as a scored module that should feed back into the credit decision — it doesn't.

---

### I-02 · `handleSaveOutcome` / Realized Outcomes — UI removed but backend active
**File:** `src/app/cases/[id]/actions.ts` (L442–484), `src/app/cases/[id]/CaseWorkspace.tsx` (L442 comment)

The action and DB query for `realized_outcomes` still run but the UI card was explicitly commented out with `{/* Realized Outcome — superseded by Ledger & Billing tab */}`. The outcome recording flow (deal happened, payment on time, delay days, realized exposure) is an **orphaned action** — the only way to call it is by POSTing directly.

---

### I-03 · `clearAllNotifications` never wired in UI
**File:** `src/components/actions.ts` (L29–37)

`clearAllNotifications` is defined as a server action but there is no button or form in `Shell.tsx` or anywhere else that calls it. The notification panel has only per-item mark-as-read.

---

### I-04 · `handleToggleWaiting` — SLA pause not connected to UI
**File:** `src/app/cases/[id]/actions.ts` (L287–313)

The waiting state is important for SLA management but the CaseWorkspace has no UI panel to toggle it. The `isAwaitingInput` and `showWaitReason` state are declared but never used in JSX. This means a case can never be put into `Awaiting Input` state from the UI.

---

### I-05 · `handleForceReadyStage` — Force-Ready workflow is completely missing from UI
**File:** `src/app/cases/[id]/actions.ts` (L235–285), `src/app/cases/[id]/CaseWorkspace.tsx`

The ability to force-ready a stage (bypassing incomplete tasks and marking ambiguous) is designed in the backend but the UI panel was removed. KAMs cannot force-ready stages.

---

### I-06 · Tranche Restructure UI missing
**File:** `src/app/cases/[id]/billing-actions.ts` (L629–677)

`handleRestructureTranches` validates extension days against `MAX_TRANCHE_EXTENSION_DAYS` system setting. But there is no UI panel in LedgerTab to actually restructure tranches. The system setting is also configured but cannot be exercised.

---

### I-07 · `handleAttemptClose` ("Mark as Settled") is unreachable when `pendingWriteOff`
**File:** `src/app/cases/[id]/LedgerTab.tsx` (L525)

The "Mark as Settled / Close" button is conditionally rendered:
```tsx
{isKam && (billingActive || pendingWriteOff) && repayments.length > 0 && !pendingWriteOff && ...}
```

The `!pendingWriteOff` at the end negates the `pendingWriteOff` from the first clause. So in `Pending Write-Off Approval` state, KAM **cannot** attempt to close or log additional payments that might bring it back to threshold. Only Admin can approve/reject via `handleWriteOffApproval`.

---

### I-08 · Party search in Admin panel is not client-side filtered (limit 100 only)
**File:** `src/app/admin/actions.ts` — `fetchParties` (L9–15)

`fetchParties` fetches max 100 parties. When there are more than 100 parties, the party selector in "New Credit Case" and Admin panel will be **missing parties**. There is a search param wired but it is never called from the case creation UI — only the 100-record flat list is used.

---

### I-09 · `handleChangePersona` uses raw text inputs (UUIDs) — not user-friendly
**File:** `src/app/cases/[id]/CaseWorkspace.tsx` (L242–244)

The Change Persona form shows three raw text inputs for `customerPersonaId`, `contractorPersonaId`, and `dominanceCategoryId`. Users are expected to type or paste UUIDs. There's no dropdown populated from the database. This makes the feature essentially unusable for non-technical users.

---

### I-10 · CSV Import doesn't support `party_type`, `city`, `credit_limit` columns
**File:** `src/utils/csv.ts` (L36–43)

The CSV import dialog shows expected columns: `legal_name, customer_code, party_type, gstin, pan, city, credit_limit`. But `parsePartiesCsv` only extracts `legal_name`, `customer_code`, `gstin`, `pan`, and maps `city → address`. Items **`party_type`** and **`credit_limit`** are silently dropped. The `PartyImportRow` interface doesn't even have these fields. This will cause data loss on bulk imports.

---

### I-11 · Routing Preview in New Case Wizard only checks first matching rule
**File:** `src/app/cases/new/page.tsx` — `expectedStage()` (L218–225)

The routing preview logic only checks `exposure_min` from one context rule field and returns the first match. It does not evaluate other fields like `case_scenario`, `deal_size_bucket`, or `product_category` that the `routing_thresholds` table might contain. The preview stage number is likely inaccurate for complex routing rules.

---

## 🗑️ ABANDONED / LEFTOVER ARTIFACTS

### A-01 · `CaseWorkspace.tsx.orig` and `CaseWorkspace.tsx.rej`
**Path:** `src/app/cases/[id]/CaseWorkspace.tsx.orig`, `CaseWorkspace.tsx.rej`

These are leftover **patch artifacts** from a failed `git apply / patch` operation. `.orig` is the pre-patch backup (43kb) and `.rej` is the rejected diff hunks. These reference a more complex version of CaseWorkspace with `pendingRevision`, `isRm`, revision workflows, and `Approved_Conditionally` status that no longer exist in the current file. **These should be deleted** — they are not part of the actual application.

---

### A-02 · `page.tsx.orig` in `src/app/cases/new/`
**Path:** `src/app/cases/new/page.tsx.orig`

Same issue — a pre-patch backup of the new case page. Should be deleted.

---

### A-03 · `sqlite.db` in project root
**Path:** `sqlite.db`

A local SQLite database file in the project root. The app uses Supabase (PostgreSQL). This is likely a leftover from early local prototyping and should be gitignored and deleted.

---

### A-04 · `test_supabase.js` in project root
**Path:** `test_supabase.js`

A raw Node.js test script that was not cleaned up. 14+ similar scripts (`test_db7.js` through `test_db18.js`) were deleted in the latest pull but this one remains.

---

### A-05 · `CLAUDE.md` is empty
**Path:** `CLAUDE.md`

Contains only 12 bytes of content (presumably a blank file or a newline). Should be populated or removed.

---

### A-06 · `src/proxy.ts` — purpose unclear
**Path:** `src/proxy.ts` (1578 bytes)

Not imported from any route or component in the codebase. It likely wraps a Supabase client for some special context but is not used. Needs investigation.

---

### A-07 · Imported but unused: `handleToggleWaiting`, `handleSaveOutcome`, `handleForceReadyStage`
**File:** `src/app/cases/[id]/CaseWorkspace.tsx` (L20–22)

Three server actions are imported but never referenced in JSX. This causes unnecessary bundle weight and confusion.

---

### A-08 · `showWaitReason`, `showForceReady`, `isAwaitingInput` states are declared but unused
**File:** `src/app/cases/[id]/CaseWorkspace.tsx` (L68–70)

```tsx
const [showForceReady, setShowForceReady] = useState<number | null>(null);
const [showWaitReason, setShowWaitReason] = useState(false);
const isAwaitingInput = c.status === 'Awaiting Input';
```

None of these are used anywhere in the JSX. They are pure dead state declarations.

---

### A-09 · `handleSaveOutcome` action still present, outcome card commented out
**File:** `src/app/cases/[id]/CaseWorkspace.tsx` (L442)

```tsx
{/* Realized Outcome — superseded by Ledger & Billing tab */}
```

The comment says it's superseded, but there's no equivalent outcome recording in the Ledger tab either. The feature is in limbo.

---

### A-10 · `canGoNext(4)` always returns `true` — Step 4 "Continue" is never blocked
**File:** `src/app/cases/new/page.tsx` (L214)

```ts
if (currentStep === 4) return true;
```

Step 4 contains "Strategic Justification *" marked as required but the validation always passes. The justification field is optional in practice.

---

## 🔒 RBAC & SECURITY ISSUES

### R-01 · Role impersonation is client-side cookie only — no server enforcement
**File:** `src/utils/auth-actions.ts` (L12–27), `src/components/Shell.tsx` (L138–154)

The `impersonated_role` cookie is set client-side by any user and is read back and trusted in both the dashboard and CaseWorkspace to show/hide UI elements. However, **server actions use the actual Supabase auth user roles** for authorization (`hasAnyRole` from `auth.ts`), not the cookie. So while the UI hides buttons correctly, if a user manually POSTs a FormData to a server action with a mis-matched role, the actual auth guard on the server will catch it. This is fine — but the cookie impersonation pattern could confuse future developers into thinking the cookie IS the authoritative role check.

---

### R-02 · `adminCreateUser` uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` as fallback for Service Role Key
**File:** `src/app/admin/actions.ts` (L177)

```ts
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';
```

If `SUPABASE_SERVICE_ROLE_KEY` is not set, the admin client falls back to the **public anon key**. Admin user creation with a public key will fail silently or create a user without proper privileges. The `NEXT_PUBLIC_` prefix also means this key is exposed to the browser — which is correct for anon keys but wrong if it ever gets mixed up with the service role key.

---

### R-03 · `handleSelectiveUnlock` logs an audit event but makes NO database change
**File:** `src/app/cases/[id]/actions.ts` (L500–519)

```ts
// Only logs to audit, no actual DB mutation
await logAuditEvent({...});
revalidatePath(`/cases/${caseId}`);
```

The Selective Unlock feature has no implementation — it only creates an audit trail. No status flag, no section-level lock column in the DB is changed. The form shows the user a "Section unlocked" confirmation but nothing was actually changed.

---

### R-04 · Admin user deletion has no confirmation or guard against self-deletion
**File:** `src/app/admin/AdminClient.tsx` (L234–239)

The delete user button submits immediately with no `confirm()` dialog and no check to prevent an admin from deleting their own account.

---

## 🎨 UI/UX ISSUES

### U-01 · "Operator" is hardcoded as the username in the sidebar
**File:** `src/components/Shell.tsx` (L132)

```tsx
<p className="text-sm font-medium text-foreground truncate">Operator</p>
```

The actual logged-in user's name is never shown. The `getCurrentUser()` call happens in server context; the Shell is a client component that doesn't receive the user profile as a prop.

---

### U-02 · Both "Admin" and "System Settings" nav items use the same `Settings` icon
**File:** `src/components/Shell.tsx` (L36–38)

```tsx
{ href: '/admin', label: 'Admin', icon: Settings },
{ href: '/settings', label: 'System Settings', icon: Settings },
```

Both nav items are visually identical. Different icons should be used (e.g., `Shield` for Admin, `Settings` for System).

---

### U-03 · Party table in Admin shows `city` and `Credit Limit` columns but data comes from `address` and `credit_limit` fields that aren't in the party form
**File:** `src/app/admin/AdminClient.tsx` (L129–130)

```tsx
<TableCell>{p.city || '—'}</TableCell>
<TableCell>{p.credit_limit ? ...}</TableCell>
```

The party form (`upsertParty`) constructs `address` from `city + state` but stores it as `address` (a combined string). The table reads `p.city` which is a different DB column. Same for `credit_limit` — the upsert form doesn't include a credit limit field, so it's always `—`.

---

### U-04 · `LedgerTab` Billing Frame shows "Locked — payments recorded" badge even when there are no payments (race condition on initial render)
**File:** `src/app/cases/[id]/LedgerTab.tsx` (L193–195)

The `isLocked` state is computed server-side at page load. If repayments are added and deleted rapidly, the "locked" badge may appear before the parent page re-fetches. Minor but visible during quick operations.

---

### U-05 · Dashboard stats grid shows 6 cards in a `grid-cols-3` layout — always 2 rows, Parties and Billing side-by-side at the bottom. Drafts count is hidden
**File:** `src/app/page.tsx` (L290)

The stats array includes `Drafts` but only 6 items are shown in a 3-col grid. The `Drafts` value is fetched but the stat card is **not in the stats array** — the query runs but the count is discarded. `drafts` is fetched and destructured at L192 but never displayed.

---

## 📉 PERFORMANCE / ARCHITECTURE CONCERNS

### P-01 · `fetchCaseDetail` makes 8+ sequential and parallel DB calls — no caching
**File:** `src/app/cases/[id]/actions.ts` (L10–105)

Every page load fires: case detail, customer exposure, customer history, contractor exposure, contractor history, maybe outcome, review cycle, tasks, audit events, approval rounds, comments, users list, AND ledger data (which itself fires 3 more calls). This is **~13 Supabase round trips** per case page load. Some are parallelized but many are sequential.

---

### P-02 · `computeRmPortfolioMetrics` in `page.tsx` does in-memory JS waterfall allocation instead of a DB aggregation
**File:** `src/app/page.tsx` (L13–147)

The PDCR calculation downloads all repayments for all of an RM's billing-active cases into the server process and allocates them in JavaScript. This is fine for small portfolios but will be very slow (and hit memory limits) at scale. This logic should be a Supabase RPC / materialized view.

---

### P-03 · `updateCycleScore` is called after every single task completion — N+1 scoring recalculations
**File:** `src/app/cases/[id]/actions.ts` (L226–230), `src/utils/scoring.ts` (L285–315)

After each task is completed, `updateCycleScore` recalculates the entire cycle score from scratch (querying all tasks, weight matrices, dominance category, stage max totals). This is correct but expensive. With 20–30 tasks per cycle, each completion triggers O(N) DB queries. No debouncing or batching.

---

## Summary Table

| # | Type | Area | Severity |
|---|------|------|----------|
| B-01 | Bug | Billing — actual_bill_amount not initialized | 🔴 High |
| B-02 | Bug | Billing — missing DB trigger for amount aggregate | 🔴 High |
| B-03 | Bug | Billing — delete payment doesn't update total | 🔴 High |
| B-04 | Bug | Billing — decided_bill_amount uncorrectable post-lock | 🟠 Medium |
| B-05 | Bug | Approvals — double DB fetch / race condition | 🟡 Low |
| B-06 | Bug | Admin — import used before import statement | 🟡 Low |
| B-07 | Bug | UI — Force Ready is dead code with live imports | 🟠 Medium |
| B-08 | Bug | UI — ToggleWaiting + SaveOutcome dead imports | 🟠 Medium |
| B-09 | Bug | UI — yes_no task type inconsistency | 🟠 Medium |
| B-10 | Bug | UI — handleRestructureTranches dead import | 🟡 Low |
| B-11 | Bug | UI — Settle button hidden during write-off state | 🟠 Medium |
| I-01 | Incomplete | Contractor Reputation — no data model | 🔴 High |
| I-02 | Incomplete | Realized Outcomes — orphaned action | 🟠 Medium |
| I-03 | Incomplete | Notifications — clearAll not wired | 🟡 Low |
| I-04 | Incomplete | SLA — Waiting toggle not in UI | 🟠 Medium |
| I-05 | Incomplete | KAM — Force Ready missing from UI | 🟠 Medium |
| I-06 | Incomplete | Billing — Tranche Restructure UI missing | 🟠 Medium |
| I-07 | Incomplete | Billing — Settle button unreachable in Write-Off state | 🟠 Medium |
| I-08 | Incomplete | Admin — Party list capped at 100 | 🟡 Low |
| I-09 | Incomplete | Persona Change — UUID text inputs | 🟠 Medium |
| I-10 | Incomplete | CSV Import — party_type & credit_limit dropped | 🟠 Medium |
| I-11 | Incomplete | New Case — routing preview inaccurate | 🟡 Low |
| A-01 | Abandoned | .orig/.rej patch files in repo | 🟡 Low |
| A-02 | Abandoned | page.tsx.orig in new/ | 🟡 Low |
| A-03 | Abandoned | sqlite.db in project root | 🟡 Low |
| A-04 | Abandoned | test_supabase.js in root | 🟡 Low |
| A-05 | Abandoned | CLAUDE.md is empty | 🟡 Low |
| A-06 | Abandoned | src/proxy.ts unused | 🟡 Low |
| A-07 | Abandoned | 3 dead imports in CaseWorkspace | 🟡 Low |
| A-08 | Abandoned | 3 dead state declarations in CaseWorkspace | 🟡 Low |
| A-09 | Abandoned | Realized Outcome card commented out (limbo) | 🟠 Medium |
| A-10 | Abandoned | canGoNext(4) always returns true | 🟡 Low |
| R-01 | RBAC | Impersonation cookie only — no server trust issue but misleading | 🟡 Low |
| R-02 | Security | adminCreateUser falls back to public anon key | 🔴 High |
| R-03 | Security | Selective Unlock logs audit but makes NO DB change | 🔴 High |
| R-04 | Security | Delete user has no self-deletion guard | 🟠 Medium |
| U-01 | UX | "Operator" hardcoded in sidebar | 🟠 Medium |
| U-02 | UX | Admin + Settings nav use same icon | 🟡 Low |
| U-03 | UX | Party table shows city/credit_limit fields that are never populated | 🟠 Medium |
| U-04 | UX | Ledger lock badge may be stale | 🟡 Low |
| U-05 | UX | Drafts count fetched but never displayed | 🟡 Low |
| P-01 | Perf | Case detail page: 13+ DB calls per load | 🟠 Medium |
| P-02 | Perf | PDCR computed in-memory JS | 🟠 Medium |
| P-03 | Perf | Score recalculated on every task completion | 🟡 Low |
