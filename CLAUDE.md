# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npm run test         # Run all Vitest unit tests (single pass)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests

supabase start       # Spin up local Supabase (DB + Auth)
node create_admin.js # Bootstrap first Founder account outside normal Auth flow
```

Run a single test file:
```bash
npx vitest run src/utils/scoring.test.ts
```

## Environment

Copy `.env.example` → `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — used in server actions to bypass RLS for authoritative checks

## Architecture

### Stack
- **Next.js 16** (App Router, Turbopack, `experimental.authInterrupts`)
- **Supabase** — Postgres with RLS, DB triggers, and `@supabase/ssr` for cookie-based auth
- **shadcn/ui** + Tailwind CSS — use semantic tokens (`bg-card`, `text-muted-foreground`) not hardcoded colors
- **Vitest** for unit tests (colocated as `*.test.ts`), **Playwright** for E2E

### Page / Server Action Pattern

Pages are React Server Components that fan out parallel data fetches, then pass the results plus unresolved Promises down to a `*Client.tsx` or `*Workspace.tsx` component. Example:

```
src/app/cases/[id]/page.tsx       — Server: fetches core, passes promise bag
src/app/cases/[id]/CaseWorkspace.tsx — Client: receives promises, renders tabs
src/app/cases/[id]/actions.ts     — "use server" data-fetching + mutations
src/app/cases/[id]/billing-actions.ts — "use server" ledger-specific mutations
```

Each route segment follows this same `page.tsx` + `*Client.tsx` + `actions.ts` split.

### Supabase Clients

| File | Usage |
|---|---|
| `src/utils/supabase/server.ts` | Server components, server actions, middleware — uses `@supabase/ssr` cookies |
| `src/utils/supabase/client.ts` | Client components only |

Server actions always use `createClient()` from `server.ts`. Admin-level mutations that need to bypass RLS use `SUPABASE_SERVICE_ROLE_KEY`.

### Auth & RBAC

`src/utils/auth.ts` — `getCurrentUser()` (React `cache`-wrapped) returns the user's profile + roles array. Roles: `rm`, `kam`, `accounts`, `bdo`, `ordinary_approver`, `board_member`, `founder_admin`.

`src/utils/auth-actions.ts` — `getImpersonationRole()` reads the active role from a cookie (used via the `RoleSwitcher` component in development).

Role enforcement happens in server actions via `hasAnyRole()` / `checkIsAdmin()` from `auth.ts`, not in RLS alone.

### Core Business Logic

| Module | File(s) |
|---|---|
| Scoring engine | `src/utils/scoring.ts` — per-subject, per-stage weighted score; cumulative score across stages; calls must be parallelized via `Promise.all` |
| Case workflow & transitions | `src/utils/engine.ts` — `progressStage`, `setWaiting`, `withdrawCase`, `createCaseDraft`, tranche validation, composite credit-day calculation |
| ID generation | `src/utils/idEngine.ts` |
| Credit line helpers | `src/utils/creditLine.ts` |
| CSV parsing | `src/utils/csv.ts` — keep raw parsing here, never in server actions |
| Date helpers | `src/utils/dateHelpers.ts` |

### Database

Single canonical migration: `supabase/migrations/20260514000000_remote_schema.sql` — this represents the exact live schema. **Never edit existing migration files.** Schema changes require a new migration file.

Key tables: `credit_cases`, `review_cycles`, `cycle_policy_snapshots`, `parameter_definitions`, `stage_tasks`, `repayments`, `credit_notes`, `tranches`, `parties`, `party_exposure`, `party_history`, `audit_events`, `notifications`, `system_settings`.

Business constants (thresholds, max extension days, write-off slippage %) live in `system_settings` — never hardcode them.

### Application Sections

| Route | Purpose |
|---|---|
| `/cases` | Case list; `/cases/new` for intake; `/cases/[id]` for full workspace |
| `/cases/[id]/board` | 7-person board voting for appeals / ambiguity review |
| `/collections` | Operations queue — Billing Active cases with overdue tranches |
| `/policy/*` | Admin policy management: parameters, personas, weights, bands, grades, stages, routing, validity, dominance, simulation |
| `/admin` | User management, party master, aliases, CSV imports |
| `/audit` | Immutable audit event log |
| `/settings` | System settings — prefix, city codes, delay reasons, RCA reasons |

### Key Constraints

- `link_list` must be the payload type when submitting dropdown (`grade_select`) parameter answers — required for DB validation.
- Markdown stored in the DB (e.g. comments with `**bold**`) must be rendered via a safe parser, never `dangerouslySetInnerHTML`.
- Scoring calls for independent subjects/stages must use `Promise.all` to avoid latency stacking.
- After the first `repayment` is logged, bill values lock and RM access becomes read-only — enforce this in actions, not just UI.
