# Credit Issuance App

A robust, enterprise-grade Next.js application designed to facilitate structured, auditable reactive credit decision processes. The primary goal of this application is to lower credit risk by replacing informal, relationship-driven credit issuance with a disciplined policy engine and strict workflow logic.

This repository implements the complete lifecycle of credit issuance—from intake and risk scoring (Phase 1) to comprehensive billing, repayment ledgers, margin tracking, and write-off governance (Phase 2).

This guide serves as a comprehensive manual for developers, AI agents, and business stakeholders to deeply understand the architecture, domain logic, data models, and local setup of the project.

---

## 🏗️ Technical Architecture & Stack

The application is built on modern web infrastructure:
- **Framework:** Next.js (experimental Turbopack enabled, `experimental.authInterrupts` enabled, and explicit `dynamic: 0` stale-time routing overrides to prevent cache delays).
- **Language:** TypeScript.
- **Backend & Database:** Supabase (PostgreSQL). The app relies heavily on Row-Level Security (RLS) policies, database triggers, and frozen policy schemas.
- **Authentication:** `@supabase/ssr` with email confirmation natively required.
- **Styling:** Tailwind CSS + shadcn/ui. Explicit semantic tokens (e.g. `bg-card`, `text-muted-foreground`) are enforced over hard-coded colors to support dark-mode themes.
- **Visual Verification & E2E Testing:** Python Playwright scripts.
- **Unit Testing:** Vitest (Tests colocated next to source files).

---

## 📚 Core Domain Glossary

* **Credit Case:** The overarching record of a commercial request. It transitions through lifecycle phases like "Draft", "In Review", "Billing Active", and "Pending Write-Off Approval".
* **Review Cycle:** A specific evaluation round mapped to a frozen "Policy Snapshot". Cases can have multiple review cycles over time if parameters significantly change.
* **Party:** The business entity. A case has exactly one *Customer* and an optional *Contractor*.
* **Tranche:** A structured payment component (amount + due date) forming the total invoice.
* **Decided Bill Amount:** The total nominal value of the transaction. Used to calculate the profit margin.
* **Promised Bill Amount:** The agreed baseline for repayments. Used to calculate collection rates.
* **PDCR (Promised Day Collection Rate):** A metric (by count, amount, and weighted-days) evaluating post-approval debt collection efficiency.

---

## 🗄️ Database Schema & Storage

The entire database configuration, RLS rules, and core table declarations are defined via strict migration files (specifically `supabase/migrations/20260323000000_complete_v1_schema.sql`).

### Key Tables
1. **`credit_cases`**: The root transaction log holding business identifiers, the billing date, actual/decided/promised amounts, and dynamic `case_status`.
2. **`review_cycles` & `cycle_policy_snapshots`**: Links cases to a frozen snapshot of admin-defined risk weights and scores to maintain deterministic historical audits.
3. **`parameter_definitions`**: The atomic units of risk scoring. Explicitly constrained to types like `grade_select`, `numeric`, `yes_no`, etc.
4. **`repayments` (Phase 2)**: An immutable ledger appending extracted funds. Payments dynamically "waterfall" into tranches via code, ensuring chronological priority without overwriting historical actions.
5. **`credit_notes` (Phase 2)**: Authorized reductions to the Promised Amount when field losses occur. Prevents sales staff from secretly shifting goalposts.
6. **`system_settings` (Phase 2)**: A dictionary for non-hardcoded business metrics like `MAX_TRANCHE_EXTENSION_DAYS` and `WRITE_OFF_SLIPPAGE_PERCENTAGE`.
7. **`audit_events`**: An immutable insertion table that natively logs field-level diffs, changes, and sensitive views.

*Important Note:* Administrators manage business values (thresholds, score bands) in the database via the admin UI. Code only interprets mechanics; it does not hardcode business constants.

---

## 🔐 Role-Based Access Control (RBAC)

The system relies on fixed, pre-defined user roles attached via the `user_roles` table, checked universally in Next.js Server Actions utilizing the `SUPABASE_SERVICE_ROLE_KEY` to securely bypass RLS for systemic validation.

* **RM (Relationship Manager):** Originates the deal. Sets Decided/Promised amounts. Once the first repayment is logged, their access strictly reverts to `READ-ONLY` to prevent ledger manipulation.
* **KAM (Key Account Manager):** Owns execution. Handles intake adjustments, selects risk Personas, and operates the `repayments` ledger.
* **Founder/Admin:** System governance. Solely authorized to publish new Policy Versions, merge Party duplicate identities, approve Credit Notes, and manually resolve "Pending Write-Off Approvals".
* **BDO / Accounts / Ordinary Approver:** Participants constrained to specific review stages. BDO provides qualitative input, Accounts validates financial artifacts, and Approvers hold pass/fail capabilities within frozen "Approval Rounds".

