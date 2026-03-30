# Doc Phase 2: Execution & Chronological Flows

This document sequences how physical interactions mutate the data structures across the exact operational timeline of Phase 2.

---

## Flow 1: Initialization & The Lock Point
1. **Approval Gate:** The previous credit evaluation formally reaches an `Approved` state.
2. **RM Mapping:** The RM negotiates with the operational buyers and subsequently inputs the definitive `billing_date`, `decided_bill_amount`, and `promised_bill_amount` inside the Case Ledger Tab.
3. **Status Shift:** The UI updates displaying the Case securely as `Billing Active`.
4. **The Lock Event:** The KAM inputs the absolutely first `repayment` value. A backend lock securely prevents the RM from continually shifting the Decided/Promised goalposts, solidifying margin evaluation permanently.

*Alternative Edge Case:* If the total physical order is completely reversed prior to dispatch, the KAM utilizes the "Cancel Order" action. The case instantly transitions to `Cancelled/Aborted` and zeroes out active visual exposure.

---

## Flow 2: Structured Repayment Collection 
1. **Invoice Receipt:** A customer generates a capital transfer matching the expected tranche targets.
2. **Ledger Action:** The KAM opens the `Ledger` tab. The `Amount` input mechanically pre-fills pulling the `remaining_balance` derived precisely from the earliest chronological tranche array.
3. **Waterfall Execute:** The KAM clicks Save. The exact mathematical quantity sequentially zeroes out Tranche 1, wrapping excess inherently to Tranche 2 utilizing DB creation indices natively for conflict sorting.
4. **Metric Update:** The RM Dashboard universally auto-calculates the 3 PDCR variants pulling from the fresh `payment_date` stamps structurally mapped against the tranche countdown clocks. 

---

## Flow 3: Restructuring & Default Friction
1. **Customer Negotiates Extension:** Before a Tranche crashes into a Delayed parameter marking poor PDCR, the KAM intercepts and pushes the Tranche Date explicitly farther forward in time. 
2. **Admin Ceiling Guard:** The system dynamically queries the DB parameter `MAX_TRANCHE_EXTENSION_DAYS`. If the KAM over-extends past the ceiling, the action rigidly fails, guaranteeing consequence visibility.
3. **Credit Note Dispute:** Goods drop on site. The client demands a structural cost reduction. Because the fields are successfully auto-locked by Flow 1, the KAM generates a `Credit Note`. The Admin views the queue, presses "Approve", mathematically drawing down the `Promised` baseline, actively protecting the mathematical PDCR margin cleanly from generating arbitrary "Missing Payment" penalties over dropped loads.

---

## Flow 4: Closing the Book
1. **Capital Realization Complete:** Successive KAM logs successfully equate `Actual == Promised`. The UI functionally recognizes parity and gracefully switches Case Status directly to `Closed` removing UI action requirements. 
2. **Capital Default (The Write-Off):** The timeline formally ends. Customers actively refuse specific remainder payments. The KAM attempts to physically execute closure. The system cross-references the gap against `WRITE_OFF_SLIPPAGE_PERCENTAGE`.
3. **Admin Escrow Trap:** Finding the gap too large, the system structurally denies typical completion. Status fires actively to `Pending Write-Off Approval`. 
4. **Final Closure:** Only the `Founder_Admin` holds authorization to manually view the trapped escrow state and actively override the database, converting the finalized failure parameters officially into a `Closed` status whilst preserving the massive margin penalty visibly pinned directly to the RM profile.
