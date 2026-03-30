# Doc Phase 2: Features & Metrics Engineering

This document details the mathematical models and specialized backend features running Phase 2.

---

## 1. Margin Module
The margin captures the financial viability of a Relationship Manager's executed deals across an inclusive invoice.

* **Formula:** `Average Margin (%) = ((Sum of Actuals / Sum of Decided) - 1) * 100`
* **Constraint Limits:** The metric relies on the total financial mass of the bill. It does not strip out taxes.
* **Negative Impact Rules:** If a case is sent directly to `Pending Write-Off Approval` and no further payments are extracted, the `Actuals` rest permanently below `Decided`, inherently dragging down the RM’s Average Margin proportionally.
* **Overpayment:** The system inherently accepts positive margins unconditionally if the customer willfully overpays or accepts late fees without generating dedicated "Account Balances".

---

## 2. Promised Day Collection Rate (PDCR)
The PDCR defines performance against time. Since simple counts can distort large financial defaults, PDCR is tracked via three distinctive vectors. 
*Note: PDCR is strictly capped at `100% max` per case to prevent a drastically early repayment from skewing the aggregated average.*

### Variant A: Count-Based PDCR
Focuses on operational consistency. 
* **Calculation:** `(Number of Tranches fully cleared by their deadline / Total Scheduled Tranches) * 100`

### Variant B: Amount-Based PDCR
Focuses on deep financial exposure.
* **Calculation:** `(Aggregate ₹ Funds cleared strictly on or before their due baseline / Total Promised Bill Amount) * 100`
* **Mechanics:** If a ₹1,00,000 Tranche misses a deadline but a ₹10,000 partial payment arrived securely on time, the vector explicitly rewards the proportional ₹10,000 in the numerator rather than blankly flunking the entire tranche value.

### Variant C: Weighted Days PDCR
A macroscopic reflection of the time-cost of capital.
* **Calculation:** `(Weighted Average Credit Days Initially Promised / Weighted Average Exact Days Collected Realized) * 100`
* **Example:** Promised at 30 days. Collected practically at 45. `(30 / 45) * 100 = 66%`.

---

## 3. Repayment Bucketing Logic
To preserve database simplicity, Kam reps do not "Target" specific tranches with individual payments. 
* **The Waterfall:** When an actual payment (e.g., ₹60,000) lands, the system mathematically drains the earliest chronological tranche (e.g., Tranche 1: Day 30 - ₹40,000). The overflowing cascade instantly dumps the remaining ₹20,000 precisely into Tranche 2's bucket. 
* **Equal Prioritization:** If two Tranches are inexplicably logged directly into the precise same Day target, the system fundamentally prioritizes filling them in database creation order.

---

## 4. The Write-Off Workflow (Escrow Closure)
Automatic bill closures fire inherently when `Actual Bill Amount == Promised Bill Amount`. However, failure scenarios trigger Write-Offs:
* If the KAM attempts to "Close Case" but the `Actual` falls below the `Promised` baseline.
* The system evaluates against a global `WRITE_OFF_SLIPPAGE_PERCENTAGE` (Admin parameterized setting).
* If the breach exceeds the acceptable percentage threshold, the active status forcibly transitions to `Pending Write-Off Approval`, trapping the Ledger in a frozen escrow queue strictly awaiting Founder investigation.
