# Party Types and Influencer Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the party registration process to properly categorize parties as 'customer', 'influencer', or 'both', and introduce influencer subtypes ('contractor', 'interior').

**Architecture:** We will add `party_type` and `influencer_subtype` TEXT columns to the Supabase `parties` table via a SQL migration. We will update the React Admin UI (`PartyDialog.tsx`, `AdminClient.tsx`) to capture and display these fields. We will update the Next.js server actions (`actions.ts`, `csv.ts`) to persist them. Finally, we will update the Case Intake Wizard (`cases/new/page.tsx`) to strictly filter its dropdowns based on `party_type`.

**Tech Stack:** Next.js (App Router), React, Supabase (PostgreSQL), TypeScript.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260402000001_phase2_add_party_types.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add party_type and influencer_subtype to parties table
ALTER TABLE public.parties 
ADD COLUMN IF NOT EXISTS party_type TEXT,
ADD COLUMN IF NOT EXISTS influencer_subtype TEXT;

-- Update existing records to have a safe default if needed (optional, assuming 'both' for existing backward compatibility)
UPDATE public.parties 
SET party_type = 'both' 
WHERE party_type IS NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260402000001_phase2_add_party_types.sql
git commit -m "chore(db): add party_type and influencer_subtype columns"
```

### Task 2: Backend - Server Actions & CSV

**Files:**
- Modify: `src/app/admin/actions.ts`
- Modify: `src/utils/csv.ts`

- [ ] **Step 1: Modify `upsertParty` payload in `actions.ts`**

In `src/app/admin/actions.ts`, update the `payload` inside `upsertParty`:

```typescript
    const payload: any = {
      legal_name: formData.get('legal_name') as string,
      customer_code: formData.get('customer_code') as string,
      party_type: formData.get('party_type') as string || 'both',
      influencer_subtype: formData.get('influencer_subtype') as string || null,
      gst_number: formData.get('gstin') as string || null,
      pan_number: formData.get('pan') as string || null,
      address: [formData.get('city'), formData.get('state')].filter(Boolean).join(', ') || null,
      industry_category: formData.get('industry_sector') as string || null,
      is_active: true,
    };
```

- [ ] **Step 2: Modify `fetchParties` query in `actions.ts` to explicitly select new fields (if needed, though `select('*')` is used)**

(Ensure `fetchParties` is `select('*')` - it is already doing this, so no change needed there).

- [ ] **Step 3: Modify `parsePartiesCsv` in `csv.ts`**

Update `PartyImportRow` interface in `src/utils/csv.ts`:

```typescript
export interface PartyImportRow {
  legal_name: string;
  customer_code: string;
  party_type: string | null;
  influencer_subtype: string | null;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  credit_limit: number | null;
  is_active: boolean;
}
```

And inside `parsePartiesCsv`:

```typescript
    const party_type = (obj.party_type || '').trim() || 'both';
    const influencer_subtype = (obj.influencer_subtype || '').trim() || null;
// ...
    parsedParties.push({
      legal_name,
      customer_code,
      party_type,
      influencer_subtype,
      gst_number,
      pan_number,
      address,
      credit_limit,
      is_active: true
    });
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/actions.ts src/utils/csv.ts
git commit -m "feat(backend): support party_type and influencer_subtype in actions and csv import"
```

### Task 3: Admin UI - PartyDialog

**Files:**
- Modify: `src/components/admin/PartyDialog.tsx`

- [ ] **Step 1: Add state for dynamic dropdowns**

Inside `PartyDialog` component:

```tsx
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(editingParty?.party_type || 'both');
```

- [ ] **Step 2: Update the form fields**

Replace the existing `Party Type` block with:

```tsx
            <div className="space-y-1">
              <Label>Party Type</Label>
              <select 
                name="party_type" 
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="customer">Customer</option>
                <option value="influencer">Influencer</option>
                <option value="both">Both</option>
              </select>
            </div>
            
            {(selectedType === 'influencer' || selectedType === 'both') && (
              <div className="space-y-1">
                <Label>Influencer Subtype</Label>
                <select 
                  name="influencer_subtype" 
                  defaultValue={editingParty?.influencer_subtype || 'contractor'}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="contractor">Contractor</option>
                  <option value="interior">Interior</option>
                </select>
              </div>
            )}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/PartyDialog.tsx
git commit -m "feat(ui): update PartyDialog to support dynamic influencer subtypes"
```

### Task 4: Admin UI - Party Master List

**Files:**
- Modify: `src/app/admin/AdminClient.tsx`

- [ ] **Step 1: Update table headers**

Find the `<TableHeader>` for parties and add a column for Type:

```tsx
                  <TableRow>
                    <TableHead>Legal Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
```

- [ ] **Step 2: Update table rows**

Inside the `parties.map((p) =>` loop, output the type and subtype:

```tsx
                        <TableCell>
                          <span className="capitalize">{p.party_type || 'Both'}</span>
                          {p.influencer_subtype && (
                            <span className="text-xs text-muted-foreground ml-1">({p.influencer_subtype})</span>
                          )}
                        </TableCell>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/AdminClient.tsx
git commit -m "feat(ui): display party type and subtype in AdminClient table"
```

### Task 5: Case Intake Wizard

**Files:**
- Modify: `src/app/cases/new/page.tsx`
- Modify: `src/app/cases/new/actions.ts`

- [ ] **Step 1: Update `fetchParties` query to ensure columns are fetched**

In `src/app/cases/new/actions.ts`:

```typescript
export async function fetchParties() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('parties')
    .select('id, legal_name, customer_code, industry_category, party_type, influencer_subtype')
    .eq('is_active', true)
    .order('legal_name')
    .limit(200);
  return data || [];
}
```

- [ ] **Step 2: Filter dropdowns in `page.tsx`**

In `src/app/cases/new/page.tsx`, filter the `parties` array for the customer dropdown:

```tsx
                  <select value={customerPartyId} onChange={e => setCustomerPartyId(e.target.value)} className={styles.input}>
                    <option value="">-- Select Customer --</option>
                    {parties
                      .filter(p => !p.party_type || p.party_type === 'customer' || p.party_type === 'both')
                      .map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.customer_code ? `(${p.customer_code})` : ''}</option>)}
                  </select>
```

Filter and rename the Contractor dropdown:

```tsx
                  <div className="flex justify-between items-center mb-1">
                    <label className="mb-0">Contractor / Influencer Party *</label>
// ...
                  <select value={contractorPartyId} onChange={e => setContractorPartyId(e.target.value)} className={styles.input}>
                    <option value="">-- Select Influencer --</option>
                    {parties
                      .filter(p => p.party_type === 'influencer' || p.party_type === 'both' || p.party_type === 'contractor')
                      .map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.influencer_subtype ? `[${p.influencer_subtype}]` : ''}</option>)}
                  </select>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/cases/new/page.tsx src/app/cases/new/actions.ts
git commit -m "feat(ui): filter Case Intake dropdowns based on party type"
```