---

## ⚙️ Core Application Workflows

### 1. The Reactive Case Workflow (Phase 1)
1. **Intake:** The RM drafts the case, establishing Customer/Contractor, Scenario (e.g., "Customer Pays"), and requested Exposure versus Bill Amount.
2. **Scoring Engine Execution:** A parallelized calculation normalizes weights across multiple evaluation dimensions:
   - Evaluates *Customer* & *Contractor* independently based on admin matrices.
   - Outputs Stage 1, Stage 2, and Stage 3 progressive cumulative scores.
   - Determines deterministic ambiguity if critical rules miss or thresholds trigger.
3. **Approvals & Board Logic:** KAM delegates to ordinary Approvers. Rejections fail the round instantly. Edge-case escalations enter a formal "Appeal" or "Ambiguity Review" queue governed by a 7-person Board voting system.

### 2. Billing & Repayment Ledgers (Phase 2)
1. **The Lock Point:** Post-approval, the KAM logs the first `repayment`. The UI "locks" the core bill values.
2. **The Waterfall Collection:** When funds hit the bank, KAMs enter a gross `Amount`. The system cascades the funds mathematically—filling the earliest tranche chronologically. Excess wraps automatically to the next Tranche array.
3. **Exceptions:**
   - Extensions: KAMs can shift tranche deadlines, strictly bounded by the `MAX_TRANCHE_EXTENSION_DAYS` setting.
   - Adjustments: `Credit Notes` demand Admin approval to structurally decrease a Promised amount.
4. **Closure vs. Write-Off:**
   - If `Actual == Promised`, the case smoothly closes.
   - If KAM closes early, and the remaining debt exceeds `WRITE_OFF_SLIPPAGE_PERCENTAGE`, the case enters `Pending Write-Off Approval`, trapping the workflow until the Founder overrides it.

---

## 📊 Analytics and Dashboards

Role-tailored dashboards focus on actionable operations over abstract analytics:
- **RM Dashboards:** Track `Average Margin (%)` and the triad of `PDCR` values (Count, Amount, Weighted Days). Poor performance functionally and visibly damages an RM’s margin.
- **Operations Queues:** Track cases in `Billing Active` with dynamic delayed payment triggers calling out specific defaulted tranches in real time.

---

## 🛠️ Developer Setup Guide

The system uses standard Node/NPM toolchains.

### Prerequisites
- Node.js (Latest LTS recommended).
- Supabase CLI installed locally for database orchestration.

### Installation & Initialization
1. **Dependencies:** `npm install`
   *(Note: If network failures cause partial installs without `.bin`, retry installation or verify manual logic).*
2. **Environment Variables:**
   Duplicate the `.env.example` file to `.env.local` and populate:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (CRITICAL: Do not commit).
3. **Database Spin-up:**
   The project assumes a local Supabase environment. Start it via `supabase start`. The platform natively utilizes `supabase/seed.sql` to populate default users (hashed securely via `pgcrypto`) and the `complete_v1_schema.sql` migration for total DB replication.

### Development Commands
- **Run the Application:** `npm run dev`
- **Build the Application:** `npm run build`
- **Type Checking:** `npx tsc --noEmit`
- **Unit Testing (Vitest):** `npm run test`. Requires heavy mocking of `@supabase/ssr` methods and Next.js caching imports.
- **E2E Testing (Playwright):** `npm run test:e2e`.

### Admin Bootstrapping
An immediate CLI action `node create_admin.js` exists at the root path to bootstrap initial Founder accounts outside of typical Supabase Auth constraints.

---

## 🛡️ Coding Guidelines & Rules
1. **Migration Primacy:** Never alter existing `.sql` migration files. Modifications require entirely new migration generation.
2. **XSS Protection:** Literal markdown values (like `\n` or `**`) from the database must be parsed safely into standard React nodes. Do not use `dangerouslySetInnerHTML`.
3. **CSV Parsing Utilities:** Found centrally in `src/utils/csv.ts`. Keep raw parsing out of server actions.
4. **Constraint Safety:** Always submit `link_list` as the input payload for Dropdown selections to correctly pass DB validations within the `parameter_definitions` schema.
5. **Parallelization:** Independent asynchronous calls (like stage/customer derivations) in `/src/utils/scoring.ts` must be executed concurrently via `Promise.all` to negate latency stacking.

---

**End of Documentation**