# Credit Scoring System - Feature Audit Report

This report documents the findings from a feature-by-feature audit of the Credit Scoring System codebase.

## 1. Core Architecture & Authentication
### [BUG] User Role Inconsistency
- **Finding**: There is a discrepancy between defined roles in `src/utils/auth.ts` and the UI role management in `src/app/admin/AdminClient.tsx`.
- **Details**: 
    - `auth.ts`: `rm`, `kam`, `accounts`, `bdo`, `ordinary_approver`, `board_member`, `founder_admin`.
    - `AdminClient.tsx`: `founder_admin`, `system_admin`, `rm`, `kam`, `reviewer`, `approver`, `board_member`.
- **Impact**: Role assignments via the Admin panel may result in users having "phantom" roles that aren't recognized by the backend logic or impersonation system.

### [GAP] Weak Error Feedback in Admin Forms
- **Finding**: Admin actions (User creation, Party upsert) use Server Actions but don't implement robust error feedback to the UI.
- **Details**: If `adminCreateUser` fails (e.g., email already exists), the user sees no feedback unless a generic `alert` or error page is triggered (which is missing in many forms).

---

## 2. Dashboard Feature
### [BUG] Incomplete "Awaiting Approval" Stats
- **Finding**: The dashboard counts cases where `status = 'Awaiting Approval'` but misses those in `Appealed` status.
- **Details**: Per `src/app/cases/[id]/actions.ts`, an appeal sets the status to `Appealed`. These should likely be included in the "Awaiting Approval" bucket on the dashboard.

---

## 3. Case Management
### [CRITICAL LOGIC DRIFT] Scoring Discrepancies
- **Finding**: The "Live Score" shown in the `CaseWorkspace` UI differs mathematically from the backend scoring engine.
- **Details**:
    - **UI (`CaseWorkspace.tsx`)**: Calculates a simple average of completed stage scores.
    - **Backend (`scoring.ts`)**: Uses policy-defined `stage_max_totals` to normalize scores and handles `dominance_matrix` logic (Power Law, Weighted, etc.).
- **Impact**: Users see a different score in the workspace than what is officially recorded in the `review_cycles` table.

### [BUG] Approval Logic Vulnerability
- **Finding**: `handleApprovalDecision` approves a round as soon as the *last* action is 'approve', provided all existing actions are 'approve'.
- **Details**: If a case requires both an Ordinary Approver and a Board Member, but only one has acted (and approved), the system might prematurely mark the round as "Approved" depending on how many decision rows are expected. Currently, it doesn't check against a "Required Approvers" count.

### [UI/UX] New Case Wizard Validation
- **Finding**: The multi-step wizard in `src/app/cases/new/page.tsx` allows navigation between steps without validating the current step's required fields.
- **Details**: Users can click "Step 4" directly and try to submit, only then seeing errors.

---

## 4. Policy Engine
### [DESIGN GAP] Mid-Cycle Persona Changes
- **Finding**: The "Change Personas" action in `CaseWorkspace` allows updating a cycle to use any Persona ID.
- **Details**: It doesn't verify if the new Persona belongs to the same `policy_snapshot_id` linked to the cycle. This could lead to a mix of parameters from different policy versions.

### [BUG] Version Labeling
- **Finding**: `createNewDraft` in `policy/actions.ts` calculates the version label simply as `v{count+1}.0`.
- **Details**: If a user creates multiple drafts, the labeling might become confusing or duplicate labels if counts don't reflect unique identifiers correctly.

---

## 5. Global Utilities
### [GAP] Missing SLA Logic
- **Finding**: While the code maintains `is_waiting` flags to "pause SLA", there is no actual service level agreement timer or reporting logic implemented.
- **Impact**: The "Wait" functionality currently only acts as a status label without affecting any business outcomes or alerts.

### [LOGIC DRIFT] Composite Credit Days
- **Finding**: Calculation for Composite Credit Days is duplicated in `src/utils/engine.ts` (backend) and `src/app/cases/new/page.tsx` (client).
- **Risk**: Any change to the formula in one place must be manually synced to the other, making it prone to "drift" bugs.

---

## Recommendations
1. **Centralize Roles**: Consolidate roles into a single source of truth (likely the DB schema/Auth util).
2. **Unified Scoring**: Move all score calculations to `scoring.ts` and have the UI fetch/trigger the backend calculation instead of doing it ad-hoc.
3. **Strict Validation**: Add Zod validation to Server Actions and display validation errors inline.
4. **Approval Thresholds**: Implement a `required_approvals` count or role-check in the approval round logic.
