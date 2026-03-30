# Doc Phase 2: Database Schema Additions

Phase 2 replaces manual arrays and ambiguous statuses with rigid relational accounting tables. All financial aggregates must enforce *Integer nearest-whole-rupee* precision computationally.

---

## 1. Credit Cases (Modifications)
`credit_cases` acts as the root ledger containing the overarching financial aggregates mathematically synced via database triggers or transaction loops as sub-tables expand.

| Column Name | Type | Modifiers | Description |
|---|---|---|---|
| `billing_date` | `timestamp` | `nullable` | Exact date initiating the Tranche countdown clocks. |
| `decided_bill_amount` | `integer` | `nullable` | Original sold-price of materials determining Margins. |
| `promised_bill_amount` | `integer` | `nullable` | Agreed payment baseline determining Collection Rates. |
| `actual_bill_amount` | `integer` | `default 0` | Inherently auto-summed derivation of `sum(repayments.amount)`. |

**Enum Expansion: `case_status`**
- `Billing Active`: Case running post RM initialization.
- `Pending Write-Off Approval`: Actual completely falls short of Promised upon closure attempt.
- `Cancelled/Aborted`: Customer cancels order completely pre-payment.

---

## 2. Repayments (New Table)
An immutable ledger storing raw payment receipts physically extracted from the field.

| Column Name | Type | Modifiers | Description |
|---|---|---|---|
| `id` | `uuid` | `primary key` | Unique ledger entry. |
| `case_id` | `uuid` | `fk -> credit_cases` | Active context relation. |
| `amount` | `integer` | `not null` | Nearest-rupee transfer sum. |
| `payment_date` | `timestamp` | `not null` | Chronological date the capital hit the corporate bank. |
| `reference_url` | `text` | `nullable` | URL linking UTR images/receipts. |
| `description` | `text` | `nullable` | Extraneous commentary on the ledger entry. |
| `logged_by` | `uuid` | `fk -> profiles` | The KAM or Admin user inserting the track. |
| `created_at` | `timestamp` | `not null` | Immutable backend insert log. |

---

## 3. Credit Notes (New Table)
Official financial reduction tracks preventing the RM from illegally shrinking Promised rates post-lock when real-world damages occur.

| Column Name | Type | Modifiers | Description |
|---|---|---|---|
| `id` | `uuid` | `primary key` | Unique credit note. |
| `case_id` | `uuid` | `fk -> credit_cases` | Case receiving adjustments. |
| `reduction_amount` | `integer` | `not null` | Extent of value completely knocked off the Promised/Decided baseline. |
| `reason` | `text` | `not null` | Full written justification for the business loss. |
| `status` | `varchar` | `default 'pending'` | `pending`, `approved`, `rejected` pipeline states for Admin review. |
| `logged_by` | `uuid` | `fk -> profiles` | User initiating note. |
| `approved_by` | `uuid` | `fk -> profiles` | Validating admin signature. |

---

## 4. System Settings (New Table)
A generic key-value dictionary removing globally parameterized constants from hardcoded frontend code.

| Column Name | Type | Modifiers | Description |
|---|---|---|---|
| `key` | `varchar` | `unique, pk` | Identifier (e.g., `MAX_TRANCHE_EXTENSION_DAYS`). |
| `value` | `numeric` | `not null` | Scalable programmatic constant interpreted globally across calculations. |
