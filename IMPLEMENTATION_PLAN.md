# Credit Scoring System — Full Implementation Plan

**Date:** 2026-04-29  
**Scope:** 22 bug fixes + 5 new feature areas  
**Audience:** Developer with no prior context on this repo

---

## HOW TO READ THIS DOCUMENT

- Every section tells you: **what is broken / missing**, **why it is broken**, **exactly which files to touch**, and **exactly what to write**.
- Do issues in the order they appear. Some fixes depend on earlier migrations.
- Never run a migration twice. Each SQL block is idempotent (uses `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.) but re-running can still produce errors on constraints.
- "Server action" = a TypeScript function in a file that has `"use server"` at the top.
- When a code block shows `// BEFORE` and `// AFTER`, find the exact `BEFORE` text in the file and replace it with the `AFTER` text.

---

## PART 1 — DATABASE MIGRATIONS

Run these SQL blocks in order inside the Supabase SQL editor (Dashboard → SQL Editor → New query). Each block is a separate query run.

---

### M1 — Add credit_line_amount to parties table

**Why:** The credit line feature requires storing a manually-set credit limit per party. No column currently exists.

```sql
-- M1: Credit line limit on parties
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS credit_line_amount BIGINT DEFAULT NULL,  -- null = no limit set
  ADD COLUMN IF NOT EXISTS credit_line_set_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_line_set_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

COMMENT ON COLUMN public.parties.credit_line_amount IS 'Manually set credit limit in rupees. NULL means no limit configured.';
```

---

### M2 — Parameter persistence scope + stored party parameter values

**Why:** Parameters need a `persistence_scope` flag so the system knows which values to store per-party. The `party_parameter_values` table stores those values so they can be pre-filled on next case creation.

```sql
-- M2a: Add persistence_scope to parameter_definitions
ALTER TABLE public.parameter_definitions
  ADD COLUMN IF NOT EXISTS persistence_scope TEXT NOT NULL DEFAULT 'none'
    CHECK (persistence_scope IN ('none', 'party', 'site', 'rm'));

COMMENT ON COLUMN public.parameter_definitions.persistence_scope IS
  'none=re-enter each case | party=stored per party | site=stored per site | rm=stored per RM';

-- M2b: Create party_parameter_values table
CREATE TABLE IF NOT EXISTS public.party_parameter_values (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id            UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  parameter_id        UUID NOT NULL REFERENCES public.parameter_definitions(id) ON DELETE CASCADE,
  grade_value         NUMERIC,
  raw_input_value     TEXT,
  captured_from_case  UUID REFERENCES public.credit_cases(id) ON DELETE SET NULL,
  captured_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (party_id, parameter_id)  -- one stored value per party per parameter
);

CREATE INDEX IF NOT EXISTS idx_ppv_party_id     ON public.party_parameter_values(party_id);
CREATE INDEX IF NOT EXISTS idx_ppv_parameter_id ON public.party_parameter_values(parameter_id);

ALTER TABLE public.party_parameter_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppv_select" ON public.party_parameter_values FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ppv_write"  ON public.party_parameter_values FOR ALL    USING (auth.role() = 'authenticated');
```

---

### M3 — Fix escalation system: add escalation_level to credit_cases

**Why:** `CollectionsClient.tsx` reads `c.escalation_level` but this column does not exist. The escalation feature is partially implemented — the `escalations` table tracks escalations per tranche, but the case-level summary column is missing.

```sql
-- M3: Add escalation_level column to credit_cases
ALTER TABLE public.credit_cases
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.credit_cases.escalation_level IS
  'Highest escalation level currently active on this case. 0 = none, 1 = KAM call, 2 = RM visit, 3 = legal notice.';

-- Also add an escalation_thresholds view so the collections page can query it
-- The actual threshold values live in system_settings
-- We expose them as a simple query alias for the page
CREATE OR REPLACE VIEW public.escalation_thresholds AS
SELECT
  CASE key
    WHEN 'ESCALATION_L1_DAYS' THEN 1
    WHEN 'ESCALATION_L2_DAYS' THEN 2
    WHEN 'ESCALATION_L3_DAYS' THEN 3
  END AS escalation_level,
  value::integer AS days_threshold
FROM public.system_settings
WHERE key IN ('ESCALATION_L1_DAYS', 'ESCALATION_L2_DAYS', 'ESCALATION_L3_DAYS');
```

---

### M4 — Add original_tranches to credit_cases for restructure safety

**Why:** Fix B3 (tranche restructure bypass). We need to lock the original tranche schedule at approval so multiple restructures can't compound past the limit.

```sql
-- M4: Lock original tranche schedule at approval time
ALTER TABLE public.credit_cases
  ADD COLUMN IF NOT EXISTS original_tranches JSONB DEFAULT NULL;

COMMENT ON COLUMN public.credit_cases.original_tranches IS
  'Snapshot of proposed_tranches at the moment billing was first initialized. Never updated after first set. Used for restructure extension validation.';
```

---

### M5 — Add parameter_bulk_values import type support

**Why:** The new feature for importing historical parameter values per party needs a new import type constant and the `party_parameter_values` table must accept imported data.

```sql
-- M5: Add import_type check extension (Postgres CHECK constraint cannot be altered directly)
-- If your import_jobs table has a CHECK on import_type, run this to drop and recreate it:
ALTER TABLE public.import_jobs
  DROP CONSTRAINT IF EXISTS import_jobs_import_type_check;

ALTER TABLE public.import_jobs
  ADD CONSTRAINT import_jobs_import_type_check
    CHECK (import_type IN ('party_master', 'historical_exposure', 'outstanding_exposure', 'parameter_bulk_values'));
```

---

## PART 2 — BUG FIXES

---

### FIX A1 — Broken Escalation System (3 files)

**Severity: Critical. These will throw runtime errors.**

**Root cause:**
1. `collections/actions.ts` inserts into `escalation_logs` with the wrong schema (passes `case_id`, `escalated_by`, `target_role`, `reason` — none of which exist on that table).
2. `collections/page.tsx` queries `escalation_thresholds` table which doesn't exist (now fixed by M3 view above).
3. `CollectionsClient.tsx` reads `c.escalation_level` which didn't exist on `credit_cases` (now fixed by M3 migration above).

**Fix 1 of 3 — `src/app/collections/actions.ts`**

Open this file. Find `handleEscalateCase`. Replace the entire function body:

```typescript
// BEFORE (broken — wrong table schema):
export async function handleEscalateCase(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const targetRole = fd.get('targetRole') as string;
  if (!caseId || !targetRole) return;

  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: c } = await supabase.from('credit_cases').select('escalation_level').eq('id', caseId).single();
  
  if (c) {
    const currentLevel = c.escalation_level ?? 0;
    await supabase.from('credit_cases').update({ escalation_level: currentLevel + 1 }).eq('id', caseId);

    if (user?.id) {
      await supabase.from('escalation_logs').insert({
        case_id: caseId,
        escalated_by: user.id,
        target_role: targetRole,
        reason: 'Manual escalation initiated from collections dashboard'
      });
    }
  }

  revalidatePath('/collections');
}

// AFTER (correct — matches actual escalation_logs schema):
export async function handleEscalateCase(fd: FormData) {
  const caseId = fd.get('caseId') as string;
  const trancheIndex = parseInt(fd.get('trancheIndex') as string ?? '0', 10);
  if (!caseId) return;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return;

  // 1. Find or create the escalation record for this case+tranche
  const { data: existingEscalation } = await supabase
    .from('escalations')
    .select('id, level')
    .eq('case_id', caseId)
    .eq('tranche_index', trancheIndex)
    .eq('status', 'open')
    .order('level', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextLevel = Math.min((existingEscalation?.level ?? 0) + 1, 3) as 1 | 2 | 3;

  // 2. Upsert escalation (create new level or escalate existing)
  const { data: escalation } = await supabase
    .from('escalations')
    .upsert({
      case_id: caseId,
      tranche_index: trancheIndex,
      level: nextLevel,
      status: 'open',
      trigger_reason: 'Manual escalation from collections dashboard',
      assigned_to: user.id,
    }, { onConflict: 'case_id,tranche_index,level' })
    .select('id')
    .single();

  // 3. Log the escalation action (uses correct escalation_logs schema)
  if (escalation?.id) {
    await supabase.from('escalation_logs').insert({
      escalation_id: escalation.id,
      logged_by: user.id,
      action_type: 'note',
      outcome: `Escalated to Level ${nextLevel} by ${user.full_name ?? 'unknown'}`,
      next_followup_at: null,
    });
  }

  // 4. Update the case-level summary column (added in M3)
  await supabase
    .from('credit_cases')
    .update({ escalation_level: nextLevel })
    .eq('id', caseId)
    .lt('escalation_level', nextLevel); // only bump up, never down

  revalidatePath('/collections');
}
```

**Fix 2 of 3 — `src/app/collections/page.tsx`**

The page queries `escalation_thresholds` table directly. After M3 creates the view, this query will work. However, the overdue detection logic is also wrong (see B1 below). Replace the entire `CollectionsPage` server component data fetching section:

```typescript
// BEFORE (wrong overdue detection — uses composite_credit_days):
const overdueCases = (cases || []).filter(c => {
  if (!c.billing_date) return false;
  const passedDays = Math.floor((now.getTime() - new Date(c.billing_date).getTime()) / 86400000);
  return passedDays > (c.composite_credit_days || 0);
});

// AFTER (correct — checks actual unpaid tranches with real due dates):
const overdueCases = (cases || []).filter(c => {
  if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) return false;
  const billingDate = new Date(c.billing_date);
  const billAmt = c.decided_bill_amount;
  let remaining = c.actual_bill_amount ?? 0;
  for (const t of c.proposed_tranches as any[]) {
    const amt = t.type === 'percentage'
      ? Math.round((t.value / 100) * billAmt)
      : Math.round(t.value);
    const fill = Math.min(remaining, amt);
    remaining -= fill;
    if (fill < amt) {
      // This tranche is not fully paid
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      if (due < now) return true; // past due date with unpaid amount
    }
  }
  return false;
});
```

Also fix the stats calculation (B2 fix):

```typescript
// BEFORE (gross amount — wrong):
const stats = {
  totalOverdue: overdueCases.reduce((sum, c) => sum + (c.decided_bill_amount || c.bill_amount || 0), 0),
  ...
};

// AFTER (net outstanding — correct):
const stats = {
  totalOverdue: overdueCases.reduce((sum, c) => {
    const outstanding = Math.max(0, (c.decided_bill_amount || c.bill_amount || 0) - (c.actual_bill_amount ?? 0));
    return sum + outstanding;
  }, 0),
  countOverdue: overdueCases.length,
  totalEscalated: overdueCases
    .filter(c => (c.escalation_level ?? 0) > 0)
    .reduce((sum, c) => {
      const outstanding = Math.max(0, (c.decided_bill_amount || c.bill_amount || 0) - (c.actual_bill_amount ?? 0));
      return sum + outstanding;
    }, 0),
  countEscalated: overdueCases.filter(c => (c.escalation_level ?? 0) > 0).length,
};
```

**Fix 3 of 3 — Add `proposed_tranches`, `decided_bill_amount`, `actual_bill_amount` to the collections page query**

The current SELECT on `credit_cases` in `collections/page.tsx` is missing these fields. Find the query and add them:

```typescript
// BEFORE:
const { data: cases } = await supabase
  .from('credit_cases')
  .select(`
    id, case_number, status, bill_amount, composite_credit_days, escalation_level,
    billing_date, decided_bill_amount, actual_bill_amount,
    customer:parties!credit_cases_customer_party_id_fkey(legal_name)
  `)
  .in('status', ['Billing Active', 'Pending Write-Off Approval']);

// AFTER (add proposed_tranches and rm_user_id for RBAC filtering):
const { data: cases } = await supabase
  .from('credit_cases')
  .select(`
    id, case_number, status, bill_amount, composite_credit_days, escalation_level,
    billing_date, decided_bill_amount, actual_bill_amount, proposed_tranches,
    rm_user_id, kam_user_id,
    customer:parties!credit_cases_customer_party_id_fkey(legal_name)
  `)
  .in('status', ['Billing Active', 'Pending Write-Off Approval']);
```

---

### FIX A2 — Import Mapping Templates Are Dead Code

**Severity: High. Admins who configure column mappings get no benefit.**

**Root cause:** `src/app/admin/imports/actions.ts` — the `processImportJob` function uses hardcoded field names (`row.legal_name`, `row.party_id`, etc.) and never reads from `import_mapping_templates`.

**File to edit:** `src/app/admin/imports/actions.ts`

Replace the `processImportJob` function. The key change is: before processing rows, look up the active mapping template for the import type and apply the column remap.

```typescript
// Add this helper ABOVE the processImportJob function:
async function applyColumnMapping(
  row: Record<string, any>,
  columnMapping: Record<string, string>
): Promise<Record<string, any>> {
  // columnMapping is { csv_column_name: db_field_name }
  // e.g. { "Party Name": "legal_name", "Code": "customer_code" }
  const mapped: Record<string, any> = {};
  for (const [csvCol, dbField] of Object.entries(columnMapping)) {
    if (row[csvCol] !== undefined) {
      mapped[dbField] = row[csvCol];
    }
  }
  // Also pass through any fields that already match db names (fallback)
  for (const [key, val] of Object.entries(row)) {
    if (mapped[key] === undefined) mapped[key] = val;
  }
  return mapped;
}

// BEFORE — processImportJob does NOT read import_mapping_templates:
export async function processImportJob(formData: FormData) {
  ...
  for (const row of payload) {
    try {
      if (importType === 'party_master') {
        await supabase.from('parties').insert({
          legal_name: row.legal_name,
          ...

// AFTER — reads template first, remaps columns, then processes:
export async function processImportJob(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const supabase = await createClient();
  const importType = formData.get('import_type') as string;
  const payloadStr = formData.get('payload') as string;
  const payload = JSON.parse(payloadStr);
  const templateId = formData.get('template_id') as string | null;

  // --- Load column mapping template if provided ---
  let columnMapping: Record<string, string> = {};
  if (templateId) {
    const { data: tmpl } = await supabase
      .from('import_mapping_templates')
      .select('column_mapping')
      .eq('id', templateId)
      .single();
    if (tmpl?.column_mapping) {
      columnMapping = tmpl.column_mapping as Record<string, string>;
    }
  }

  // 1. Create Job Record
  const { data: job, error: jobErr } = await supabase.from('import_jobs').insert({
    imported_by: user.id,
    import_type: importType,
    status: 'processing',
    records_total: payload.length
  }).select().single();
  if (jobErr) throw jobErr;

  // --- Pre-validate all party_ids in one DB round-trip for history/exposure imports ---
  let validPartyIds = new Set<string>();
  if (['historical_exposure', 'outstanding_exposure', 'parameter_bulk_values'].includes(importType)) {
    const partyIdsInPayload = [...new Set(
      payload.map((r: any) => applyColumnMappingSync(r, columnMapping)['party_id']).filter(Boolean)
    )];
    if (partyIdsInPayload.length > 0) {
      const { data: existingParties } = await supabase
        .from('parties')
        .select('id')
        .in('id', partyIdsInPayload);
      validPartyIds = new Set((existingParties || []).map((p: any) => p.id));
    }
  }

  let processed = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const rawRow of payload) {
    // Apply column name remapping
    const row = Object.keys(columnMapping).length > 0
      ? await applyColumnMapping(rawRow, columnMapping)
      : rawRow;

    try {
      if (importType === 'party_master') {
        // Deduplication: upsert on customer_code if present, else insert
        if (row.customer_code) {
          await supabase.from('parties').upsert(
            {
              legal_name: row.legal_name,
              customer_code: row.customer_code || null,
              industry_category: row.industry_category || null,
              created_by: user.id,
              is_candidate: false,
            },
            { onConflict: 'customer_code', ignoreDuplicates: false }
          );
        } else {
          // No customer_code — check for duplicate legal_name before inserting
          const { data: existing } = await supabase
            .from('parties')
            .select('id')
            .ilike('legal_name', row.legal_name?.trim())
            .limit(1)
            .maybeSingle();
          if (existing) {
            throw new Error(`Party "${row.legal_name}" already exists (id: ${existing.id}). Provide a customer_code to update.`);
          }
          await supabase.from('parties').insert({
            legal_name: row.legal_name,
            customer_code: null,
            industry_category: row.industry_category || null,
            created_by: user.id,
            is_candidate: false,
          });
        }

      } else if (importType === 'historical_exposure') {
        if (!row.party_id) throw new Error('Missing party_id');
        if (!validPartyIds.has(row.party_id)) {
          throw new Error(`party_id "${row.party_id}" not found in parties table`);
        }
        await supabase.from('party_history').insert({
          party_id: row.party_id,
          import_job_id: job.id,
          order_count: parseInt(row.order_count) || 0,
          total_volume: parseFloat(row.total_volume) || 0,
          payment_recency_days: parseInt(row.payment_recency_days) || null,
          average_delay_days: parseFloat(row.average_delay_days) || 0,
          max_delay_days: parseInt(row.max_delay_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString(),
        });

      } else if (importType === 'outstanding_exposure') {
        if (!row.party_id) throw new Error('Missing party_id');
        if (!validPartyIds.has(row.party_id)) {
          throw new Error(`party_id "${row.party_id}" not found in parties table`);
        }
        await supabase.from('party_exposure').insert({
          party_id: row.party_id,
          import_job_id: job.id,
          outstanding_amount: parseFloat(row.outstanding_amount) || 0,
          overdue_amount: parseFloat(row.overdue_amount) || 0,
          overdue_days: parseInt(row.overdue_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString(),
        });

      } else if (importType === 'parameter_bulk_values') {
        // New import type for parameter persistence feature
        if (!row.party_id) throw new Error('Missing party_id');
        if (!row.parameter_id) throw new Error('Missing parameter_id');
        if (!validPartyIds.has(row.party_id)) {
          throw new Error(`party_id "${row.party_id}" not found in parties table`);
        }
        await supabase.from('party_parameter_values').upsert({
          party_id: row.party_id,
          parameter_id: row.parameter_id,
          grade_value: row.grade_value != null ? parseFloat(row.grade_value) : null,
          raw_input_value: row.raw_input_value || null,
          captured_at: row.captured_at || new Date().toISOString(),
        }, { onConflict: 'party_id,parameter_id' });
      }

      processed++;
    } catch (e: any) {
      failed++;
      errors.push({ row: rawRow, error: e.message });
    }
  }

  await supabase.from('import_jobs').update({
    status: failed === payload.length ? 'failed' : 'completed',
    records_processed: processed,
    records_failed: failed,
    error_details: errors.length > 0 ? errors : null,
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  await logAuditEvent({
    event_type: 'data_import',
    actor_id: user.id,
    description: `Imported ${processed} records for ${importType}. Failed: ${failed}.`,
  });

  revalidatePath('/admin/imports');
}

// Synchronous version of applyColumnMapping (needed for pre-validation pass)
function applyColumnMappingSync(
  row: Record<string, any>,
  columnMapping: Record<string, string>
): Record<string, any> {
  const mapped: Record<string, any> = { ...row };
  for (const [csvCol, dbField] of Object.entries(columnMapping)) {
    if (row[csvCol] !== undefined) mapped[dbField] = row[csvCol];
  }
  return mapped;
}
```

---

### FIX B3 — Tranche Restructure Max Extension Bypass

**Severity: High. Allows KAM to bypass credit policy limits with repeated restructures.**

**Root cause:** `handleRestructureTranches` in `src/app/cases/[id]/billing-actions.ts` reads `proposed_tranches` (current, already-modified) as the "original" for extension comparison. After M4 migration added `original_tranches`, we can fix this.

**Step 1:** In `handleSaveBillingDetails` (same file, ~line 135), after the update that sets `status: 'Billing Active'`, also snapshot `original_tranches` if not already set:

```typescript
// AFTER the supabase.from('credit_cases').update({ ... }) in handleSaveBillingDetails,
// add this block:

// Snapshot the original tranche schedule (only set once, never overwritten)
const { data: caseForSnapshot } = await supabase
  .from('credit_cases')
  .select('original_tranches, proposed_tranches')
  .eq('id', caseId)
  .single();

if (caseForSnapshot && !caseForSnapshot.original_tranches) {
  await supabase
    .from('credit_cases')
    .update({ original_tranches: caseForSnapshot.proposed_tranches })
    .eq('id', caseId);
}
```

**Step 2:** In `handleRestructureTranches` (same file, ~line 628), change which field is used as "original":

```typescript
// BEFORE:
const origTranches = caseRow.proposed_tranches as any[];
for (let i = 0; i < newTranches.length; i++) {
  const origDaysAfter = origTranches[i]?.days_after_billing ?? 0;
  ...

// AFTER:
// Read original_tranches (locked at billing init time) instead of proposed_tranches
const { data: caseRow } = await supabase
  .from('credit_cases')
  .select('proposed_tranches, original_tranches, billing_date')  // add original_tranches
  .eq('id', caseId)
  .single();

// Use original_tranches if available, fall back to proposed_tranches for legacy cases
const baselineTranches = (caseRow?.original_tranches || caseRow?.proposed_tranches) as any[];

for (let i = 0; i < newTranches.length; i++) {
  const origDaysAfter = baselineTranches[i]?.days_after_billing ?? 0;
  const newDaysAfter = newTranches[i]?.days_after_billing ?? 0;
  const extension = newDaysAfter - origDaysAfter;

  if (extension > maxExtensionDays) {
    throw new Error(
      `Tranche ${i + 1}: total extension of ${extension} days from original schedule exceeds the maximum allowed (${maxExtensionDays} days). Original was ${origDaysAfter}d, new is ${newDaysAfter}d.`
    );
  }
}
```

---

### FIX B4 — Payment Edit Doesn't Reopen Auto-Closed Case

**Severity: Medium. KAM correction of a typo can leave a case incorrectly Closed.**

**Root cause:** `handleEditPayment` in `billing-actions.ts` calls `checkAndCloseCase` (which only closes) but never reopens if actual drops below promised after the edit.

Add a reopen check BEFORE the `checkAndCloseCase` call in `handleEditPayment`:

```typescript
// In handleEditPayment, replace the block after the update:

// BEFORE:
const { data: updated } = await supabase
  .from('credit_cases')
  .select('actual_bill_amount, promised_bill_amount')
  .eq('id', caseId)
  .single();

if (updated) {
  await checkAndCloseCase(caseId, updated.actual_bill_amount, updated.promised_bill_amount, user.id, supabase);
}

// AFTER (also reopens if actual fell below promised):
const { data: updated } = await supabase
  .from('credit_cases')
  .select('status, actual_bill_amount, promised_bill_amount')
  .eq('id', caseId)
  .single();

if (updated) {
  const actual = updated.actual_bill_amount ?? 0;
  const promised = updated.promised_bill_amount ?? 0;

  if (updated.status === 'Closed' && actual < promised) {
    // Payment was edited downward — reopen the case
    await supabase.from('credit_cases').update({ status: 'Billing Active' }).eq('id', caseId);
    await logAuditEvent({
      case_id: caseId,
      event_type: 'case_reopened',
      actor_id: user.id,
      description: `Case reopened after payment edit. Actual ₹${actual.toLocaleString('en-IN')} is now below Promised ₹${promised.toLocaleString('en-IN')}.`,
    });
  } else {
    await checkAndCloseCase(caseId, actual, promised, user.id, supabase);
  }
}
```

---

### FIX B5 — handleAttemptClose Fails on Uninitialized Billing

**Severity: Medium. Can incorrectly route a case to write-off if billing was never set up.**

**Root cause:** `handleAttemptClose` in `billing-actions.ts` doesn't guard against `promised_bill_amount` being null/0.

Add guard at the top of the function, after fetching `caseRow`:

```typescript
// AFTER the caseRow null check, add:
if (!caseRow.promised_bill_amount || caseRow.promised_bill_amount <= 0) {
  throw new Error('Cannot close case: billing has not been initialized. Set Billing Date and Promised Amount first.');
}
```

---

### FIX B6 — party_exposure.overdue_days Goes Stale

**Severity: Medium. Misleads credit decision makers with outdated overdue figures.**

**Root cause:** `overdue_days` is written at import time and never updated. It's displayed raw in `src/app/cases/[id]/OverviewTab.tsx` (or wherever party exposure is shown).

**Where to fix:** Find every place in the UI that renders `party_exposure.overdue_days`. Search the project for `overdue_days` in `.tsx` files. For each display location, replace the raw value with an adjusted calculation:

```typescript
// Helper function — add to src/utils/dateHelpers.ts (create file if missing):
export function adjustedOverdueDays(storedOverdueDays: number, dataAsOf: string | null): number {
  if (!dataAsOf) return storedOverdueDays;
  const daysSinceImport = Math.floor(
    (Date.now() - new Date(dataAsOf).getTime()) / (1000 * 3600 * 24)
  );
  return storedOverdueDays + Math.max(0, daysSinceImport);
}

export function formatDataFreshness(dataAsOf: string | null): string {
  if (!dataAsOf) return 'Unknown';
  const days = Math.floor((Date.now() - new Date(dataAsOf).getTime()) / (1000 * 3600 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
```

Wherever `party_exposure.overdue_days` is rendered, change it to:

```tsx
// BEFORE:
<span>{exposure.overdue_days} days overdue</span>

// AFTER:
import { adjustedOverdueDays, formatDataFreshness } from '@/utils/dateHelpers';

<span title={`Import date: ${formatDataFreshness(exposure.data_as_of)}`}>
  {adjustedOverdueDays(exposure.overdue_days, exposure.data_as_of)} days overdue
  <span className="text-xs text-muted-foreground ml-1">
    (as of {formatDataFreshness(exposure.data_as_of)})
  </span>
</span>
```

---

### FIX B7 — party_history Doesn't Reflect System's Own Outcomes

**Severity: Medium. Credit scoring uses stale imported data instead of live realized outcomes.**

**Root cause:** `party_history.average_delay_days` and `max_delay_days` come only from CSV imports. The `realized_outcomes` table accumulates real payment data but nothing feeds it back.

**Fix:** Add a server action that admin/KAM can trigger to recompute and upsert `party_history` from `realized_outcomes`. Place this in a new file `src/app/admin/actions.ts` (append to existing file):

```typescript
// Append to src/app/admin/actions.ts:

/**
 * Recomputes party_history metrics from realized_outcomes for all parties
 * that have at least one closed case in the system.
 * Should be run by admin after a batch of case closures.
 */
export async function recomputePartyHistoryFromOutcomes() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can recompute party history.');

  const supabase = await createClient();

  // Fetch all realized outcomes joined to their cases
  const { data: outcomes } = await supabase
    .from('realized_outcomes')
    .select(`
      realized_delay_days,
      realized_exposure,
      deal_happened,
      case:credit_cases!realized_outcomes_case_id_fkey(
        customer_party_id, contractor_party_id, decided_bill_amount
      )
    `);

  if (!outcomes || outcomes.length === 0) return { updated: 0 };

  // Aggregate per party
  const partyStats: Record<string, {
    orderCount: number;
    totalVolume: number;
    delayDays: number[];
    maxDelay: number;
  }> = {};

  for (const o of outcomes) {
    if (!o.deal_happened) continue;
    const c = o.case as any;
    const parties = [c?.customer_party_id, c?.contractor_party_id].filter(Boolean);
    for (const partyId of parties) {
      if (!partyStats[partyId]) {
        partyStats[partyId] = { orderCount: 0, totalVolume: 0, delayDays: [], maxDelay: 0 };
      }
      partyStats[partyId].orderCount++;
      partyStats[partyId].totalVolume += c?.decided_bill_amount ?? 0;
      if (o.realized_delay_days != null) {
        partyStats[partyId].delayDays.push(o.realized_delay_days);
        partyStats[partyId].maxDelay = Math.max(partyStats[partyId].maxDelay, o.realized_delay_days);
      }
    }
  }

  let updated = 0;
  for (const [partyId, stats] of Object.entries(partyStats)) {
    const avgDelay = stats.delayDays.length > 0
      ? stats.delayDays.reduce((a, b) => a + b, 0) / stats.delayDays.length
      : 0;

    await supabase.from('party_history').upsert({
      party_id: partyId,
      import_job_id: null,
      order_count: stats.orderCount,
      total_volume: stats.totalVolume,
      average_delay_days: Math.round(avgDelay * 10) / 10,
      max_delay_days: stats.maxDelay,
      data_as_of: new Date().toISOString(),
    }, { onConflict: 'party_id,import_job_id' });
    updated++;
  }

  await logAuditEvent({
    event_type: 'party_history_recomputed',
    actor_id: user.id,
    description: `Recomputed party_history from realized_outcomes for ${updated} parties.`,
  });

  revalidatePath('/admin');
  return { updated };
}
```

Add a button in the Admin panel (`src/app/admin/page.tsx`) to trigger this action. The button should say "Sync Payment History from Closed Cases" and call `recomputePartyHistoryFromOutcomes`.

---

### FIX C1 — Cases List Shows All Cases (No Assignment Filter)

**Severity: High. RM can see every case in the system.**

**File:** `src/app/cases/page.tsx`

After `const activeRole = await getImpersonationRole();`, add a user fetch and a role-based filter:

```typescript
// Add after: const activeRole = await getImpersonationRole();
import { getCurrentUser } from '@/utils/auth';

const user = await getCurrentUser();

// ... existing query setup ...

// Add role-based filters BEFORE executing the query:
if (activeRole === 'rm' && user) {
  query = query.eq('rm_user_id', user.id);
} else if (activeRole === 'kam' && user) {
  query = query.eq('kam_user_id', user.id);
}
// Note: ordinary_approver and board_member see cases via approval assignments
// For now they see all (full RLS enforcement comes in the RLS migration phase)
// founder_admin sees all — no filter applied
```

---

### FIX C2 — Case Detail Page Has No Assignment Check

**Severity: High. Any user can view any case by URL.**

**File:** `src/app/cases/[id]/page.tsx`

After fetching `coreData`, add an authorization check:

```typescript
// After: const [coreData, activeRole] = await Promise.all([corePromise, activeRolePromise]);

import { getCurrentUser } from '@/utils/auth';
// ... existing imports ...

const user = await getCurrentUser();
if (!user) redirect('/login');

if (coreData?.case) {
  const c = coreData.case;
  const isRm  = activeRole === 'rm';
  const isKam = activeRole === 'kam';
  const isAdmin = activeRole === 'founder_admin';
  const isApproverOrBoard = ['ordinary_approver', 'board_member', 'accounts', 'bdo'].includes(activeRole);

  if (isRm && c.rm_user_id !== user.id) {
    notFound(); // RM cannot see another RM's case
  }
  if (isKam && c.kam_user_id !== user.id) {
    notFound(); // KAM cannot see a case not assigned to them
  }
  // Approvers/board/accounts/bdo can view all (they receive notifications with links)
  // Admin can view all
}
```

---

### FIX C3 — Collections Page Shows All Cases Regardless of Assignment

**Severity: High.**

**File:** `src/app/collections/page.tsx`

Add user-based filter to the cases query:

```typescript
// Add after: const supabase = await createClient();
const user = await getCurrentUser();

// ... after building the query ...
let casesQuery = supabase
  .from('credit_cases')
  .select(`...`)
  .in('status', ['Billing Active', 'Pending Write-Off Approval']);

// Apply assignment filter
if (role === 'rm' && user) {
  casesQuery = casesQuery.eq('rm_user_id', user.id);
} else if (role === 'kam' && user) {
  casesQuery = casesQuery.eq('kam_user_id', user.id);
}
// founder_admin sees all

const { data: cases } = await casesQuery;
```

---

### FIX D1 — KAM Assignee Not Validated Before Form Proceeds

**Severity: High. Cases can be submitted without a KAM, breaking the review workflow.**

**File:** `src/app/cases/new/NewCaseForm.tsx`

Find `canGoNext` and add the KAM check to step 1:

```typescript
// BEFORE:
if (currentStep === 1) {
  return (needsCustomer ? !!customerPartyId : true) && 
         (needsContractor ? !!contractorPartyId : true) && 
         !!scenario && 
         !!siteAddress && 
         !!cityCode;
}

// AFTER:
if (currentStep === 1) {
  return (needsCustomer ? !!customerPartyId : true) && 
         (needsContractor ? !!contractorPartyId : true) && 
         !!scenario && 
         !!siteAddress && 
         !!cityCode &&
         !!kamUserId;  // KAM assignment is mandatory
}
```

Also add server-side validation in `src/app/cases/new/actions.ts` inside `handleNewCase`:

```typescript
// Add after the role check, before createCaseDraft:
if (action === 'submit' && !kamUserId) {
  throw new Error('A KAM must be assigned before submitting a case for review.');
}
```

---

### FIX D2 — Grade Labels Are Hardcoded (Disconnected from Policy)

**Severity: Medium. Policy admin changes to grade labels have no effect in the form.**

**File:** `src/app/cases/new/NewCaseForm.tsx` + `src/app/cases/new/actions.ts`

**Step 1:** Add a `fetchGradeScale` server action to `actions.ts`:

```typescript
export async function fetchGradeScale() {
  const supabase = await createClient();
  const { data: activePolicy } = await supabase
    .from('policy_versions')
    .select('id')
    .eq('is_active', true)
    .single();
  if (!activePolicy) return [];

  const { data } = await supabase
    .from('grade_scale')
    .select('grade_value, grade_label, description')
    .eq('policy_version_id', activePolicy.id)
    .order('grade_value', { ascending: true });
  return data || [];
}
```

**Step 2:** In `src/app/cases/new/page.tsx` (the server component that wraps the form), fetch grade scale and pass it as a prop to `NewCaseForm`.

**Step 3:** In `NewCaseForm.tsx`, add `gradeScale: {grade_value: number, grade_label: string}[]` to the component props. Replace the hardcoded grade options:

```tsx
// BEFORE:
<option value="1">Grade 1 (Best)</option>
<option value="2">Grade 2</option>
<option value="3">Grade 3</option>
<option value="4">Grade 4 (Worst)</option>
<option value="5">Grade 5</option>

// AFTER:
{gradeScale.length > 0
  ? gradeScale.map(g => (
      <option key={g.grade_value} value={g.grade_value}>
        {g.grade_label} (Grade {g.grade_value})
      </option>
    ))
  : [1,2,3,4,5].map(v => (
      <option key={v} value={v}>Grade {v}</option>
    ))
}
```

---

### FIX D3 — Auto-Band Not Implemented for Date Input Type

**Severity: Low. Date parameters with auto_band_config silently don't map.**

**File:** `src/app/cases/new/NewCaseForm.tsx` — inside `handleTaskAnswerChange`

Find the section that handles `field === 'raw_input_value' && taskDef?.auto_band_config` and add a `date` branch:

```typescript
// BEFORE — only handles numeric and link_list/yes_no:
if (taskDef.input_type === 'numeric' && taskDef.auto_band_config.bands) {
  ...
} else if ((taskDef.input_type === 'link_list' || taskDef.input_type === 'yes_no') && taskDef.auto_band_config.mappings) {
  ...
}

// AFTER — add date handling:
if (taskDef.input_type === 'numeric' && taskDef.auto_band_config.bands) {
  const numValue = parseFloat(value);
  if (!isNaN(numValue)) {
    const band = taskDef.auto_band_config.bands.find(
      (b: any) => numValue >= b.min && numValue <= b.max
    );
    if (band) mappedGrade = band.grade;
  }
} else if (taskDef.input_type === 'date' && taskDef.auto_band_config.bands) {
  // For date inputs: auto_band_config.bands use "days_ago" ranges
  // e.g. [{min: 0, max: 30, grade: 1}, {min: 31, max: 90, grade: 2}]
  // The "value" is an ISO date string; compute days_ago from today
  const inputDate = new Date(value);
  if (!isNaN(inputDate.getTime())) {
    const daysAgo = Math.floor((Date.now() - inputDate.getTime()) / (1000 * 3600 * 24));
    const band = taskDef.auto_band_config.bands.find(
      (b: any) => daysAgo >= b.min && daysAgo <= b.max
    );
    if (band) mappedGrade = band.grade;
  }
} else if ((taskDef.input_type === 'link_list' || taskDef.input_type === 'yes_no') && taskDef.auto_band_config.mappings) {
  const mapping = taskDef.auto_band_config.mappings.find(
    (m: any) => m.value.toLowerCase() === String(value).toLowerCase()
  );
  if (mapping) mappedGrade = mapping.grade;
}
```

---

### FIX D4 — Hiding Deal Size Bucket Breaks Routing Rules

**Severity: High. All cases will route to Stage 1 if routing rules reference deal_size_bucket.**

**Root cause:** The routing matcher `expectedStage()` in `NewCaseForm.tsx` checks `rule.context_rule?.deal_size_bucket !== dealSizeBucket`. When `dealSizeBucket` is empty and the rule has a bucket value, this will never match, so Stage 1 default is always returned.

**File:** `src/app/cases/new/NewCaseForm.tsx`

```typescript
// BEFORE:
const expectedStage = () => {
  for (const rule of routingThresholds) {
    let matches = true;
    if (rule.context_rule?.exposure_min && requestedExposure < rule.context_rule.exposure_min) matches = false;
    if (rule.context_rule?.case_scenario && rule.context_rule.case_scenario !== scenario) matches = false;
    if (rule.context_rule?.deal_size_bucket && rule.context_rule.deal_size_bucket !== dealSizeBucket) matches = false;
    if (matches) return rule.target_stage;
  }
  return 1;
};

// AFTER — treat missing deal_size_bucket as wildcard (only filter if BOTH rule and form have a value):
const expectedStage = () => {
  for (const rule of routingThresholds) {
    let matches = true;
    if (rule.context_rule?.exposure_min && requestedExposure < rule.context_rule.exposure_min) matches = false;
    if (rule.context_rule?.case_scenario && rule.context_rule.case_scenario !== scenario) matches = false;
    // Only apply deal_size_bucket filter if both the rule AND the form have a value
    if (rule.context_rule?.deal_size_bucket && dealSizeBucket && rule.context_rule.deal_size_bucket !== dealSizeBucket) matches = false;
    if (matches) return rule.target_stage;
  }
  return 1;
};
```

Also apply the same fix to the server-side routing engine (`src/utils/engine.ts`) — find wherever `deal_size_bucket` is compared in the routing threshold matching logic and apply the same null-wildcard treatment.

---

### FIX D5 — Site ID Generation Race Condition

**Severity: Low. Two simultaneous submissions can get identical Site IDs.**

**Root cause:** `generateSiteIdPreview` and the actual site ID assignment in `handleNewCase` both compute a sequence number by counting existing cases. Under concurrency, two requests can get the same count.

**Fix:** Add a `UNIQUE` constraint on the generated site_id stored in `case_attributes`:

```sql
-- Run this in Supabase SQL editor:
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_cases_site_id
  ON public.credit_cases ((case_attributes->>'site_id'))
  WHERE case_attributes->>'site_id' IS NOT NULL;
```

In `handleNewCase` (server action), if the insert fails with a unique violation on `site_id`, retry with an incremented sequence:

```typescript
// In handleNewCase, after building the case_attributes object:
let siteId = formData.get('generatedSiteId') as string;

// Retry loop for race condition on site ID
let attempt = 0;
let newCase;
while (attempt < 5) {
  try {
    newCase = await createCaseDraft({
      ...
      case_attributes: {
        ...
        site_id: siteId,
      },
    });
    break;
  } catch (err: any) {
    if (err.message?.includes('idx_credit_cases_site_id') || err.code === '23505') {
      // Unique violation on site_id — regenerate with incremented sequence
      attempt++;
      const parts = user.full_name.split(' ');
      siteId = await idEngine.generateLeadSiteId({
        cityCode: formData.get('cityCode') as string,
        siteDate: new Date(formData.get('siteDate') as string),
        rmFirstName: parts[0],
        rmLastName: parts.length > 1 ? parts[parts.length - 1] : undefined,
        siteSequenceNumber: (parseInt(siteId.split('-').pop() || '1')) + attempt,
      });
    } else {
      throw err;
    }
  }
}
if (!newCase) throw new Error('Failed to generate a unique Site ID after 5 attempts. Please try again.');
```

---

### FIX G1 — No Warning When stage_max_totals Doesn't Match Parameter Weights

**Severity: Medium. Scores can silently exceed 100%.**

**File:** Add a validation function to `src/utils/scoring.ts`:

```typescript
export async function validateStageMaxTotals(policyVersionId: string): Promise<{
  stage: number;
  configuredMax: number;
  actualWeightSum: number;
  isValid: boolean;
}[]> {
  const supabase = await createClient();

  const [{ data: maxTotals }, { data: params }] = await Promise.all([
    supabase.from('stage_max_totals').select('stage, max_total').eq('policy_version_id', policyVersionId),
    supabase.from('parameter_definitions').select('stage, weight').eq('policy_version_id', policyVersionId).eq('is_active', true),
  ]);

  return [1, 2, 3].map(stage => {
    const configured = maxTotals?.find(m => m.stage === stage)?.max_total ?? 0;
    const actual = (params || [])
      .filter(p => p.stage === stage)
      .reduce((sum, p) => sum + (p.weight ?? 0), 0);
    return { stage, configuredMax: configured, actualWeightSum: actual, isValid: configured === actual };
  });
}
```

Add a warning banner to `src/app/policy/page.tsx` that calls this validation and shows a red alert if any stage has a mismatch.

---

### FIX G2 — Weight Matrix Doesn't Indicate Defaulting Parameters

**Severity: Low. Policy admin has no visibility into implicit vs explicit weights.**

**File:** `src/app/policy/weights/page.tsx`

In the weights table UI, for each parameter cell, check if a `weight_matrices` row exists for that persona+parameter combination. If not, display the cell with a gray background and label "(default)" next to the value. If it does exist, show the value normally. This is a display-only change and requires no schema changes — the `weight_matrices` query already returns null for unconfigured pairs, so you can distinguish "null/not present = default" vs "present = explicit override".

---

## PART 3 — NEW FEATURES

---

### FEATURE 1 — Credit Line (Manual)

**Summary:** Admins set a `credit_line_amount` per party. The case creation screen shows utilization. Party profile also shows utilization.

**Prerequisites:** M1 migration must be run.

#### 1A — Admin UI to Set Credit Line

**File:** Create `src/app/admin/parties/[id]/credit-line-actions.ts` (new file):

```typescript
"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin, logAuditEvent } from '@/utils/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function setCreditLine(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) throw new Error('Only Admin can set credit lines.');

  const partyId = formData.get('partyId') as string;
  const amountRaw = formData.get('amount') as string;

  // Allow empty string to clear the credit line
  const amount = amountRaw.trim() === '' ? null : parseInt(amountRaw, 10);
  if (amount !== null && (isNaN(amount) || amount <= 0)) {
    throw new Error('Credit line must be a positive whole number in rupees, or empty to remove the limit.');
  }

  const supabase = await createClient();
  await supabase.from('parties').update({
    credit_line_amount: amount,
    credit_line_set_at: amount ? new Date().toISOString() : null,
    credit_line_set_by: amount ? user.id : null,
  }).eq('id', partyId);

  await logAuditEvent({
    event_type: 'credit_line_updated',
    actor_id: user.id,
    description: amount
      ? `Credit line set to ₹${amount.toLocaleString('en-IN')} for party ${partyId}.`
      : `Credit line removed for party ${partyId}.`,
  });

  revalidatePath(`/admin`);
}
```

In the Admin panel or party detail page, add a form with a number input and submit button that calls `setCreditLine`. Only visible if `activeRole === 'founder_admin'`.

#### 1B — Utilization Computation Function

Add to `src/utils/creditLine.ts` (new file):

```typescript
import { createClient } from '@/utils/supabase/server';

export async function getCreditLineUtilization(partyId: string): Promise<{
  limit: number | null;
  utilized: number;
  available: number | null;
  utilizationPct: number | null;
}> {
  const supabase = await createClient();

  const [{ data: party }, { data: activeCases }] = await Promise.all([
    supabase.from('parties').select('credit_line_amount').eq('id', partyId).single(),
    supabase
      .from('credit_cases')
      .select('requested_exposure_amount, actual_bill_amount, decided_bill_amount')
      .or(`customer_party_id.eq.${partyId},contractor_party_id.eq.${partyId}`)
      // Only count Accepted cases that still have outstanding amounts
      .eq('status', 'Accepted'),
  ]);

  // Utilization = sum of (decided_bill_amount - actual_bill_amount) for Accepted cases
  // i.e., the outstanding unpaid portion of accepted credit
  const utilized = (activeCases || []).reduce((sum, c) => {
    const outstanding = Math.max(0, (c.decided_bill_amount ?? c.requested_exposure_amount ?? 0) - (c.actual_bill_amount ?? 0));
    return sum + outstanding;
  }, 0);

  const limit = party?.credit_line_amount ?? null;
  const available = limit !== null ? Math.max(0, limit - utilized) : null;
  const utilizationPct = limit && limit > 0 ? Math.round((utilized / limit) * 100) : null;

  return { limit, utilized, available, utilizationPct };
}
```

#### 1C — Display in Case Creation (Step 1 Party Selection)

**File:** `src/app/cases/new/actions.ts` — extend `fetchPartyDetails` to include credit line utilization:

```typescript
// In fetchPartyDetails, add to the return:
import { getCreditLineUtilization } from '@/utils/creditLine';

// At the bottom of fetchPartyDetails, before return:
const creditLine = await getCreditLineUtilization(partyId);

return { ...party, lastCase, creditLine };
```

**File:** `src/app/cases/new/NewCaseForm.tsx` — in the customer/contractor detail display box (the gray card that shows after selecting a party), add:

```tsx
{customerDetails?.creditLine?.limit && (
  <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs">
    <p className="font-semibold text-amber-800">Credit Line</p>
    <p className="text-amber-700">
      ₹{customerDetails.creditLine.utilized.toLocaleString('en-IN')} utilized of ₹{customerDetails.creditLine.limit.toLocaleString('en-IN')} limit
      ({customerDetails.creditLine.utilizationPct}%)
    </p>
    {customerDetails.creditLine.available !== null && customerDetails.creditLine.available <= 0 && (
      <p className="text-red-600 font-bold mt-1">⚠ Credit line exhausted</p>
    )}
  </div>
)}
```

---

### FEATURE 2 — Parameter Persistence Scope

**Summary:** Parameters tagged with `persistence_scope = 'party'` are stored when a case is submitted and pre-filled the next time the same party appears in a case.

**Prerequisites:** M2 migration must be run.

#### 2A — Policy Admin UI: Set persistence_scope per Parameter

**File:** `src/app/policy/parameters/page.tsx`

In the parameter table/form, add a dropdown column for `persistence_scope` with options:
- `none` → "Re-enter each case" (default)
- `party` → "Stored per party"
- `site` → "Stored per site"
- `rm` → "Stored per RM"

The existing parameter CRUD actions in `src/app/policy/actions.ts` must include `persistence_scope` in the insert/update calls. Find the `createParameter` and `updateParameter` actions and add this field.

#### 2B — Capture Parameter Values on Case Submission

**File:** `src/app/cases/new/actions.ts` — in `handleNewCase`, after `createCaseDraft` succeeds, add:

```typescript
// Persist party-scoped parameter answers back to party_parameter_values
// This runs after successful case creation
if (newCase?.id) {
  await persistPartyParameterValues({
    caseId: newCase.id,
    customerPartyId: customerPartyId || null,
    contractorPartyId: contractorPartyId || null,
    rmTaskAnswers,
    supabase,
  });
}

// Add this helper function in the same file (not exported — internal only):
async function persistPartyParameterValues({
  caseId,
  customerPartyId,
  contractorPartyId,
  rmTaskAnswers,
  supabase,
}: {
  caseId: string;
  customerPartyId: string | null;
  contractorPartyId: string | null;
  rmTaskAnswers: Record<string, any>;
  supabase: any;
}) {
  if (Object.keys(rmTaskAnswers).length === 0) return;

  // Fetch parameter scopes for all answered parameters
  const paramIds = Object.keys(rmTaskAnswers);
  const { data: params } = await supabase
    .from('parameter_definitions')
    .select('id, persistence_scope, subject_type')
    .in('id', paramIds);

  if (!params) return;

  const upserts: any[] = [];
  for (const param of params) {
    if (param.persistence_scope === 'none') continue;

    const answer = rmTaskAnswers[param.id];
    if (!answer) continue;

    // Determine which party to store against based on subject_type
    let targetPartyId: string | null = null;
    if (param.subject_type === 'customer') targetPartyId = customerPartyId;
    else if (param.subject_type === 'contractor') targetPartyId = contractorPartyId;
    else if (param.subject_type === 'case') {
      // 'case' type with party scope — store against customer (primary party)
      targetPartyId = customerPartyId || contractorPartyId;
    }

    if (!targetPartyId) continue;

    upserts.push({
      party_id: targetPartyId,
      parameter_id: param.id,
      grade_value: answer.grade_value ?? null,
      raw_input_value: answer.raw_input_value != null ? String(answer.raw_input_value) : null,
      captured_from_case: caseId,
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    await supabase
      .from('party_parameter_values')
      .upsert(upserts, { onConflict: 'party_id,parameter_id' });
  }
}
```

#### 2C — Pre-fill Party-Scoped Parameters in Step 5 (RM Intake)

**File:** `src/app/cases/new/actions.ts` — modify `fetchRmIntakeTasks` to also return stored values:

```typescript
export async function fetchRmIntakeTasks(scenario: string, customerPartyId?: string, contractorPartyId?: string) {
  // ... existing logic to fetch params ...

  const applicableParams = params.filter(...); // existing filter

  // Fetch stored party parameter values for pre-fill
  const partyIds = [customerPartyId, contractorPartyId].filter(Boolean);
  let storedValues: Record<string, { grade_value: number | null; raw_input_value: string | null; captured_at: string }> = {};

  if (partyIds.length > 0) {
    const paramIds = applicableParams.map(p => p.id);
    const { data: stored } = await supabase
      .from('party_parameter_values')
      .select('parameter_id, grade_value, raw_input_value, captured_at')
      .in('party_id', partyIds)
      .in('parameter_id', paramIds);

    for (const s of stored || []) {
      storedValues[s.parameter_id] = {
        grade_value: s.grade_value,
        raw_input_value: s.raw_input_value,
        captured_at: s.captured_at,
      };
    }
  }

  // Attach stored value to each param
  return applicableParams.map(p => ({
    ...p,
    storedValue: storedValues[p.id] || null,
  }));
}
```

**File:** `NewCaseForm.tsx` — update the `useEffect` that calls `fetchRmIntakeTasks` to pass party IDs:

```typescript
// BEFORE:
useEffect(() => {
  async function fetchTasks() {
    const tasks = await fetchRmIntakeTasks(scenario);
    setRmTasks(tasks);
  }
  fetchTasks();
}, [scenario]);

// AFTER:
useEffect(() => {
  async function fetchTasks() {
    const tasks = await fetchRmIntakeTasks(scenario, customerPartyId || undefined, contractorPartyId || undefined);
    setRmTasks(tasks);
    // Pre-fill answers from stored values
    const prefilledAnswers: Record<string, any> = {};
    for (const task of tasks) {
      if (task.storedValue && (task.storedValue.grade_value != null || task.storedValue.raw_input_value)) {
        prefilledAnswers[task.id] = {
          grade_value: task.storedValue.grade_value,
          raw_input_value: task.storedValue.raw_input_value,
        };
      }
    }
    // Merge with existing answers (don't overwrite if user already typed something)
    setRmTaskAnswers(prev => ({ ...prefilledAnswers, ...prev }));
  }
  fetchTasks();
}, [scenario, customerPartyId, contractorPartyId]);
```

In the Step 5 UI, for tasks that have a `storedValue`, show a note:

```tsx
{task.storedValue && (
  <p className="text-xs text-blue-600 mb-1">
    ↩ Pre-filled from last case ({new Date(task.storedValue.captured_at).toLocaleDateString('en-IN')}). Edit to update.
  </p>
)}
```

---

### FEATURE 3 — Case Maker Simplification

**Summary:**
- Remove Commercial Notes textarea from Step 4
- Hide Deal Size Bucket from Step 4 (UI only — still saved as empty, routing treats empty as wildcard per Fix D4)
- Merge Step 2 (Commercial Terms) into Step 1 (makes 4 steps total)
- Allow editing the auto-generated Site ID
- KAM assignee validated (Fix D1 already covers this)

#### 3A — Remove Commercial Notes

**File:** `src/app/cases/new/NewCaseForm.tsx`

1. Remove the state: delete `const [commercialNotes, setCommercialNotes] = useState('');`
2. Remove the textarea from Step 4 UI (the `Commercial Notes` input group)
3. Remove `fd.set('commercialNotes', commercialNotes);` from `handleSubmit`
4. In `src/app/cases/new/actions.ts`, change how `commercial_notes` is built:

```typescript
// BEFORE:
commercial_notes: `${commercialNotes}\n\nStrategic Justification: ${justification}`,

// AFTER (justification is the only text content now):
commercial_notes: justification ? `Strategic Justification: ${justification}` : '',
```

Note: `commercial_notes` column still exists on `credit_cases` and still holds data for old cases. The case detail view should display it read-only where it exists.

#### 3B — Hide Deal Size Bucket

**File:** `src/app/cases/new/NewCaseForm.tsx`

Simply remove or comment out the Deal Size Bucket `<div className={styles.inputGroup}>` block from Step 4. The `dealSizeBucket` state still exists and still sends an empty string to the server — this is fine because Fix D4 makes empty string a wildcard in routing. The `case_attributes.deal_size_bucket` will be saved as empty string for new cases.

#### 3C — Merge Step 2 into Step 1 (4-step wizard)

**File:** `src/app/cases/new/NewCaseForm.tsx`

This is a UI restructure. Here's the new step mapping:

| New Step | Content |
|----------|---------|
| Step 1 | Scenario + Parties + Site + Bill Amount + Requested Exposure + KAM |
| Step 2 | Tranche Builder (unchanged) |
| Step 3 | Context & Justification (without Commercial Notes and without Deal Bucket) |
| Step 4 | RM Intake Questions (unchanged) |

**Changes:**
1. Update the sidebar step labels array:
```typescript
// BEFORE:
['Scenario & Parties', 'Commercial Terms', 'Tranche Builder', 'Context', 'Intake Questions']

// AFTER:
['Parties & Terms', 'Tranche Builder', 'Context', 'Intake Questions']
```

2. Move the Bill Amount and Requested Exposure inputs (currently `{step === 2 && ...}`) into the `{step === 1 && ...}` block, directly below the KAM assignee field.

3. Update `canGoNext(1)` to also validate `billAmount > 0 && requestedExposure > 0 && requestedExposure <= billAmount`.

4. Renumber all step checks: what was `step === 3` becomes `step === 2`, what was `step === 4` becomes `step === 3`, what was `step === 5` becomes `step === 4`.

5. Update all "Back" button `onClick` handlers to use the new step numbers.

6. Remove the `{step === 2 && ...}` JSX block entirely (it's now merged into step 1).

#### 3D — Allow Editing the Auto-Generated Site ID

**File:** `src/app/cases/new/NewCaseForm.tsx`

Currently the Site ID is shown in a read-only `<div>`. Replace it with an editable input that is pre-populated by the preview but can be overridden:

```tsx
// BEFORE:
<div className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm opacity-80 items-center font-mono font-semibold text-primary">
  {generatedSiteId || 'Select city...'}
</div>

// AFTER:
<div className="relative">
  <input
    type="text"
    value={generatedSiteId}
    onChange={e => setGeneratedSiteId(e.target.value.toUpperCase())}
    className={`${styles.input} font-mono font-semibold`}
    placeholder="Select city to auto-generate..."
    maxLength={30}
  />
  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
    editable
  </span>
</div>
```

The `setGeneratedSiteId` state setter already exists. This change just switches the display from a static div to an editable input.

---

### FEATURE 4 — Collections Improvements

**Summary:** Per-tranche view, quick "Log Payment" inline, better overdue metrics, and role-filtered view (C3 fix already covers role filtering).

#### 4A — Per-Tranche Detail in Collections Client

**File:** `src/app/collections/CollectionsClient.tsx`

Replace the current card display for each overdue case. Instead of showing a single "X days overdue" badge, expand to show each overdue tranche individually:

```tsx
// Add this helper function at the top of CollectionsClient.tsx:
function computeOverdueTranches(c: Case): {
  trancheIndex: number;
  expectedAmount: number;
  paidAmount: number;
  dueDate: Date;
  daysOverdue: number;
  outstanding: number;
}[] {
  if (!c.billing_date || !(c as any).proposed_tranches || !(c as any).decided_bill_amount) return [];
  const billingDate = new Date(c.billing_date);
  const billAmt = (c as any).decided_bill_amount;
  let remaining = (c as any).actual_bill_amount ?? 0;
  const now = new Date();
  const result = [];

  for (let i = 0; i < (c as any).proposed_tranches.length; i++) {
    const t = (c as any).proposed_tranches[i];
    const amt = t.type === 'percentage'
      ? Math.round((t.value / 100) * billAmt)
      : Math.round(t.value);
    const fill = Math.min(remaining, amt);
    remaining -= fill;
    const unpaid = amt - fill;
    if (unpaid > 0) {
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
      if (daysOverdue > 0) {
        result.push({ trancheIndex: i, expectedAmount: amt, paidAmount: fill, dueDate: due, daysOverdue, outstanding: unpaid });
      }
    }
  }
  return result;
}
```

In the card for each case, replace the single "X Days Overdue" line with a list of overdue tranches:

```tsx
{computeOverdueTranches(c).map(t => (
  <div key={t.trancheIndex} className="flex items-center gap-3 text-sm mt-1">
    <span className="text-destructive font-semibold">
      Tranche {t.trancheIndex + 1}: ₹{t.outstanding.toLocaleString('en-IN')} outstanding
    </span>
    <span className="text-muted-foreground text-xs">
      Due {t.dueDate.toLocaleDateString('en-IN')} · {t.daysOverdue} days overdue
    </span>
  </div>
))}
```

#### 4B — Quick "Log Payment" Modal in Collections

**File:** `src/app/collections/CollectionsClient.tsx`

Add a "Log Payment" button to each case card. This opens a small inline form (use a `<dialog>` or a conditional expand) that submits directly to `handleLogPayment` from `billing-actions.ts`:

```tsx
// Add state at top of CollectionsClient:
const [loggingPaymentForCase, setLoggingPaymentForCase] = useState<string | null>(null);
const [paymentAmount, setPaymentAmount] = useState('');
const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
const [paymentNote, setPaymentNote] = useState('');
const [paymentSubmitting, setPaymentSubmitting] = useState(false);
const [paymentError, setPaymentError] = useState('');

// Import at top of file:
import { handleLogPayment } from '@/app/cases/[id]/billing-actions';

// Add this log payment handler:
const handleQuickLogPayment = async (caseId: string) => {
  setPaymentSubmitting(true);
  setPaymentError('');
  const fd = new FormData();
  fd.set('caseId', caseId);
  fd.set('amount', paymentAmount);
  fd.set('paymentDate', paymentDate);
  fd.set('description', paymentNote || 'Logged from Collections dashboard');
  try {
    await handleLogPayment(fd);
    setLoggingPaymentForCase(null);
    setPaymentAmount('');
    setPaymentNote('');
  } catch (e: any) {
    setPaymentError(e.message);
  } finally {
    setPaymentSubmitting(false);
  }
};

// In the case card, add a "Log Payment" button alongside the Escalate button:
<Button
  type="button"
  variant="outline"
  size="sm"
  className="border-green-500 text-green-700 hover:bg-green-50"
  onClick={() => setLoggingPaymentForCase(loggingPaymentForCase === c.id ? null : c.id)}
>
  ₹ Log Payment
</Button>

// Below each card, conditionally show the quick payment form:
{loggingPaymentForCase === c.id && (
  <div className="mt-3 p-4 border border-green-200 rounded-md bg-green-50 space-y-3">
    <p className="text-sm font-semibold text-green-800">Log a Payment</p>
    <div className="flex gap-3">
      <input
        type="number"
        placeholder="Amount (₹)"
        value={paymentAmount}
        onChange={e => setPaymentAmount(e.target.value)}
        className="flex-1 border rounded px-2 py-1 text-sm"
      />
      <input
        type="date"
        value={paymentDate}
        onChange={e => setPaymentDate(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      />
    </div>
    <input
      type="text"
      placeholder="Note (optional)"
      value={paymentNote}
      onChange={e => setPaymentNote(e.target.value)}
      className="w-full border rounded px-2 py-1 text-sm"
    />
    {paymentError && <p className="text-xs text-red-600">{paymentError}</p>}
    <div className="flex gap-2">
      <Button size="sm" onClick={() => handleQuickLogPayment(c.id)} disabled={!paymentAmount || paymentSubmitting}>
        {paymentSubmitting ? 'Saving...' : 'Save Payment'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setLoggingPaymentForCase(null)}>Cancel</Button>
    </div>
  </div>
)}
```

#### 4C — Sort and Filter Controls in Collections

**File:** `src/app/collections/CollectionsClient.tsx`

Add sort options and an overdue-days filter above the case list:

```tsx
// Add state:
const [sortBy, setSortBy] = useState<'overdue_days' | 'outstanding' | 'name'>('overdue_days');
const [minOverdueDays, setMinOverdueDays] = useState(0);

// Sort and filter filtered array:
const sorted = [...filtered]
  .filter(c => {
    const maxOverdue = Math.max(...computeOverdueTranches(c).map(t => t.daysOverdue), 0);
    return maxOverdue >= minOverdueDays;
  })
  .sort((a, b) => {
    if (sortBy === 'overdue_days') {
      const aMax = Math.max(...computeOverdueTranches(a).map(t => t.daysOverdue), 0);
      const bMax = Math.max(...computeOverdueTranches(b).map(t => t.daysOverdue), 0);
      return bMax - aMax;
    }
    if (sortBy === 'outstanding') return getOutstanding(b) - getOutstanding(a);
    return getCustomerName(a).localeCompare(getCustomerName(b));
  });

// Add this above the list:
<div className="flex items-center gap-4">
  <label className="text-sm font-medium">Sort by:</label>
  <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-sm border rounded px-2 py-1">
    <option value="overdue_days">Most Days Overdue</option>
    <option value="outstanding">Highest Outstanding</option>
    <option value="name">Customer Name</option>
  </select>
  <label className="text-sm font-medium">Min overdue days:</label>
  <input type="number" value={minOverdueDays} min={0} onChange={e => setMinOverdueDays(parseInt(e.target.value) || 0)} className="w-16 text-sm border rounded px-2 py-1" />
</div>
```

Use `sorted` instead of `filtered` in the `.map()` below.

---

### FEATURE 5 — Role-Specific Dashboards

**Current state:** Only RM gets a role-specific dashboard view. KAM, approver, board member, accounts, and admin see the generic dashboard.

**File:** `src/app/page.tsx`

The dashboard is one large server component. The approach is to build separate sub-sections by role, each fetching only what that role needs.

#### 5A — KAM Dashboard Section

Add a `isKam` flag (similar to `isRm`). When `isKam`, show:

1. **Cases Awaiting My Action** — cases where `kam_user_id = user.id` AND `status IN ('In Review', 'Awaiting Input')`
2. **Cases Pending Approval** — cases where `kam_user_id = user.id` AND `status = 'Awaiting Approval'`
3. **Billing Active — Collections View** — cases where `kam_user_id = user.id` AND `status IN ('Billing Active', 'Pending Write-Off Approval')`
4. **Recent Activity** — last 5 cases assigned to this KAM

```typescript
// Add in DashboardPage server component after the isRm check:
const isKam = role === 'kam';

let kamData: {
  awaitingAction: any[];
  pendingApproval: any[];
  billingActive: any[];
} | null = null;

if (isKam && user) {
  const [awaitingRes, approvalRes, billingRes] = await Promise.all([
    supabase.from('credit_cases')
      .select('id, case_number, status, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .eq('kam_user_id', user.id)
      .in('status', ['In Review', 'Awaiting Input'])
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('credit_cases')
      .select('id, case_number, status, bill_amount, created_at, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .eq('kam_user_id', user.id)
      .eq('status', 'Awaiting Approval')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('credit_cases')
      .select('id, case_number, status, bill_amount, billing_date, decided_bill_amount, actual_bill_amount, customer:parties!credit_cases_customer_party_id_fkey(legal_name)')
      .eq('kam_user_id', user.id)
      .in('status', ['Billing Active', 'Pending Write-Off Approval'])
      .order('billing_date', { ascending: true })
      .limit(20),
  ]);
  kamData = {
    awaitingAction: awaitingRes.data || [],
    pendingApproval: approvalRes.data || [],
    billingActive: billingRes.data || [],
  };
}
```

In the JSX, render KAM-specific bento cards when `isKam`:
- "Cases Needing Your Attention" card (count + list) → links to `/cases?status=In+Review`
- "Pending Approval" card → links to `/cases?status=Awaiting+Approval`
- "Active Collections" card (sum of outstanding) → links to `/collections`

#### 5B — Approver Dashboard Section

```typescript
const isApprover = role === 'ordinary_approver';
let approverData: { pendingRounds: any[] } | null = null;

if (isApprover && user) {
  // Find approval rounds where this user is listed as an approver but hasn't decided yet
  const { data: pendingDecisions } = await supabase
    .from('approval_rounds')
    .select(`
      id, stage, round_type, created_at,
      review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(
        case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount,
          customer:parties!credit_cases_customer_party_id_fkey(legal_name))
      ),
      my_decision:approval_decisions!approval_rounds_id_fkey(decision)
    `)
    .eq('status', 'open')
    // Note: The approver must have been notified. Filter by rounds where they haven't decided.
    .limit(20);

  // Filter client-side to rounds where user has no decision yet
  // (In a full implementation this would be a better SQL query with a NOT EXISTS subquery)
  approverData = {
    pendingRounds: (pendingDecisions || []).filter((r: any) => {
      const myDecisions = r.my_decision || [];
      return !myDecisions.some((d: any) => d.approver_id === user.id);
    }),
  };
}
```

Render: "Pending Your Vote" card with count and list of cases. Link each case to `/cases/[id]`.

#### 5C — Board Member Dashboard Section

```typescript
const isBoardMember = role === 'board_member';
let boardData: { openVotes: any[] } | null = null;

if (isBoardMember && user) {
  const { data: openVotes } = await supabase
    .from('board_rounds')
    .select(`
      id, vote_window_end,
      approval_round:approval_rounds!board_rounds_approval_round_id_fkey(
        review_cycle:review_cycles!approval_rounds_review_cycle_id_fkey(
          case:credit_cases!review_cycles_case_id_fkey(id, case_number, bill_amount,
            customer:parties!credit_cases_customer_party_id_fkey(legal_name))
        )
      )
    `)
    .eq('status', 'open')
    .gt('vote_window_end', new Date().toISOString())
    .limit(10);
  boardData = { openVotes: openVotes || [] };
}
```

Render: "Open Board Votes" card. Show deadline countdown for each vote. Link to `/cases/[id]/board`.

#### 5D — Admin Dashboard Section

The admin already sees System Audit and Admin Panel shortcuts. Add:

- **Pending Credit Notes** — count of `credit_notes WHERE status = 'pending'`
- **Pending Write-Off Approvals** — count of `credit_cases WHERE status = 'Pending Write-Off Approval'`
- **Recent Import Jobs** — last 3 import jobs with status

```typescript
if (isAdmin) {
  const [creditNotesRes, writeOffsRes, importsRes] = await Promise.all([
    supabase.from('credit_notes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('credit_cases').select('id', { count: 'exact', head: true }).eq('status', 'Pending Write-Off Approval'),
    supabase.from('import_jobs').select('id, import_type, status, records_total, records_failed, created_at').order('created_at', { ascending: false }).limit(3),
  ]);
  // ... render these as stat cards in the bento grid
}
```

---

## PART 4 — EXECUTION ORDER

Run these steps in the exact order listed. Do not skip.

1. **Run M1 migration** (credit_line_amount on parties)
2. **Run M2 migration** (persistence_scope + party_parameter_values)
3. **Run M3 migration** (escalation_level on credit_cases + escalation_thresholds view)
4. **Run M4 migration** (original_tranches on credit_cases)
5. **Run M5 migration** (import_type constraint update)
6. **Fix A1** (all 3 files for escalation system) — requires M3 to be done
7. **Fix A2** (import mapping applied) — no dependency
8. **Fix B3** (tranche restructure) — requires M4 to be done
9. **Fix B4** (payment edit reopens case) — no dependency
10. **Fix B5** (close guard on uninitialized billing) — no dependency
11. **Fix B6** (staleness display for overdue_days) — create `src/utils/dateHelpers.ts` first
12. **Fix B7** (recompute party history action) — no dependency
13. **Fix C1, C2, C3** (RBAC filters) — no dependency, do all three
14. **Fix D1** (KAM validation) — no dependency
15. **Fix D2** (grade labels from policy) — no dependency
16. **Fix D3** (date auto-band) — no dependency
17. **Fix D4** (routing wildcard for empty bucket) — no dependency
18. **Fix D5** (site ID unique index) — run the SQL first, then update code
19. **Fix E1, E2** are included inside Fix A2 code block (already written there)
20. **Fix G1** (stage_max_totals validation) — no dependency
21. **Fix G2** (weight matrix default indicator) — no dependency
22. **Feature 1** (credit line) — requires M1 to be done
23. **Feature 2** (parameter persistence) — requires M2 to be done
24. **Feature 3** (case maker simplification) — no migration needed, UI only
25. **Feature 4** (collections improvements) — requires A1 fixes to be done
26. **Feature 5** (dashboards) — no dependency, can be done last

---

## PART 5 — VERIFICATION CHECKLIST

After completing all changes, verify each item manually or with a test user account.

### Bug Fixes
- [ ] Escalate button in Collections doesn't throw a 400 error
- [ ] Collections page loads without "relation escalation_thresholds does not exist" error
- [ ] Overdue count shows only cases with actual past-due unpaid tranches (not all billing-active cases past composite_credit_days)
- [ ] Overdue total shows outstanding amount (not full bill amount)
- [ ] Create a case, approve it, set billing, restructure tranches twice — second restructure should still block if total extension > MAX_EXTENSION_DAYS
- [ ] Log a payment, then edit it downward below promised — case should reopen to "Billing Active"
- [ ] Try to close a case with no billing_date set — should get error message
- [ ] Party exposure overdue days shows "(as of X days ago)" tooltip
- [ ] Cases list as RM role — only shows my cases
- [ ] Direct URL `/cases/[other-rm-case-id]` as RM — should return 404
- [ ] Create a case without selecting a KAM — "Continue" button should stay disabled
- [ ] Grade labels in Step 5 (RM Intake) match what admin set in Policy → Grade Scale

### New Features
- [ ] Admin can set credit line on a party from admin panel
- [ ] Party with credit line shows utilization bar when selected in case creation
- [ ] Parameter with `persistence_scope = 'party'` is pre-filled in Step 5 on second case for same party
- [ ] Case maker is 4 steps (no "Commercial Terms" as standalone step)
- [ ] Commercial Notes textarea is gone
- [ ] Deal Size Bucket dropdown is gone
- [ ] Site ID field is editable
- [ ] Collections page shows per-tranche overdue breakdown
- [ ] "Log Payment" button on collections card opens inline form and saves successfully
- [ ] KAM dashboard shows "Cases Awaiting Action" and "Active Collections" sections
- [ ] Approver dashboard shows "Pending Your Vote" list
- [ ] Board member dashboard shows "Open Board Votes" with deadlines
- [ ] Admin dashboard shows pending credit notes and write-off count
- [ ] CSV import with a template selected applies column remapping
- [ ] CSV import with duplicate `legal_name` and no `customer_code` returns an actionable error

---

## PART 6 — KNOWN DEFERRED ITEMS (RLS Phase)

These will be handled in a separate migration after the above is stable:

- Replace `auth_read` / `auth_write` blanket RLS policies with row-level filters:
  - `credit_cases`: RM can only see `rm_user_id = auth.uid()`, KAM sees `kam_user_id = auth.uid()`, approvers see cases in their `approval_rounds`, board members see cases in their `board_rounds`, admin sees all
  - `stage_tasks`, `approval_rounds`, `board_rounds`: follow same pattern
- Until then, app-layer filters (Part 2, C1–C3) provide the access control boundary

---

*End of Implementation Plan — Total items: 22 bug fixes, 5 feature areas, 5 migrations*
