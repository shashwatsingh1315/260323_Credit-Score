# Doc Phase 2: Screens & UI Documentation

This document explicitly outlines the required User Interface changes, new screens, and modifications to existing views necessary to support the Phase 2 Billing & Collections lifecycle.

---

## 1. The RM Dashboard
The RM (Relationship Manager) Dashboard shifts from focusing purely on credit evaluation to tracking post-approval collections and margins.

### 1.1 New Metric Cards
The top metric grid must be updated with real-time financial data:
- **Total Active Exposure (₹):** Sum of outstanding balances for all cases managed by the RM in `Billing Active` and `Pending Write-Off Approval` states.
- **Average Margin (%):** Computed globally across the RM’s portfolio.
- **Count PDCR (%):** Tranches Paid on Time / Total Scheduled Tranches.
- **Amount PDCR (%):** Rupee Value Paid on Time / Total Rupee Value Scheduled.
- **Weighted Days PDCR (%):** Proposed aggregate credit days vs effectively realized collected days.

### 1.2 Case List Table Additions
The main table listing active cases must display specific collection constraints:
- **Upcoming Payment:** Shows the date of the next due tranche (e.g., `Nov 12th`).
- **Delayed Payment Trigger:** If a tranche breaches its due date, the row automatically highlights the delay state (e.g., `₹50,000 Overdue (10 Days)`).

---

## 2. Case Workspace - `Ledger & Billing` Tab
Inside individual case views (`/cases/[id]`), the obsolete manual "Realized Outcome" tab is entirely replaced by a highly dynamic `Ledger & Billing` tab.

### 2.1 The Billing Frame (RM Input Area)
- Exposes two primary input fields: **Decided Bill Amount** and **Promised Bill Amount**, along with an input for the **Billing Date**.
- **Dynamic Lock Indicator:** If `repayments` count > 0, these input fields turn into exact read-only text elements.

### 2.2 The Tranche Waterfall Visualization
- A real-time visual cascade showing scheduled Tranches visually filling up as payments arrive.
- Each bucket displays: `Expected Amount`, `Due Date`, `Paid Amount`, and a color-coded status (`Paid`, `Delayed`, `Upcoming`).

### 2.3 Repayment Input Form (KAM Access Only)
- **Amount (₹):** Auto-fills with the remaining exact rupee balance of the earliest unfunded tranche.
- **Payment Date:** Date picker for when the funds hit the bank.
- **Reference URL:** Text input to optionally link digital receipts, bank uploads, or UTR images.
- **Description:** Text area for structural comments.

### 2.4 The Payment Log (Audit History)
- An append-only list beneath the Repayment Input Form.
- Shows every historically logged payment for the case.
- Includes Edit/Delete icons (generating backend audit trails) specifically for KAMs to correct typos or reverse fat-finger errors (e.g., 500,000 instead of 50,000).

---

## 3. Operations Controls

### 3.1 Credit Note Modal (Post-Lock Edits)
- If the case is Locked (payments exist) and a discrepancy occurs (e.g., damaged goods), a KAM/RM clicks **"Issue Credit Note"**.
- Triggers a modal requiring the `Reduction Amount (₹)` and an exhaustive `Reason` text layer.

### 3.2 The Cancel Order Toggle
- Located in the header action bar. Only visible when `Actual Amount == 0`.
- Allows the immediate abortion of a finalized order before money changes hands.

---

## 4. Contractor Reputation MVP
- Located as a static sub-panel either at the bottom of the `Ledger` tab or inside the main `Overview` layout.
- For Phase 2, this is strictly a Markdown-rendered/Static checklist reminding the KAM of ground-truth checks required before further scaling limits.
  1. **On Ground Reputation:** Ask workers, laborers, chaiwalas on payment timeliness.
  2. **Vendor Check:** Consult third-party plumbers, civil contractors.
  3. **Premiumness Metrics:** Determine brand utilization (TMT, CEMENT, PIPE prestige levels).
