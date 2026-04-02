# Party Master / Influencer Refactor Design

## Objective
Fix the party registration process so it no longer defaults all parties to "both" (customer/contractor) and introduce the broader "Influencer" category with "Contractor" and "Interior" subtypes.

## Scope & Impact
- Database Layer: `parties` table in Supabase.
- Admin UI: `PartyDialog.tsx`, `AdminClient.tsx`.
- Intake Flow: `cases/new/page.tsx` dropdowns.
- Utilities: `actions.ts`, `csv.ts`.

## Proposed Solution
### 1. Database Migration
- Create a migration file `phase2_add_party_types.sql` to add two `TEXT` columns to the `parties` table: `party_type` and `influencer_subtype`.
- `party_type` will accept 'customer', 'influencer', or 'both'.
- `influencer_subtype` will accept 'contractor', 'interior', or NULL (for customers).
- We'll maintain the existing `contractor_party_id` reference structurally within `credit_cases` to prevent widespread ledger logic rewrites, but conceptually rebrand it to "Influencer" in the UI.

### 2. Admin UI (`src/components/admin/PartyDialog.tsx`)
- Update the "Party Type" dropdown to options: Customer, Influencer, Both.
- Conditionally render a new dropdown for "Influencer Subtype" (Contractor, Interior) if "Influencer" or "Both" is selected.

### 3. Server Actions & Backend (`src/app/admin/actions.ts` & `src/utils/csv.ts`)
- Update `upsertParty` to read `party_type` and `influencer_subtype` from `FormData` and pass them to the Supabase insert/update payload.
- Update `parsePartiesCsv` to map the new `influencer_subtype` column.

### 4. Admin Party Master (`src/app/admin/AdminClient.tsx`)
- Display the new `party_type` and `influencer_subtype` values in the Party Master table so admins can verify registration.

### 5. Case Intake Wizard (`src/app/cases/new/page.tsx`)
- Filter the "Customer Party" dropdown to only display parties where `party_type` is 'customer' or 'both'.
- Relabel the Contractor dropdown to "Contractor / Influencer Party".
- Filter the "Contractor / Influencer Party" dropdown to only display parties where `party_type` is 'influencer' or 'both'.

## Verification & Testing
- Admin can register a new party as 'influencer' and select 'interior'.
- Party master list correctly displays 'influencer' and 'interior'.
- New case wizard properly filters customer and influencer dropdowns.
- CSV import successfully reads `influencer_subtype`.