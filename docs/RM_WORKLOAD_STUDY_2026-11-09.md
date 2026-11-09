# RM Workload Study — 2026-11-09

**Ship the incremental redesign: fix correctness and dead fields first, then cut the repeat-case ask to about 4 decisions, then give the RM the likely outcome before submit**

*Method: 5 read-only measurement agents (field inventory, KLM task-load model, lifecycle touchpoints, policy question load, India lending patterns), 3 competing redesigns, 3 judges (RM, head of credit risk, engineering lead), synthesis. Numbers are code-derived estimates, not timed sessions; re-baseline with real RMs.*

## Verdict on today

Intake asks the RM for things the system already knows or nothing reads. 27 of 37 inputs and decisions need no fresh typing. 3 of the 9 required non-question inputs (Strategic Justification, Site Address, City Code) feed nothing beyond the site ID, and the site ID feeds nothing. The server enforces 4 business rules and trusts the client on the rest. The RM gets no useful answer back: no terms, no ETA, no named blocker. The after-submit loop (about 11 re-entries, about 7 minutes per case) costs more than a repeat-customer intake. Three RM home queues lead to actions the RM cannot finish. All figures come from reading code and migrations (KLM-style model); no DB or app run, so they are estimates.

## Baseline

**Intake today (KLM model estimates, not timed sessions)**

| Scenario | Clicks | Typed fields / keystrokes | Decisions | In tool | Total with lookups |
|---|---|---|---|---|---|
| A: new customer | 45 | 16 / 178 | 20 | 196 s | 471 s (7.9 min) |
| B: repeat customer, saved answers | 26 | 7 / 68 | 15 | 126 s | 211 s (3.5 min) |
| C: repeat customer + new contractor | 48 | 16 / 158 | 25 | 221 s | 441 s (7.3 min) |
| C2: both parties new | 67 | 24 / 268 | 29 | 294 s | 684 s (11.4 min) |

- Party creation is the largest single cost (74 to 141 s in tool). The add-party dialog has 13 controls; Credit Limit is silently dropped.
- Repeat customers re-key steps 2 and 3 from blank (about 62 s in tool) even though last case, KAM and city are already stored.
- Mandatory decisions for a repeat-party case: about 9 + N today (N = RM policy questions; the live count is unknown because no parameter seed exists in the repo).
- Hidden costs: un-resumable drafts (+60 to 100 s expected per new-customer case), lost work on navigation, duplicate case on retry.

**After submit (happy path, modelled)**
- About 11 re-entries, 36 clicks, 102 keystrokes, 34 decisions: about 298 s in tool plus about 120 s chasing the KAM outside the tool, about 7 minutes per case.
- Status polling is about half of that (4 checks, 144 s). Expected branch cost: return-for-revision about +46 s per case, withdraw and re-intake about +23 s.
- The RM cannot close any of its three home queues: Returned (resubmit is KAM-only), Approved ("Record accepted terms" is KAM/admin-only on the server), Drafts (no resume path).
- 5 notification types reach the RM with no link, no reason and no terms. About 9 lifecycle events send nothing.

## Target

**Targets (design estimates, to be re-baselined with real sessions)**
- Repeat intake: about 53 s in tool and total (-58% in tool, -75% total). About 8 clicks, 2 typed numbers plus Confirm all.
- New customer, GSTIN-first: about 105 s total (-78%). Add-party dialog from 13 controls to about 4.
- Repeat customer with a new contractor: about 170 to 200 s total (-55% to -60%, rougher estimate).
- After submit: about 26 s over about 3 touches (-91%).
- Mandatory decisions for a repeat-party case: about 9 + N becomes about 4 + N_judgement.

**North-star metric:** median RM minutes from "New case" to a submitted case that carries a stated likely outcome, plus RM touches after submit per case. The "under 60 s" brief is met for the repeat-party commercial ask only. Report 105 s as the honest cold-start number.

## Principles

1. Ask only what the system cannot know. Ask it once, at the moment it matters.
2. Nothing is silently dropped. Every deferred item becomes a named task with an owner, the stage it blocks and a due date, and it appears in the receipt.
3. Every prefilled or derived value shows its source and date, can be overridden, and carries a staleness flag when old. Confirm all must not become rubber-stamping.
4. Give the answer while filing, not after: likely terms, required stage and why, headroom, next owner, SLA date. Label it indicative until grades are computed on the server.
5. Server is the authority. Enforce rules on the server before any UI relies on client-computed values.
6. Remove dead fields before building new UI. Fix correctness before changing the RM's clicks.
7. Never offer the RM an action the server will refuse. Align vocabulary owners with server guards.
8. Higher grade means better, with polarity stated and colour following grade quality, not a blanket green.

## Recommended design

**Chosen: Concept 1 (incremental), all three judges agreed.** It keeps the 4-step wizard, data model and scoring engine; Phase 0 needs no schema change and delivers real cuts in days. Concepts 2 and 3 offer better outcome surfaces but bundle a one-screen rewrite and post-submit lifecycle work into the same plan, so value arrives later and with more risk. The lifecycle work is kept as a separate follow-on plan.

**Grafts**
- From Concept 2: idempotency token and server-side grade re-derivation in Phase 0. Submit review lists blockers by field name with jump links, and a disabled Continue names the first missing item. Provenance chips with source and date on every prefilled or derived value. Single server-side retry on site-ID collision.
- From Concept 3: receipt splits owners into "Yours now", "Waiting on KAM" and "Auto-sourced". Every deferred item names its owner and blocked stage. Tranche template scaled from the last case's schedule to the new exposure. Gate any post-submit next-owner display on fixing the vocabulary.ts owner mismatches.
- Judge corrections to Concept 1: history_classification has no writer in src (DB default 'first_time'), so repeat-conditional rules never fire today; set it from the last case in Phase 0. partyTypeForDialog is used at NewCaseForm.tsx:85 but not passed to PartyDialog. updateCycleScore is called only in the workspace (actions.ts:375, :503), never at intake submit. The credit-line check selects the party by scenario prefix, so the paying-party fix changes the selection, not just adds a check.

**RM journey (repeat customer)**
1. Server-side type-ahead across name, display name, code, GSTIN, PAN, aliases. Recent and "my" parties first. Picking a party loads its card: credit line and headroom, outstanding, overdue amount and days, preapproved credit-days band (only when sufficient_history), open-case warning, last case. Scenario defaults from last case or party type; "Who pays?" shows only when ambiguous.
2. Commercial ask prefilled from the last case. Site value is the only blank field, with a lakh/crore echo. One credit control (₹ with % echo, default last-case ratio). Tranche template chips ("Same as last case", "100% at preapproved band"). Add-tranche fills the remaining balance at last days + 30.
3. Site and handoff mostly disappears: KAM prefilled (last case, else RM's most frequent KAM, with "why"), city prefilled, site ID derived on server and read-only. Site address and justification leave the form.
4. Questions: reused answers in one "Pre-filled (n)" block with Confirm all and per-row edit. Only required judgement questions with no saved value are asked. Optional questions become post-submit RM tasks. Reason box only when require_reasoning or grade is below the reused value.
5. Submit: server re-checks everything. Receipt shows likely terms, required stage and why, next owner, SLA date, blockers and deferred tasks.

**New customer:** GSTIN-first inline dialog. Offline parse gives PAN (characters 3 to 12), state (digits 1 to 2) and a checksum. Legal name is pre-seeded from the search text. Phone for the influencer slot only. Type from the slot. Code generated on the server. City from city_codes defaulting to last case. Dedupe on GSTIN or PAN. The new party's card loads immediately.

**Live outcome rail (steps 2 to 4; one-line collapse on phone)**
- Likely terms: band 30 to 45 days (n prior cases) or "no band, policy default".
- Requested vs band: "inside band, expect fast path" or "N days above, expect negotiation".
- Routing: "Stage 2 because exposure is above ₹X" (describeRoutingOutcome moved to a shared module).
- Headroom on the paying party, and KAM owner.
- Always labelled indicative.

**After-submit output**
Receipt replaces "Stage 1 tasks created". Notifications for Returned, Approved and Rejected carry a one-line answer and a deep link. Full loop (RM in-review queue, resubmit path) is the follow-on plan.

## Field fates

| Field | Fate | Source / new owner |
|---|---|---|
| 1.1 Case scenario | DEFAULT | Last case scenario, else party type; "Who pays?" only if ambiguous |
| 1.2 Customer party | KEEP | Server-searched combobox; prefill from party page |
| 1.3 Contractor party | KEEP | Combobox |
| P.1 Legal name | KEEP | Pre-seeded from search text |
| P.2 Customer code | DERIVE | Server, all party types; ERP match moves to import/aliases |
| P.3 Auto-generate button | REMOVE | Automatic |
| P.4 Party type | DERIVE | Slot that opened dialog (wire partyTypeForDialog) |
| P.5 Subtype | DEFAULT | contractor; contractor slot only |
| P.6 Phone | KEEP | Influencer slot only |
| P.7 Nickname | DEFER | Party-master enrichment (KAM/admin) |
| P.8 GSTIN | KEEP | RM; checksum and dedupe |
| P.9 PAN | DERIVE | GSTIN chars 3 to 12 |
| P.10 City | DEFAULT | city_codes picker, last case city |
| P.11 State | DERIVE | GSTIN digits 1 to 2 |
| P.12 Industry | DEFER | KAM/admin enumeration |
| P.13 Credit limit | REMOVE | Silently dropped today; credit line stays with admin credit-line actions |
| 2.1 Site value | KEEP | RM; lakh/crore echo; server rejects ≤ 0 |
| 2.2 + 2.3 Credit share | KEEP (merged) | One control, ₹ with % echo, default last-case ratio |
| 2.4 Tranche type | REMOVE | One stored unit; unit decision pending (open decision 1) |
| 2.5 Tranche value | DEFAULT | Remaining balance; scaled last-case template |
| 2.6 Tranche days | DEFAULT | Last composite days, else policy_max_days, else policy default |
| 2.7 Add tranche | DEFAULT | Remaining balance at last days + 30 |
| 2.8 Remove tranche | KEEP | RM |
| 3.1 City code | PREFILL | Party city or last case city |
| 3.2 Site ID | DERIVE | Server, read-only, retry on collision |
| 3.3 Site address | DEFER | Visible task, owner RM, blocks billing activation |
| 3.4 KAM | PREFILL | Last case KAM, else RM's most frequent; editable with source shown |
| 3.5 Strategic justification | REMOVE (or scored parameter) | Written to commercial_notes only; confirm no reader outside src first |
| branch_id | PREFILL (silent) | profiles.branch_id |
| history_classification | DERIVE (silent) | Prior case exists; makes repeat rules work |
| 4.1 Reused party answers | PREFILL | One Confirm all; provenance and staleness flag; fix wrong-party carry-over first |
| 4.2 System-backed numeric answers | DERIVE | Server from party_history / party_exposure (Phase 3) |
| 4.3 Required judgement questions | KEEP | RM; the core ask |
| 4.4 Optional RM questions | DEFER | Pending RM task after submit (already generated) |
| 4.5 Free-text questions | DEFER | Reviewer stage or optional (not scored) |
| 4.6 Reason per question | DEFAULT (collapsed) | Required if require_reasoning or grade below reused |
| 4.7 History-conditional questions | REMOVE from intake until history is derived | Then keep |
| 4.8 Draft vs submit | KEEP + autosave | Resume by case id, idempotency token |
| Likely-outcome rail | ADD | preapproval.ts, routing.ts, party_exposure |

Totals: KEEP 10, PREFILL 3, DERIVE 6, DEFAULT 7, DEFER 5, REMOVE 6 (37 items; 27 need no fresh typing).

## After-submit (lifecycle) fixes

**Gating dependencies for the outcome loop (separate follow-on plan after Phase 2; lifecycle study, code-read only)**
- Align vocabulary.ts owners with server guards. Approved says rm but the server allows kam; Accepted says kam but the server allows rm. Until then, do not surface "next owner" promises for those states.
- Returned for revision: add an RM-capable "amend and resubmit" path (new review cycle on the same case using existing cycle numbering). Clear the stale "Returned for revision" substatus on resubmit. Reset or pause the SLA on return. Fix the false dialog copy.
- Record accepted terms: let the RM do it, or stop offering the button. Make final_accepted_tranches carry the negotiated schedule. Point ledger and collections at final_* terms.
- Close the bypass: handleSaveBillingDetails has no status guard, so an RM can move Approved to Billing Active and skip acceptance.
- Notifications: add link_url and a one-line answer (days, reason, deadline) to every type. Add events for task assigned, RM task becomes actionable, Accepted, board outcome, validity near and past expiry, bill attached.
- RM "In review" home queue: blocked by X since, due D. Deep links with ?tab=.
- Collections: RM cannot log a call or PTP; escalation is assigned to the escalator and nobody is notified.
- Expiry: "Expired" is never set and there is no new-cycle path.

## Phased plan

### Phase 0: correctness and dead weight — about 0.5 to 1 week (3 to 5 days)

**Load cut:** About 3 required fields and 4 silent failures removed; few clicks saved but no more duplicate cases, wrong-party limit checks or zero-bill submits. Repeat-case decisions about 9 + N down to about 7 + N.

**Schema:** No schema change expected beyond an idempotency key column or lookup (confirm against migrations). Tranche unit decision must be made before any tranche consumer changes.

- Server checks in cases/new/actions.ts: party present for scenario, bill > 0, exposure ≤ bill, required questions, require_reasoning, tranche reconciliation even at ₹0 exposure
- Credit-line check on the paying party (change the party selection by scenario, actions.ts:60 and NewCaseForm.tsx:384, 599)
- Idempotency token on case creation; site ID derived on the server with one retry on unique-index collision
- Re-derive grades for system-backed numeric questions on the server (run in shadow mode and compare first)
- Set branch_id from profiles.branch_id; set history_classification from the existing last case
- Remove credit_limit from PartyDialog; pass partyTypeForDialog to the dialog; party card loads after create
- Add-tranche fills remaining balance instead of ₹0 at 0 days
- Remove justification field (pending decision 2); stop requiring site address and city-code select at filing

### Phase 1: party and defaults — about 1 to 2 weeks

**Load cut:** Most of the new-customer saving: dialog 13 controls to about 4; new-customer intake from about 471 s toward about 200 s. Repeat-case decisions to about 5 + N.

**Schema:** No for offline GSTIN parse. A unique-constraint or dedupe check on gst_number/pan_number needs a read-only duplicate report first. Deferred-task owner/stage fields may need a column.

- Server-side party combobox over name, display name, code, GSTIN, PAN, aliases (replaces the 200-row select)
- GSTIN-first dialog with offline parse (checksum, PAN, state), dedupe warning, server-generated code for all types, city from city_codes
- Defaults: scenario from last case or party type; KAM from last case then RM's most frequent; lakh/crore echo; single credit control in ₹ with % echo
- Open-case warning and preapproved band shown on the party card
- Disabled Continue names the first missing item; site address becomes an owned task that blocks billing activation

### Phase 2: outcome and template — about 2 to 3 weeks

**Load cut:** Most of the repeat-customer saving: about 126 s toward about 53 s in tool; after-submit from about 7 minutes toward about 26 s over about 3 touches once lifecycle fixes land.

**Schema:** Likely notifications.link_url; possibly fields for deferred-task owner and blocked stage. Draft resume needs no new table if keyed by case id.

- Last-case template: tranche chips scaled to new exposure, credit share default
- Sticky outcome rail (preapproved band, requested vs band, routing reason via shared module, headroom, KAM), labelled indicative
- Reused answers as one Confirm all block with provenance, dates and staleness flag; fix wrong-party carry-over first; write back only on submit
- Reason box gated; optional questions to post-submit RM tasks
- Receipt with likely terms, stage and why, owners split (Yours now / Waiting on KAM / Auto-sourced), SLA date, blockers, deferred tasks; call updateCycleScore at intake submit
- Autosave and resume at /cases/new?draft=id; Continue draft in home queue
- Vocabulary owners aligned with server guards; notifications get link_url and one-line answer

### Phase 3: server-derived answers — about 3+ weeks, separate plan

**Load cut:** Removes an estimated 20 to 40% of factual RM questions (estimate; live count unmeasured) and the client-trusted grade risk.

**Schema:** Yes: source key on parameter_definitions or auto_band_config; KYB fields (constitution, gst_status, gst_registered_on) only if KYB is adopted. Changes scores on existing cases, so needs a comparison run on closed cases.

- Add a source key to auto_band_config (party_history.*, party_exposure.*) resolved server-side with provenance
- Admin: editable is_required and conditional_rules; warn when a new parameter adds a required RM question; revisit admin defaults (customer / stage 1 / RM / required)
- Consider KYB/GSP autofill only after a legal check on regulated-data access, gated by exposure

## Open product decisions

1. Tranche unit: store ₹ or % of exposure? Intake reconciles % against exposure, but billing-actions.ts:89, metrics.ts:108 and page.tsx:175 apply % to decided_bill_amount, and spec doc 04 says reconcile to the bill. Owner: product with finance/billing. Blocks Phase 0 tranche changes; needs legacy-row conversion and an in-flight case audit.
2. Strategic justification: drop it, or convert it to a scored customer/contractor parameter (case-subject parameters do not score)? Owner: credit policy and audit. Confirm no report or export outside src reads commercial_notes.
3. Site address: is deferring to billing setup acceptable, and does an unfilled address block billing activation? Confirm no external template reads it.
4. Who may record accepted terms and resubmit after a return: should the RM be allowed, or should the UI stop offering those actions? Decides the vocabulary.ts versus server guard alignment.
5. Preapproved band shown to RMs: acceptable as an indicative range with its basis (n prior cases, window), given anchoring risk in negotiation?
6. Default KAM: last case, then RM's most frequent KAM, or introduce an RM-to-KAM table? Defaults must stay visible and editable.
7. Should optional and free-text RM questions be deferred or dropped, and should admin defaults (required, stage 1, RM-owned) change? Needs the live parameter count from the read-only SQL in the question-load study.
8. Duplicate parties: run a read-only GSTIN/PAN duplicate report, then decide whether to enforce uniqueness.
9. Server grade re-derivation: shadow mode on closed cases first; who signs off on score movement?
10. Whether to pursue KYB/GSP data pulls at all, pending a legal check on regulated-data access (AA FIU status, bureau membership).

## Success metrics

- Median RM minutes from New case to submitted, split repeat vs new customer (target about 53 s and about 105 s)
- Clicks and typed keystrokes per submitted case (baseline 26 / 68 repeat, 45 / 178 new)
- Mandatory decisions per repeat-party case (target about 4 + N_judgement)
- RM touches after submit per case (baseline about 11; target about 3)
- Share of Continue/Submit blocks that name the missing item (target 100%)
- Duplicate case rate on retry and draft-resume success rate (target 0 duplicates)
- Share of reused answers confirmed unchanged vs edited, and age at confirmation (guards against rubber-stamping)
- Requested days vs preapproved band, and negotiation rounds for inside-band vs above-band cases
- Server rejections by rule (bill ≤ 0, missing party, required questions) to confirm the server checks are hitting
- RM-to-KAM relays outside the tool (survey proxy; baseline about 120 s per case chasing)

## How the judges scored it

All three judges picked Concept 1 (incremental) as winner. It scored highest on feasibility and time to value (8 to 9 on both), because Phase 0 needs no schema change and keeps the wizard, data model and scoring intact. Concept 2 scored best on outcome clarity (rail, blockers, provenance) but lowest on feasibility and time to value (5 to 6) because it rewrites the wizard into one screen and bundles post-submit work. Concept 3 scored best on invariants (deferred items become named owned tasks) but only 6 to 7 on feasibility, since the tracker depends on lifecycle and vocabulary fixes. The judges verified several claims by grep: credit_limit is still rendered and not mapped, Add Tranche inserts a ₹0/0-day row, commercial_notes is written with no src reader, and history_classification has no setter. They corrected three points: updateCycleScore is never called at intake (not never called at all), partyTypeForDialog is used but not passed to the dialog, and the credit-line check picks the party by scenario prefix. They asked for the idempotency token and server grade re-derivation to move into Phase 0, blocker lists with jump links, provenance chips, the owner-split receipt and scaled tranche templates. Judges only did read-only checks; no database, remote service or credentials were used.

---

# Appendix: measurement reports

## field-inventory

**Key numbers**

- 37 RM-facing inputs and decisions inventoried: 3 in step 1, 13 in the add-party dialog, 8 in step 2, 5 in step 3, 8 question classes and actions in step 4
- Fate totals: KEEP 10 · PREFILL 3 · DERIVE 6 · DEFAULT 7 · DEFER 5 · REMOVE 6 (27 of 37 do not need fresh RM typing)
- 3 of the 9 required non-question intake inputs (Strategic Justification, Site Address, City Code) are read by nothing beyond the site ID, and the site ID is read by nothing
- Add-party dialog: 13 controls; 1 (Credit Limit) is silently dropped by upsertParty; it could shrink to about 4
- Mandatory decisions for a repeat-party case: about 9+N today vs about 4+N_judgement under the proposed fates
- Server enforces only 4 business rules (role, KAM on submit, tranche reconciliation when exposure > 0, credit line); 9 client-required rules have no server check
- 1 field with real spare capacity: party_preapproved_bands (likely credit-days band) is computed but shown nowhere in intake

## CreditFlow intake: field-by-field inventory (lens: field inventory)

Scope: everything an RM has to see, decide or type to file a case. That covers `/cases/new` steps 1 to 4 in `src/app/cases/new/NewCaseForm.tsx`, the add-party dialog (`src/components/admin/PartyDialog.tsx` going to `upsertParty` in `src/app/admin/actions.ts:30-67`), the dynamic stage-1 questions (`fetchRmIntakeTasks`, `actions.ts:271-314`) and the server action `handleNewCase` (`actions.ts:12-129`). Each field is traced to the code that reads it. Everything here comes from reading code and migrations. No database was queried, so the actual parameter rows are described by class, not by name.

Fate key: **KEEP** (only the RM knows it) · **PREFILL** (the system already holds it) · **DERIVE** (can be computed from other inputs) · **DEFAULT** (a smart default the RM can override) · **DEFER** (move to a later actor or stage) · **REMOVE** (nothing reads it, or it is a duplicate).
Cognitive class: Rec = recognition · Recall · Look = look up elsewhere · Judg = judgement · Mech = mechanical typing or arithmetic.

---

### Step 1: Scenario and parties

| # | Label / control | Type | Req (client / server) | Decision asked | Class | Read by | Fate |
|---|---|---|---|---|---|---|---|
| 1.1 | Case Scenario * | select, 3 options, default `customer_name_customer_pays` (`NewCaseForm.tsx:454`) | always set / DB NOT NULL + CHECK only; the action does no validation | Who is billed and who pays | Judg + Rec | routing rule `context_rule.scenario` (`routing.ts:23`, `engine.ts:152-156`); which question subjects apply (`actions.ts:283-290`, `engine.ts:254-261`); `conditional_rules.scenarios`; which party's credit line is checked (`actions.ts:60`) | **DEFAULT**: use the scenario of the party's last case (`credit_cases.case_scenario`). Ask it after the party is picked, as a plain "Who pays? Customer / Contractor" choice. Infer contractor/contractor when only an influencer-type party is chosen. |
| 1.2 | Customer Party * | native select, capped at 200 (`actions.ts:141`, `NewCaseForm.tsx:474`) | needed if the scenario includes a customer / **no server check** | Which entity | Rec / Look | `credit_cases.customer_party_id`, which every later screen uses | **KEEP**, as a server-searched combobox. PREFILL when the case is started from a party page. |
| 1.3 | Contractor / Influencer Party * | native select (`:513`) | needed if the scenario includes a contractor / **no server check** | Which entity | Rec / Look | `contractor_party_id`; also the credit-line party for contractor/contractor | **KEEP** (combobox) |

Things the RM sees in step 1 (no input):
- Scenario hint "Billed to X · payment from Y" (`:457`). KEEP.
- Two party context cards (`:480-497`, `:519-536`): industry, credit limit, outstanding, location, last-case value and days. KEEP, with additions:
  - an open-case or duplicate warning (doctrine §12.3);
  - `party_exposure.overdue_amount` and `overdue_days`, which are stored but never shown;
  - the **preapproved credit-days band** from `party_preapproved_bands`. `src/utils/preapproval.ts` computes it, but only `/admin/parties/[id]` reads it. It is the "likely terms" answer, and the RM never sees it.
- `fetchPartyDetails` also loads `gst_number`, `pan_number`, `contact_phone` and `display_name` (`actions.ts:159`). None of them are displayed, so that part of the query does nothing.

### Add-party dialog (opened from "Add New" in step 1)

| # | Label | Type | Req (client / server) | Decision | Class | Read by (traced) | Fate |
|---|---|---|---|---|---|---|---|
| P.1 | Legal Name (PAN Name) * | text | HTML required / DB NOT NULL | Exact legal name | Mech / Recall | `parties.legal_name`, shown on every screen | **KEEP**, pre-seeded from the combobox search text |
| P.2 | Customer Code / ID * | text (`:114`) | HTML required / none; there is **no unique constraint** in the schema | ERP code or ID | Look | the CSV import join key (`admin/imports/actions.ts:97-153`, `onConflict: 'customer_code'`); search (`search/page.tsx:44`); picker label | **DERIVE**: generate on the server when left blank (influencers already have `idEngine.generateContractorId` / `generateInteriorId`). Matching the ERP code for customers moves to Accounts/admin through import or aliases. |
| P.3 | Auto-Generate button | action (`:109`) | — | Remember to click it | Mech | fills P.2 | **REMOVE**: generate automatically |
| P.4 | Party Type | select, default 'both' (`:119`) | — | customer / influencer / both | Judg | the picker filters (`NewCaseForm.tsx:477, 516`), search, aliases | **DERIVE** from the slot that opened the dialog. `partyTypeForDialog` exists (`NewCaseForm.tsx:63`) but is never passed to the dialog. |
| P.5 | Influencer Subtype | select, default 'contractor' | — | contractor / interior | Rec | ID engine branch (`PartyDialog.tsx:57`), contractor card label | **DEFAULT** 'contractor'; show it only for the contractor slot |
| P.6 | Contact Phone | text | optional, but the ID engine needs it (`:50`) | Phone number | Recall | last 5 digits feed the ID (`idEngine.ts:84`); stored, nothing else in `src` reads it | **KEEP** (influencer slot only); collections will need it |
| P.7 | Nickname (Market Name) | text | optional | Market name | Recall | appended to the contractor ID only (`idEngine.ts:91-95`) | **DEFER** to later party-master enrichment |
| P.8 | GSTIN | text, no format check | optional | GSTIN | Look | stored, shown in admin; nothing dedupes or scores on it | **KEEP** (optional), as the single identifier PAN and state are derived from. Add a dedupe check against existing parties. |
| P.9 | PAN | text | optional | PAN | Look | stored, admin display | **DERIVE**: characters 3-12 of the GSTIN |
| P.10 | City ("3 letters for ID code") | free text (`:166`) | optional | City | Recall | `address` string; the ID engine uses the **first 3 letters of the free text** (`:46`), so "Raipur" becomes "RAI", not RPR. `city_codes` is ignored. | **DEFAULT**: pick from `city_codes`, defaulting to the city of the RM's last case (`case_attributes->>city_code`) |
| P.11 | State | free text | optional | State | Recall | `address` string only | **DERIVE** from the GSTIN state digits, or from the city |
| P.12 | Industry Sector | free text | optional | Sector | Judg | `industry_category`: intake card, admin, imports. Not scored. | **DEFER** to KAM/admin enrichment, as an enumeration |
| P.13 | Credit Limit (₹) | number, `name="credit_limit"` (`:176-179`) | optional | Credit limit | Judg | **None**. `upsertParty` never maps it, and the real column is `credit_line_amount`, which only `admin/parties/[id]/credit-line-actions.ts` sets. | **REMOVE**: an RM should not set their own limit, and the value is silently thrown away |

### Step 2: Commercial ask

| # | Label | Type | Req (client / server) | Decision | Class | Read by | Fate |
|---|---|---|---|---|---|---|---|
| 2.1 | Total Site Value (₹) * | number (`:557`) | > 0 to continue / **none**: `parseFloat()\|\|0`, no > 0 check | Quote value | Recall | `bill_amount`: Overview and Approvals, TermsLadder, billing fallback (`billing-actions.ts:100`), metrics. Passed to `validateCreditLine` but not used there. | **KEEP** |
| 2.2 | Expected Credit Exposure (%) * | range slider (`:568`) | > 0 and ≤ bill / server accepts the exposure the client computed (`actions.ts:24`) | How much goes on credit | Judg | `requested_exposure_amount`: routing `exposure_min`, credit-line check, composite-day weights, tranche reconciliation | **KEEP**, as one control that takes either ₹ or %. Default to the party's last-case ratio (`lastCase.requested_exposure_amount / bill_amount`, which is already fetched). Derive the ₹ amount on the server. |
| 2.3 | % number box (same value as 2.2) | number (`:580-591`) | — | The same choice again | Mech | duplicate of 2.2 | **REMOVE** (merge with 2.2) |
| 2.4 | Tranche row: Type | select amount / % (`:617`) | — | ₹ or % | Mech | `proposed_tranches[].type`. **The base differs by consumer.** Intake reconciles % against *exposure* (`:218`), but `billing-actions.ts:89-91`, `metrics.ts:108-110` and `page.tsx:175-177` apply % to `decided_bill_amount`, and spec doc 04 says tranches reconcile to the *bill*. With 40% credit, "100% @ 30d" becomes the whole bill due at billing. | **REMOVE**: store one normalized unit (₹ or % of exposure) and fix the consumers to match |
| 2.5 | Tranche row: Value | number | must reconcile (client; server only on submit **and only if exposure > 0**, `actions.ts:52`) | How to split | Mech (arithmetic) | composite days (`engine.ts:93`), billing schedule | **DEFAULT**: first row 100%; each added row pre-filled with the unallocated balance |
| 2.6 | Tranche row: Days after billing | number | none (0 allowed) | Requested terms | Judg | `composite_credit_days`: Overview and Approvals, preapproval empirical band (`preapproval.ts:261-271`), billing due dates | **DEFAULT**: party's last `composite_credit_days`, otherwise `party_preapproved_bands.policy_max_days`, otherwise the policy default (today hard-coded 30, `:166`) |
| 2.7 | Add Tranche | button; appends ₹0 @ 0d (`:222`), which breaks reconciliation straight away | — | Add a row | Mech | — | **DEFAULT**: the new row gets the remaining balance at last days + 30 |
| 2.8 | Remove tranche | button | — | — | Mech | — | **KEEP** |

Things the RM sees in step 2:
- ₹ exposure readout: KEEP.
- Credit-limit breach warning (`:598-603`): KEEP, but it checks the wrong party. `scenario.startsWith('customer')` picks the customer for `customer_name_contractor_pays`, where the contractor pays. The server does the same at `actions.ts:60`.
- Summary panel with 5 lines (`:633-660`): keep "Remaining" and "Composite days", REMOVE the other 3, and ADD per-row due dates (doctrine §12.3).

### Step 3: Site and handoff

| # | Label | Type | Req (client / server) | Decision | Class | Read by | Fate |
|---|---|---|---|---|---|---|---|
| 3.1 | City Code * | select from `city_codes` (`:684`) | needed to continue / **none** | Site city | Recall | **Only the site ID** (`generateSiteIdPreview`, `actions.ts:319-353`, where the sequence query uses `case_attributes->>city_code`). Stored in `case_attributes.city_code`; no screen reads it back. | **PREFILL** from the party address city, or the RM's last-case city |
| 3.2 | Site ID | **editable** text, upper-cased, max 30 (`:691`) | none / none, but there is a unique index `idx_credit_cases_site_id` | Accept or edit the ID | Mech | Nothing reads it except the review row. The server never regenerates it, so a collision (two tabs, or an edited ID) throws a generic error. | **DERIVE** on the server at submit (`idEngine.generateLeadSiteId`); make it read-only |
| 3.3 | Site Address * | textarea (`:696`) | needed to continue / **none** | Street address | Recall / typing | **None.** Written to `case_attributes.site_address` and never read anywhere in `src`. | **DEFER** to the RM or KAM at billing setup, when delivery and collections visits need it |
| 3.4 | KAM Assignee | select of all KAMs, no default (`:700`) | needed to submit / needed to submit (`actions.ts:32`) | Who owns the case | Rec | `kam_user_id`: notification (`engine.ts:218`), KAM queue (`cases/page.tsx:75`), ownership | **PREFILL** from the party's last case `kam_user_id`, otherwise the RM's most frequent KAM (`credit_cases` grouped by `rm_user_id`). No RM-to-KAM mapping table exists. |
| 3.5 | Strategic Justification * | select from `admin_enumerations` 'reason_for_credit' (`:708`) | needed to continue / **none** | Why credit is justified | Judg | Written only as `commercial_notes = "Strategic Justification: …"` (`actions.ts:82`). **No code in `src` ever reads `commercial_notes`.** | **REMOVE**, or have policy admins turn it into a scored case-subject parameter if they want its signal |

Fields the RM never sees but should be set:
- `credit_cases.branch_id`: never passed, even though `profiles.branch_id` exists (`auth.ts:56`) and spec doc 04 says it "should default from the RM profile". Silent **PREFILL**.
- `history_classification`: never written, so it stays at the DB default 'first_time' for every case. Silent **DERIVE** from whether a prior case exists (`lastCase` is already fetched). Today every `conditional_rules.history = 'repeat'` parameter is dead.

### Step 4: Questions and review (dynamic, set by policy)

What gets shown: rows from `parameter_definitions` where `stage = 1`, `is_active`, `default_owning_role = 'rm'`, the subject matches the scenario, and `conditional_rules.scenarios` matches (`actions.ts:292-311`). Each question renders an answer control, an always-optional reason textarea (`:817`), rubric guidance, a provenance chip when the answer was reused, and an "Auto-mapped to Grade N" line. Scoring reads **only `grade_value`** (`scoring.ts:39, 70`).

| # | Question class | Control | Req (client / server) | Class | Read by | Fate |
|---|---|---|---|---|---|---|
| 4.1 | Party-scope question that already has a saved value (`persistence_scope='party'`) | any | `is_required` (client) / **none on the server** | Rec | `party_parameter_values`, pre-filled now (`:111-127`); becomes the task grade (`engine.ts:308-322`) | **PREFILL**, plus a single "Confirm all reused (n)" button. The chip says "confirm or update" but has no confirm control. Fix the wrong-party carry-over (study #3). Write back only on submit. |
| 4.2 | Numeric question whose value the system already holds (`party_history`: order_count, total_volume, payment_recency_days, average/max delay; `party_exposure`: outstanding/overdue; case: bill, exposure, composite days) | number + auto-band | as above | Look | auto-band grade, worked out **on the client** and trusted by the server (study #62) | **DERIVE** on the server from those tables (`is_stable` already marks these) |
| 4.3 | Required judgement question with no saved value (grade_select, yes_no, dropdown/link_list, date) | select / date | `is_required` (client only) | Judg | `stage_tasks.grade_value`, then scoring | **KEEP**: this is the core of what only the RM knows |
| 4.4 | Optional RM question (`is_required=false`) | any | — | Judg | `generateStageTasks` already creates it as a **Pending task assigned to the RM** when it is unanswered (`engine.ts:318-319`) | **DEFER** to an RM post-submit task |
| 4.5 | Free-text question (short_text / long_text; long_text renders as a one-line input) | text | as above | Mech | `raw_input_value` only. **No grade, so it adds nothing to the score.** | **DEFER** to the reviewer stage, or make it optional |
| 4.6 | Reason / notes per question | textarea, always "(optional)" | — / — (`require_reasoning` is not even fetched; study #15) | Judg | `stage_tasks.reason`, shown to reviewers | **DEFAULT** collapsed. Required only when `require_reasoning` is set, or when the grade is lower than the reused value. |
| 4.7 | History-conditional questions (`conditional_rules.history`) | any | may be marked required | — | The intake fetch ignores the history rule, but `generateStageTasks` applies it (`engine.ts:298-301`) while `history_classification` is always 'first_time'. So answers to 'repeat' questions never become tasks (only party-scope ones get written to the party master). | **REMOVE** from intake, or derive history so the rule works |
| 4.8 | Save draft vs Submit for Review | buttons | — | Judg | Drafts cannot be resumed: `submitCase` is called only from `/cases/new` (study #2) | **KEEP**, with autosave |

Things the RM sees in step 4:
- Rubric guidance: KEEP, collapsible.
- Auto-mapped grade: KEEP. Today it shows in green regardless of whether the grade is good or bad.
- The 8-row "Review before submit" block (`:831-872`): reshape it to answer the outcome questions instead:
  - likely terms (preapproved band and score band);
  - required stage and why (`describeRoutingOutcome` already exists in `routing.ts`);
  - next owner;
  - SLA date;
  - blockers.

### What the server actually requires (`handleNewCase` + `submitCase` + schema)

| Field | Server rule |
|---|---|
| role | `rm` or `founder_admin` (`actions.ts:16`) |
| caseScenario | DB NOT NULL + CHECK only; a bad value comes back as a raw DB error |
| kamUserId | required on submit (`:32`) |
| tranches | valid JSON; reconciliation on submit **only if exposure > 0**, so a ₹0-exposure submit gets through |
| credit line | on submit, against the billed party, which is the wrong party for `customer_name_contractor_pays` |
| rm_user_id, composite days, case_number | derived on the server ✓ |
| active policy | `submitCase` throws if there is none |
| **Not enforced on the server** | party presence for the scenario, bill > 0, exposure ≤ bill, city, address, justification, required questions, `require_reasoning`, grade validity (the client-computed grade and exposure are trusted) |

### Totals (37 RM-facing inputs and decisions; per-row tranche fields and question classes counted once each)

| Fate | Count | Items |
|---|---|---|
| KEEP | 10 | Customer party, Contractor party, P.1 Legal name, P.6 Phone, P.8 GSTIN, 2.1 Site value, 2.2 Credit share, 2.8 Remove tranche, 4.3 Required judgement questions, 4.8 Submit/draft |
| PREFILL | 3 | 3.1 City code, 3.4 KAM, 4.1 Reused party answers |
| DERIVE | 6 | P.2 Code, P.4 Party type, P.9 PAN, P.11 State, 3.2 Site ID, 4.2 System-backed numeric questions |
| DEFAULT | 7 | 1.1 Scenario, P.5 Subtype, P.10 City, 2.5 Tranche value, 2.6 Tranche days, 2.7 Add-tranche row, 4.6 Reason |
| DEFER | 5 | P.7 Nickname, P.12 Industry, 3.3 Site address, 4.4 Optional questions, 4.5 Free-text questions |
| REMOVE | 6 | P.3 Auto-generate click, P.13 Credit limit, 2.3 Duplicate % box, 2.4 Tranche type, 3.5 Justification, 4.7 History-conditional questions |

**Load comparison.** Take an existing party on the customer/customer scenario with one tranche and N RM questions.
- Today: about 9 + N mandatory decisions across 4 gated screens (scenario, party, value, %, tranche check, city, address, KAM, justification, the N questions, submit), plus up to N optional reasons.
- With the fates above: about 4 + N_judgement (party, value, confirm the defaulted share and terms, the required judgement questions that have no saved value, submit). A cold-start party in the dialog drops from 13 controls to about 4 (name, phone, GSTIN, a defaulted city).
- 3 of today's 9 required non-question inputs (justification, site address, city code) are read by nothing beyond the site ID, and the site ID itself is read by nothing.

## task-load-model

**Key numbers**

- Scenario A (new customer): 45 clicks, 16 typed fields / 178 keystrokes, 20 decisions, 9 outside lookups, ~13 uncertainty moments; KLM 196 s in tool, ~471 s (7.9 min) with lookups
- Scenario B (repeat customer, saved answers): 26 clicks, 7 fields / 68 keystrokes, 15 decisions, 5 recall moments; 126 s in tool, ~211 s (3.5 min) total; steps 2-3 cost the same as for a brand-new customer (~62 s in tool)
- Scenario C (repeat customer + new contractor): 48 clicks, 16 fields / 158 keystrokes, 25 decisions; 221 s in tool, ~441 s (7.3 min); both parties new (C2): 67 clicks, 268 keystrokes, ~684 s (11.4 min)
- Party creation is the single largest intake cost: 74-141 s in tool and up to 286 s with lookups in step 1; it includes 2 fields derivable from the GSTIN and 1 field (Credit Limit) that is silently discarded
- After-submit happy path: ~11 re-entries, 36 clicks, 102 keystrokes, 34 decisions, ~298 s in tool + ~120 s chasing the KAM outside the tool (~7 min per case), more than the repeat-customer intake itself
- Status polling (4 checks x ~36 s = 144 s) is about half of after-submit in-tool effort because there is no ETA, no blocker owner and no RM in-review queue
- Expected extra cost: return-for-revision about +46 s per case (p=0.25), terms change via withdraw + re-intake about +23 s, an un-resumable draft about +60-100 s per new-customer case
- Estimated targets: repeat intake ~53 s (-58% in tool, -75% total); new-customer intake ~105 s total (-78%); after-submit ~26 s over ~3 touches (-91%)

## Task-load model of CreditFlow RM intake and the after-submit loop (KLM-style)

**What this is based on.** I only read code and migration files. I didn't run the app, connect to Supabase, or use the username and password you mentioned. Every count below comes from reading `NewCaseForm.tsx`, `PartyDialog.tsx`, `cases/new/actions.ts`, `admin/actions.ts`, `engine.ts`, `cases/[id]/*`, `src/app/page.tsx` and `vocabulary.ts`. The policy's actual Stage-1 RM questions live in the database, so their number is an assumption (stated below). The counts are model estimates, not timings from real use.

### Operators and assumptions

| Operator | Value | Notes |
|---|---|---|
| K (keystroke) | 0.28 s | average typist |
| P (point) | 1.1 s | each **click = P + B(0.2) = 1.3 s** |
| H (home hand: mouse to keyboard) | 0.4 s | 2 H per typed field (to the keyboard and back) |
| M (mental prep or decision) | 1.35 s | one per real decision or read-and-judge moment |
| S (visual scan) | measured in seconds | scrolling a 200-row native `<select>` ≈ 5–6 s; reading a rubric ≈ 2–3 s |
| W (system wait) | measured in seconds | page load 1.5 s; party create 1 s; party details 0.8 s; site ID 0.5 s; submit 3 s + redirect 1.5 s |
| L (lookup outside the tool) | measured in seconds | PAN name 30 s, ERP code 45 s, GSTIN 15 s, quotation value 15 s, site address 20 s, KAM coverage 10–30 s, evidence for a question 40 s |

- **Question counts (assumed):** customer-only cases have N = 6 RM Stage-1 questions (4 about the customer, 2 about the case). Mixed cases have N = 10 (4 customer, 4 contractor, 2 case).
- **Question types (assumed):** about two-thirds are selects (grade, link_list or yes_no) and one-third are typed (numeric or date, about 6 keys).
- **Lookups (assumed):** for a new party, half the questions need outside evidence. For a repeat party, the party-scope answers are pre-filled.
- **Typical schedule:** 2 tranches (for example 50% at 30 days and 50% at 60 days). The RM types the site value in rupees (₹), such as 1250000.

---

### A. Intake: per-scenario totals

Scenarios:
- **A:** new customer, customer-only.
- **B:** repeat customer with saved answers.
- **C:** customer is a repeat, contractor is new.
- **C2:** both parties are new.

| Metric | A: new customer | B: repeat customer | C: cust. repeat + new contractor | C2: both parties new |
|---|---|---|---|---|
| Screens/views (wizard steps + modal + receipt) | 6 (4 steps + Add-Party modal + receipt) | 5 | 6 | 7 (two modals) |
| Clicks | **45** | **26** | **48** | **67** |
| Typed fields / keystrokes | **16 / 178** | **7 / 68** | **16 / 158** | **24 / 268** |
| Discrete decisions | 20 | 15 | 25 | 29 |
| Recall/lookup moments (outside the tool) | 9 (+2 fields re-keyed that GSTIN already gives: PAN, State) | 5 (one is recall *inside* the tool: last-case terms shown on step 1, needed on step 2) | 9 (+ which party's credit limit applies) | 14 |
| Validation dead-ends likely hit | ~3 | 1–2 | 2–3 | ~3–4 |
| System waits | 5 (7.8 s) | 5 (7.3 s) | 6–7 (9.4 s) | 7 (9.9 s) |
| Moments of uncertainty (no feedback) | ~13 | ~8 | ~13 | ~15 |
| **Time in the tool (KLM)** | **196 s (3.3 min)** | **126 s (2.1 min)** | **221 s (3.7 min)** | **294 s (4.9 min)** |
| Lookup time outside the tool | 275 s | 85 s | 220 s | 390 s |
| **Total time on task** | **471 s ≈ 7.9 min** | **211 s ≈ 3.5 min** | **441 s ≈ 7.3 min** | **684 s ≈ 11.4 min** |

Three costs sit on top of these totals:
- **Pausing a draft (#2).** A draft cannot be resumed (`actions.ts:69-85` always inserts a new case; "Continue intake" at `page.tsx:645` opens the read-only workspace). If an RM must pause, which I estimate happens for about 30% of new-customer intakes, they key the whole case again: roughly +60–100 s expected per A case, plus an orphan draft.
- **Losing work on navigation (#61).** Leaving through any sidebar link discards the intake without warning.
- **Duplicate cases (#14).** If submit fails on the server and the RM retries, a duplicate case is created.

#### Where the time goes, by step (in-tool seconds / with lookups)

| Step | A | B | C | C2 |
|---|---|---|---|---|
| Entry (Home → New case) | 4 / 4 | 4 / 4 | 4 / 4 | 4 / 4 |
| 1 Scenario & parties (incl. Add-Party) | **74 / 164** | 18 / 18 | **83 / 138** | **141 / 286** |
| 2 Commercial ask | 27 / 42 | 29 / 44 | 29 / 44 | 29 / 44 |
| 3 Site & handoff | 33 / 83 | 33 / 63 | 33 / 63 | 33 / 63 |
| 4 Questions + review + submit | 59 / 179 | 43 / 83 | 72 / 192 | 88 / 288 |

**How to read this.** For new parties, party creation (step 1) and evidence lookups (step 4) cost the most. For a repeat customer, steps 2 and 3 are re-entered from scratch. They cost the same as for a brand-new customer (about 62 s in the tool, about 107 s with lookups) even though the system already has the last case's site value, credit days, KAM and city. `fetchPartyDetails` loads `lastCase` at `actions.ts:166-173`, but nothing uses it as a template.

#### Step-by-step operator ledger (scenario A, the worst single-party path)

| Step | What the RM does (code reference) | Clicks | Keys | M | Lookups |
|---|---|---|---|---|---|
| 1 | Reads 3 scenario labels; the default is customer/customer (`NewCaseForm.tsx:18-22, 77`) | 0 | 0 | 1 | – |
| 1 | Opens the native party select to check whether the party exists. There is no search and only 200 rows load (`actions.ts:134-143`), so the RM can't tell "missing" from "past the cap" | 2 | 0 | 1 | – |
| 1 | Add New → PartyDialog. Type defaults to **'Both'**, not Customer (`PartyDialog.tsx:22`), so the RM must change it | 3 | 0 | 1 | – |
| 1 | Legal name (PAN name) | 1 | 34 | 1 | 30 s |
| 1 | Customer Code is **required**, but Auto-Generate is hidden for the Customer type (`PartyDialog.tsx:107-115`), so the RM must find an ERP code | 1 | 8 | 1 | 45 s |
| 1 | GSTIN, then PAN (characters 3–12 of the GSTIN), City and State as free text (State comes from the first 2 GSTIN digits), Industry as free text | 5 | 55 | 2 | 15 s |
| 1 | Credit Limit: typed, then **silently discarded**. The dialog sends `credit_limit`, but `upsertParty` never maps it (`admin/actions.ts:39-51`) | 1 | 7 | 1 | – |
| 1 | Create. The new party is selected but its details never load (`NewCaseForm.tsx:81-91` skips `handleCustomerSelect`), so there is no context card | 1 | 0 | 1 | – |
| 1 | Continue | 1 | 0 | 0 | – |
| 2 | Site value as raw digits, with no lakh/crore echo of the number (`:557`) | 1 | 7 | 1 | 15 s |
| 2 | Credit **%**. The RM thinks in ₹ ("5 lakh on credit") and has to convert (`:561-597`) | 1 | 2 | 2 | – |
| 2 | Tranches. "Add Tranche" adds an **Amount ₹0 / 0 days** row (`:222`), which breaks reconciliation every time and has to be retyped | 6 | 8 | 2 | – |
| 3 | City code select. This is a 2nd city entry: the party dialog already took the city as free text (`:684-687`) | 2 | 0 | 1 | – |
| 3 | Site ID is auto-generated and editable, with no explanation (`:691`) | 0 | 0 | 1 | – |
| 3 | Site address | 1 | 45 | 0 | 20 s |
| 3 | KAM picked from all KAMs, with no default (`:699-703`). It is optional here but required at submit (`:285-289`) | 2 | 0 | 1 | 30 s |
| 3 | Justification select | 2 | 0 | 1 | – |
| 4 | 6 questions. The reason box is "optional" (#15). Grades display as "(Grade N)". "Auto-mapped" shows green even for the worst grade (`:811-815`) | 10 | 12 | 6 | 120 s |
| 4 | Review block sits under the questions. It shows "Stage N before approval" with no reason (`:862`) | 1 | 0 | 1 | – |
| 4 | Submit (`engine.ts:131-236`) | 1 | 0 | 0 | – |

#### Validation dead-ends in the current intake (and which scenarios hit them)

| # | Dead-end | Code | Hit in |
|---|---|---|---|
| 1 | Continue goes grey with no reason on steps 1–3. Step 2 alone has 5 hidden rules | `NewCaseForm.tsx:375-391, 543, 670, 720` | All (likely for first-time RMs) |
| 2 | Add Tranche creates a ₹0 / 0 d row, so reconciliation is red until two fields are retyped | `:222, 662-664` | Every multi-tranche case |
| 3 | Customer Code is required with no generator for the Customer type | `PartyDialog.tsx:107-115` | A, C2 |
| 4 | Credit-limit breach blocks the step with no path forward. The only exit is a draft, which can't be resumed | `:384-387, 598-603` | B, C (repeat parties with a limit) |
| 5 | The limit is checked on the **customer** even when the contractor pays | `:384`; `actions.ts:60` | C, C2 |
| 6 | KAM missing is only caught at submit | `:285-289` | ~20% of submits (assumed) |
| 7 | Server error on submit, then a retry creates a duplicate case | `actions.ts:69-125` (#14) | Rare, but costly |
| 8 | No active policy: step 4 claims "No specific intake questions…", then submit fails | `:731-732`; `engine.ts:141-143` (#79) | Misconfiguration |

#### Moments of uncertainty (the RM gets no feedback on what will happen)

- Scenario labels are look-alikes, for example "Customer Name, Contractor Pays".
- **Party missing, or past the 200-row cap?**
- **Party type:** what are 'Both' and 'Influencer'?
- **Customer code:** what format is expected?
- **Credit limit:** the field looks saved but is dropped, which gives false certainty.
- **After creating a party:** the context card is missing. Did it work?
- **Site value:** with no ₹ lakh/crore echo, a wrong zero count goes unnoticed.
- **Why is Continue disabled?**
- **Site ID:** should the RM edit it?
- **KAM:** marked "required to submit" yet optional now.
- **Reused answers:** the chip says "confirm or update", but there is no Confirm control (`:740-745`).
- **Green grade:** green even for the worst grade.
- **"Stage N":** what does it mean, and how long will review take?
- **After submit:** which terms are likely?

---

### B. The after-submit loop: getting an outcome the RM can act on

**Happy path assumed:** routing requires Stage 2, the case is approved and not returned, and the RM negotiates offline. Each row is a **re-entry**: the RM has to rebuild context on the case.

| Episode | What the code makes the RM do | Clicks | Keys | M | Scan + wait | Time |
|---|---|---|---|---|---|---|
| E1 Receipt | Reads "Stage 1 tasks created, KAM notified" (`CaseWorkspace.tsx:144-151`). No terms, no timeline, no KAM name. No score either: `submitCase` never calls `updateCycleScore` (only callers are `actions.ts:375, 503`), so the score card at `:287` stays hidden | 0 | 0 | 1 | 5 s | **6 s** |
| E2 Status checks ×4 (polling, because nothing gives an ETA or a blocker) | Home → "Recent activity" → case → command bar ("Stage x **of 3**", generic next action, `:136`) → Work tab → expand stage → scan tasks for owner and SLA. Non-RM tasks start unassigned (`engine.ts:319`), and only the current stage has SLAs (`:326`). There is no "my submitted cases in review" queue for the RM (`page.tsx:374-381` has only Drafts, Returned and Approved) | 16 | 0 | 16 | 84 s + 18 s | **144 s** |
| E2b Chasing the KAM outside the tool (×1.5) | Phone or WhatsApp: "what's the status?" | – | – | – | – | **120 s** (lookup) |
| E3 Notifications ×2 (Stage progressed, Approved) | Bell → read → **no link**: `sendNotification` sets no `link_url` (`engine.ts:8-16`) → remember the case number → Cases → find → open | 8 | 20 | 4 | 14 s + 7 s | **44 s** |
| E4 Reading the outcome | Compares approved/recommended days with what was requested, using the Summary and Decision tabs | 1 | 0 | 3 | 16 s | **21 s** |
| E5 Recording accepted terms | The Home queue and the header button tell the RM to "Record accepted terms" (`page.tsx:650-668`, `CaseWorkspace.tsx:204-208`, `vocabulary.ts` Approved ownerRole = `rm`). The server **rejects the RM**: `handleCounterOffer` is KAM/Admin only (`[id]/actions.ts:954-956`). The error boundary then wipes the screen. Recovery: reload, comment to the KAM, wait, re-check | 11 | 82 | 10 | 21 s + 8 s | **81 s** |
| **Happy-path total** | **~11 separate touches** spread over several days | **36** | **102** | **34** | | **298 s in the tool + 120 s outside ≈ 7 min** |

Two branch costs come on top of the happy path (expected values):
- **Returned for revision (assumed p = 0.25).**
  - The notification has no link, and no correction list exists. The reason is buried in the Decision tab.
  - The RM can only re-answer their own tasks. There is no edit path for amount or tranches.
  - The RM **cannot resubmit**: an ordinary round can only be raised by KAM/Admin (`[id]/actions.ts:526-528`), yet the queue button says "Fix and resubmit" (`page.tsx:630`). The RM has to ask the KAM.
  - About 90 s per return plus 2 extra checks, so roughly **+46 s** expected per case.
  - If the commercial terms must change, the RM has to withdraw and re-intake (about 211 s; assumed p ≈ 0.1, roughly **+23 s** expected).
- **Rejected.** An Appeal button exists for the RM (this path works).

**Per case, including expected branches: about 6 minutes of RM effort in the tool, plus about 2 minutes of chasing outside it, across 11–14 re-entries.** That is on top of 3.5–11 minutes of intake. For a repeat customer, the RM spends **more time following up than filing**. The reason is that the system never pushes three answers to the RM: likely terms, who is blocking, and by when.

---

### C. What the system already knows but still asks for (or hides)

| Already in the system | Where | Asked again or hidden? |
|---|---|---|
| Last case: bill amount, composite days | `actions.ts:166-173` | Shown only as text on step 1. Steps 2–3 start blank (step 2 defaults to 100% at 30 days) |
| KAM on the party's last case | credit_cases.kam_user_id | The RM picks from every KAM |
| Party city | PartyDialog `city` | The city code is asked again on step 3 |
| PAN and State | Derivable from the GSTIN (characters 3–12; first 2 digits) | Typed by hand |
| **Pre-approved credit-day band per party** (policy min/max, empirical) | `utils/preapproval.ts`; refreshed on case closure in `billing-actions.ts:376-377` | **Never shown at intake.** Likely terms for a repeat customer exist and are hidden |
| Routing reason | `describeRoutingOutcome` (`engine.ts:157`) | Used only in the audit log. The RM sees a bare "Stage N" |
| Grade scale, weights, graded answers | Already loaded in the client | No indicative score. No score after submit either |
| Stage SLA days | parameter_definitions.sla_days | No case-level ETA anywhere |

### D. Target model (least cognitive and task load)

| Flow | Current (in tool / total) | Target (in tool / total) | What gets it there |
|---|---|---|---|
| B: repeat customer | 126 s / 211 s | **≈ 53 s / 53 s** | Type-ahead party search; last case as a template (value, schedule, KAM, city); ask for credit in ₹ instead of %; only ask stale or case-scope questions; one-click "still true" on reused answers; separate Review step |
| A: new customer | 196 s / 471 s | **≈ 60 s / 105 s** | Enter the GSTIN once to fill legal name, PAN and State; auto-generate the code for every party type; drop the phantom credit limit; pass the dialog the slot that opened it; save-and-resume drafts |
| After-submit loop | 298 s / 418 s, ~11 touches | **≈ 26 s, ~3 touches** | Receipt shows the indicative band (pre-approved band or score), routing reason, named KAM and an ETA from SLAs. Add an RM "In review: blocked by X, due D" queue. Deep-link every notification. Give the RM an acceptance capture or a one-tap "send to KAM". Show returned reasons as a checklist with edit-in-place and an RM resubmit |

Takeaway: about **60–75% of intake effort** and **about 90% of follow-up effort** go to asking for things the system already knows, transcribing documents, or polling for information the system could push.

## lifecycle-touchpoints

**Key numbers**

- 18 RM touchpoints after submission mapped (T1-T18); 7 have dead air with no answer and 5 are blocked by the server or have no path forward
- 0 of 3 RM-specific home queues (Returned, Drafts, Approved) can be completed end to end by the RM
- 5 notification types reach the RM with no link, no reason and no terms; only @mentions carry a link
- About 9 lifecycle events send the RM nothing: task assigned, RM task becomes actionable, Accepted, board outcome, validity expiry, bill attached, PTP due or broken, escalation, close or write-off
- Returned-for-revision handling takes about 8-10 steps across 3 tabs plus a step outside CreditFlow, and still cannot correct commercial fields or resubmit
- Billing handoff: 2 fields (billing date, promised amount) typed from blank even though bill amount, exposure and accepted terms are already stored
- 3 routine RM moments need a relay to the KAM outside CreditFlow: record accepted terms, log a PTP or call, resubmit after a return
- 7 places where the screen or vocabulary contradicts the server role guard on RM-facing actions

The RM's job after submission is mostly to be told nothing, and then be pointed at buttons they are not allowed to press. Every RM-specific queue on the home page leads to an action the RM cannot finish. Notifications carry no reason, no terms and no link. Two exception paths have no exit inside CreditFlow: an expired approval and a material change both mean the RM must create a new case and type everything again.

All file paths are relative to `/Users/shashwat/Documents/Credit/260323_Credit-Score`. This was a read-only review of code and migrations only. No database was touched and no files were changed.

## 1. Touchpoint map: every RM moment after submission

**How to read the columns:**
- **Clicks** means navigation steps from the moment the RM learns of the event to finishing it.
- **Re-entry** means data the RM types that the system already holds.
- **Gets back** means what the RM learns at the end.

| # | Touchpoint | What triggers it | How the RM finds out | Clicks / screens | Re-entry | What the RM gets back | Verdict |
|---|---|---|---|---|---|---|---|
| T1 | Submit receipt | `handleNewCase` redirects to `?receipt=submitted` | Green banner on the case page (CaseWorkspace:144-151) | 0 | none | Says "Stage 1 tasks created, KAM notified. You will be alerted if returned." No likely terms, no timeline, no next owner beyond the header | Partial answer. The promised "alert" is a notification with no link (T6) |
| T2 | Waiting while the case is In Review | none (passive) | Only by opening the case. "Recent activity" on home shows a status chip | Cases, case, header | none | Header shows "Current owner: KAM" and "Next action: Complete current stage tasks" (generic copy, vocabulary.ts:46-52). Rail shows "Stage N of 3". The live policy score and recommended days are shown (CaseWorkspace:287-327), which is the only useful early signal of likely terms | **Dead air.** No ETA, no list of what is blocking, no SLA shown at case level, no "it's with X since Y" |
| T3 | RM-owned stage tasks | `generateAllCycleTasks` creates tasks for all 3 stages at submit and assigns RM-owned ones to the RM (engine.ts:305-327, 343-345) | Home "Tasks assigned to you". No notification | Home, case (opens on the Summary tab, not Work), Work tab, task form | Stage 1 answers carry over from intake (`draft_rm_answers`). Stage 2/3 RM questions are never asked at intake (new/actions.ts:271-313, stage 1 only). Saved party answers (`party_parameter_values`) are not used to pre-fill tasks | Completion recomputes the score. No receipt of the score or band change | Stage 2/3 RM tasks show on home now (no SLA, sorted last), but the form only appears once that stage is current (StagesTab:278). The RM sees work they cannot act on and gets no signal when it becomes actionable |
| T4 | KAM needs something from the RM | KAM wants input | Only an @mention comment. `handleToggleWaiting` / "Awaiting Input" has no UI (only actions.ts:433-459 calls it) | Bell (fetched once on mount, NotificationDropdown:25-34), then Open, then the Conversation tab | Free text | Nothing structured: no due date, no "resolved" state | No modelled "waiting on RM" state. The RM home has no "waiting on you" queue |
| T5 | Stage moves forward | `progressStage` notifies the RM (engine.ts:413-416) | "Stage Progressed" notification, no link | — | — | "Case X progressed to Stage N." Does not say whether the RM has tasks in the new stage | Noise. It fires for every stage and is never tied to RM action |
| T6 | **Returned for revision** | Approver chooses `return_for_revision` (actions.ts:745-749) | Notification "Case X was returned for revision." with no reason and no link (actions.ts:828-829). Home queue "Returned for revision" with CTA "Fix and resubmit" (page.tsx:620-632) | Home → case (Summary tab) → Decision tab → find the round → read the comment string "Corrections required: …" → Work tab → edit (only RM-owned tasks in the current stage) → Conversation tab → @mention KAM to resubmit. About 8-10 steps across 3 tabs, plus a step outside CreditFlow | Any correction to bill, exposure, tranches, parties or site: **impossible**, because no update-case action exists anywhere. The checklist can only point at current-stage tasks (ApprovalsTab:62, 345-355), not commercial fields or Stage 1 answers | Nothing. Resubmitting is KAM-only (`handleSubmitStage` actions.ts:231-232, StagesTab:66). Tasks are not reopened. The SLA is not reset, so editing an answer forces an "SLA breached, delay reason required" step (actions.ts:336-339; TaskCompleteForm:125-133). The dialog copy "The review SLA restarts when the RM resubmits" (ApprovalsTab:37) is false | **Broken loop.** The CTA promises something the RM cannot do. The header still names the KAM as owner (CaseWorkspace:131). The substatus "Returned for revision" is never cleared (only `handleToggleWaiting` nulls it, and it has no UI), so later badges read "Approved — awaiting negotiation · Returned for revision" |
| T7 | Rejected | `reject` decision | Notification "Case X has been rejected." with no reason and no link (actions.ts:826-827). No RM home queue for Rejected | Cases → case → Decision tab to find the reason | — | Reason only from the decision comment | No queue, no reason in the alert, no appeal deadline |
| T8 | Appeal, then board outcome | RM clicks "Appeal decision" in the header (CaseWorkspace:209-219) | Self-started | 1 click: no confirmation, no reason, no new evidence | Cannot attach new evidence. The appeal round carries no rationale | Status "Appealed". When the admin finalizes (board/actions.ts:148-207) there is **no notification to the RM** and validity is not stamped on uphold or override | **Dead air** until the RM happens to reopen the case. "Appeal is available if new evidence exists" (vocabulary.ts:123) has no place to put the evidence |
| T9 | Approved | First approve closes the round (actions.ts:750-818) | Notification "Case X has been fully approved." with no link and no terms. Home queue "Approved — awaiting negotiation" with a validity countdown (page.tsx:650-670) | Home → case → Summary (terms ladder) | — | Approved days and validity are on the Summary tab and in the queue label. This is the best "answer back" in the lifecycle | Good queue. The notification is thin |
| T10 | **Record accepted terms** | RM has negotiated with the customer | Home CTA "Record accepted terms". Vocabulary owner for Approved is `rm` (vocabulary.ts:83-84). The header button is shown to every role (CaseWorkspace:204-208) | Click → the form opens on the Summary tab → enter "New Composite Days" → Accept | Retypes composite days by hand. Cannot record a restructured tranche schedule, even though the copy says "You may restructure tranches" (OverviewTab:150) | **Server rejects the RM:** `handleCounterOffer` is KAM/admin only (actions.ts:954-957). If a KAM records it, `final_accepted_tranches` is copied from the requested `proposed_tranches` (actions.ts:983), not from anything negotiated, and no notification is sent | The RM must relay to the KAM outside CreditFlow. Accepted terms can disagree with the stored schedule |
| T11 | Approval validity lapses | Time passes | Only the queue label "Expired Nd ago" (page.tsx:664). No alert before or at expiry | — | — | Nothing. Status `Expired` is never set anywhere in `src`. Next action "Start a new review cycle" (vocabulary.ts:148) has no button, even though `submitCase` supports a cycle 2+ (engine.ts:173-179) | **No exit:** the RM must create a new case and re-enter everything |
| T12 | **Billing handoff** | Case is Accepted | Nothing. `handleCounterOffer` sends no notification, and no RM (or KAM) home queue covers Accepted (page.tsx:374-381) | Remember it → Cases → filter → case (opens on Summary; Financials is the default tab only for KAM/Accounts/Admin in Billing Active, CaseWorkspace:126) → Financials → form | **Billing date and promised amount typed from scratch.** The promised field starts blank (LedgerTab:144, 326-328) although bill amount, requested exposure and accepted terms are all stored | Status becomes Billing Active. Ledger and collections then build the schedule from `proposed_tranches` / `composite_credit_days` (billing-actions.ts:36; the collections page fallback), **not** from `final_accepted_tranches` / `final_composite_credit_days` | Hidden step with a full re-entry. Also a bypass: `handleSaveBillingDetails` has no status guard (billing-actions.ts:171-233), the ledger loads for `Approved` (actions.ts:199), and the RM's billing form opens by default (LedgerTab:141). So the RM can jump from Approved straight to Billing Active and skip acceptance, which is the easiest path given T10 |
| T13 | Bill document | Billing started, no bill URL | Visible only inside Financials | "Remind Accounts" | — | Inline receipt with recipient count (LedgerTab:420-425). Accounts gets a deep link (billing-actions.ts:929-936) | Works. The RM gets no notice when Accounts attaches the bill |
| T14 | Collections follow-up | Tranche due or overdue | Home red banner and "Upcoming 14 days". Rows link to `/collections`, not the case (page.tsx:819). No notification for a broken PTP, a due PTP or an escalation | `/collections` → find row → expand | — | RM can **escalate** (no role check, collections/actions.ts:7-63) and move board cards. RM **cannot log a call, visit or PTP** (`addHqCollectionLog` is KAM-only, :142-144; `canHqChat` CollectionsClient:389), which is the thing the field RM actually learns. An escalation is `assigned_to: user.id` (the escalator, :39). `targetRole` is posted (CollectionsClient:1636) but ignored, and nobody is notified | The RM must relay PTPs to the KAM outside CreditFlow. An escalation goes nowhere (dead air) |
| T15 | Close or write-off | KAM closes, or auto-close on full payment | Nothing to the RM | — | — | Only the status in "Recent activity" | Silent |
| T16 | Withdraw | RM/KAM withdraws | RM notifies themselves (engine.ts:482-485) | Confirm dialog with reason | — | The dialog says "The RM and KAM will be notified" (CaseWorkspace:251), but only the RM is | Minor copy/behaviour mismatch |
| T17 | Material change, re-review, or repeat deal | New commercial facts or a new order | — | New case from scratch. There is no clone or "start a new cycle" path, and no case-edit action | Parties, site, bill, tranches, KAM and RM answers (party-scope answers do pre-fill) | — | Biggest repeated-work cost |
| T18 | Resume a draft | Home "Incomplete drafts" → "Continue intake" | Home queue | Lands on a workspace with no edit and no submit for Draft; the receipt says "Complete the remaining sections and submit" (CaseWorkspace:152-158) | Everything | — | Dead end (known: prior study, resume route) |

## 2. Contradictions between the screen, the server and the vocabulary

| Moment | UI / vocabulary says the RM… | Server allows | Outcome for the RM |
|---|---|---|---|
| Returned for revision | "Fix and resubmit" (page.tsx:630) | No edit action. Resubmit is KAM-only (actions.ts:231) | Cannot finish |
| Approved | Owner is rm, "Record accepted terms" (vocabulary.ts:83-84, page.tsx:665, CaseWorkspace:204) | KAM/admin only (actions.ts:955) | Error page |
| Accepted | Owner is kam, "Initiate billing" (vocabulary.ts:91-92) | `handleSaveBillingDetails` is RM/admin only (billing-actions.ts:175) | Nobody is queued. Only the RM can act, and the RM is never told |
| Draft | "Continue intake" / "submit when ready" | No resume or submit path | Cannot finish |
| Unlock / reopen | Button shown to RM (CaseWorkspace:222) | Approver/board/admin only, and it only writes an audit row (actions.ts:928-948) | Error, or nothing happens |
| Collections contact | RM owns the relationship (doctrine §6.1) | Log/PTP is KAM-only | Out-of-band relay |
| Escalate | "Escalate to L2 (kam)" | Assigned to the escalator, no notification | Goes nowhere |

**None of the 3 RM-specific home queues (Returned, Drafts, Approved) can be completed end to end by the RM.**

## 3. Notifications the RM actually receives

| Event | Notified? | Link? | Carries the answer? |
|---|---|---|---|
| Stage progressed | yes | no | no (does not say whether the RM has tasks) |
| Returned for revision | yes | no | **no reason or checklist** |
| Rejected | yes | no | **no reason, no appeal window** |
| Approved | yes | no | **no approved days, no validity date** |
| Withdrawn | yes (even self-initiated) | no | — |
| @mention | yes | **yes** (the only one) | free text |
| Task assigned or reassigned (`handleAssignTask` actions.ts:254-286) | no | — | — |
| RM task's stage becomes current | no | — | — |
| Accepted terms recorded by KAM | no | — | — |
| Board / appeal outcome | no | — | — |
| Approval validity near or past expiry | no | — | — |
| Bill attached by Accounts | no | — | — |
| PTP due today, PTP broken, tranche overdue, escalation | no | — | — |
| Case closed or write-off decided | no | — | — |

The bell fetches once per Shell mount (NotificationDropdown:25-34), so even these go stale.

## 4. Biggest repeated-work costs (ranked)

1. **Re-review or material change means a whole new case (T11, T17, T6).** There is no case-edit action and no "new cycle on this case" UI, although `submitCase` already numbers cycles. Every expired approval or changed bill means re-entering parties, site, bill, exposure, tranches, KAM and RM answers.
2. **Billing handoff re-entry (T12).** The billing date and promised amount are typed from a blank form, although bill amount, exposure and accepted terms are all stored. Collections then ignore the accepted terms anyway: they use `proposed_tranches` / `composite_credit_days`, not `final_*`.
3. **Accepted terms typed as a bare number (T10).** Composite days are re-keyed by hand and the negotiated schedule cannot be captured. `final_accepted_tranches` silently equals the original proposal.
4. **Stage 2/3 RM questions are asked later, one at a time (T3).** Intake asks only Stage 1 RM parameters. RM-owned questions in later stages wait until that stage opens, with no notification, and saved party answers are not used to pre-fill them.
5. **Delay reason on post-return edits (T6).** SLA deadlines are not reset on return, so any correction forces an "SLA breached" reason.

## 5. Biggest context-switch costs

- **Every notification is a scavenger hunt.** No link, no reason, no terms. The RM goes to Cases, finds the case, guesses the tab, and lands on Summary by default. Even the queue rows are bare `/cases/{id}` links (the prior study's `?tab=` finding).
- **Relaying outside CreditFlow.** The RM must phone or chat the KAM for 3 routine moments: record accepted terms (T10), log a PTP or call (T14), and resubmit after a return (T6). The system then has no record of the RM's part.
- **Returned-case triage spans 3 tabs.** The reason is in Decision, the editable tasks are in Work, and the request to resubmit goes in Conversation.
- **Collections rows send the RM to `/collections`, not the case**, so checking the ledger is another hop.

## 6. Dead-air moments (the RM has no answer)

1. **In Review (T2):** no blocker list, no ETA, no "with X since Y". The owner reads as KAM even when the case was returned to the RM.
2. **After an appeal (T8):** there is no outcome notification at all, and validity is not stamped on uphold or override.
3. **After a return (T6):** the RM cannot fix or resubmit, and does not know whether the KAM has resubmitted. The substatus sticks forever, so the badge stays misleading.
4. **After asking the KAM to record terms (T10):** no notification when the case becomes Accepted, and no queue telling the RM that billing is now their move (T12).
5. **After escalating a collection (T14):** assigned to themselves, nobody notified, and there is no escalation SLA.
6. **Approval expiry (T11):** a passive label only, and no path forward.
7. **Close or write-off (T15):** silent.

## 7. Least-load target: what the RM should carry

The system should push 5 answer states to the RM, each with a deep link and a concrete answer:
- "Returned: fix these N things by date D." The checklist covers commercial fields, not just current-stage tasks. Fixed items reopen as RM tasks, and the RM resubmits.
- "Approved: X days, valid until D. Record what the customer accepted." Recording is allowed for the RM, with tranche restructuring inside the approved limit.
- "Accepted: start billing." Promised amount and schedule are pre-filled from the accepted terms. Billing is blocked unless the case is Accepted.
- "Rejected: reason R. Appeal with new evidence by D." The appeal needs a rationale and an attachment.
- "Collections: PTP due or broken on case C." The RM can log the call and PTP in one step.

Changes needed in the code:
- Make `linkUrl` and a one-line answer (days, reason, deadline) required in `sendNotification`.
- Add notifications for: task assigned, stage-became-actionable for RM tasks, Accepted, board outcome, validity T-3 and T-0, PTP broken, escalation targeted to the right role.
- Add a case-level "Amend and resubmit" path. It clones into a new review cycle on the same case, using the existing `submitCase` cycle numbering. It serves return-for-revision, expiry and material change.
- Clear `substatus` on resubmit.
- Reset or pause SLA on return.
- Ask all RM-owned parameters (all stages) at intake, or at least pre-fill later ones from `party_parameter_values`.
- Point the ledger and collections at `final_accepted_tranches` / `final_composite_credit_days`.
- Align `vocabulary.ts` owners with server role guards. Today Approved says rm but the server allows kam; Accepted says kam but the server allows rm.

## 8. What is new here and what the prior study already found

**Already in `docs/UX_STUDY_2026-11-08.md`:**
- #13 notifications have no link and go stale.
- #11 no Accepted queue, including the RM-vs-KAM billing-guard note.
- RM gets an error on "Record accepted terms".
- The "Customer Declined" validation trap.
- RM cannot log a call or PTP.
- Waiting/force-ready have no UI.
- Board uphold does not stamp validity.
- Drafts cannot be resumed.
- `?tab=` deep links.

**New from this lifecycle pass:**
- (a) The returned-for-revision loop cannot be closed by the RM: no edit action, resubmit is KAM-only, the checklist covers current-stage tasks only, tasks are not reopened, the SLA is not reset (forced delay reason), and the dialog promise about the SLA restarting is false.
- (b) The `substatus` "Returned for revision" is never cleared and follows the case into Approved and Billing badges.
- (c) The RM can skip negotiation by setting billing details on an Approved case (no status guard, ledger loads for Approved, form opens by default).
- (d) Accepted terms freeze the original proposal, and billing/collections ignore `final_*` terms.
- (e) Board finalize sends no RM notification.
- (f) Appeal is one click with no rationale or evidence.
- (g) Stage 2/3 RM tasks show on home but cannot be acted on, and nothing signals when they open. Intake asks only Stage 1 RM questions.
- (h) Collections escalation is assigned to the escalator, `targetRole` is ignored, and no one is notified.
- (i) No path to `Expired` and no re-review or new-cycle path for an existing case.
- (j) The withdraw dialog promises a KAM notification that is never sent.
- (k) No notification on task assignment or reassignment.

## question-load

**Key numbers**

- Measured: 0 parameter_definitions seed rows in the 7 migrations; config.toml points to ./seed.sql, which does not exist. The only INSERTs are 2 system_settings keys and a profiles trigger.
- Measured: the intake question formula is S1 = C1+X1, S2 = C1+K1+X1, S3 = K1+X1 (stage-1, RM-owned, active parameters by subject); S2 is always the largest set.
- Measured: 8 required fixed inputs before any policy question in S1 and S3, 9 in S2 (scenario pre-filled), plus 12 PartyDialog fields per new party.
- Measured: 2 visible inputs per policy question (answer + optional reason), in one flat Step-4 list.
- Measured: admin defaults for a new parameter are customer / stage 1 / RM / grade_select / required / remember none / rubric ''. is_required and conditional_rules can't be edited in the admin UI.
- Estimate: with admin defaults accepted and P=12, S1 and S2 each get 12 required RM questions (33 visible inputs in S2) and S3 gets 0; with a balanced policy, P=20 gives about 3/5/3 questions.
- Measured: 3 of 8 input types never score (short_text, long_text, date without bands), and the 'case' subject never scores (scoring.ts:62); all are still required at intake.
- Measured: party memory has 1 write path (intake RM answers, plus bulk import); 0 workspace or KAM completions are persisted; the site and rm remember scopes have 0 readers or writers.
- Measured: tasks for all 3 stages are generated at submit whatever required_stage is; RM stage-2/3 tasks enter My Tasks straight away.
- Measured: 0 score computations at submit; the pre-approval band function has 0 callers in the intake flow.
- Not measurable without DB: rubric coverage, the input-type mix, the share remembered per party, actual per-scenario counts (SQL provided in the report).


# Question load at intake: how policy decides what the RM is asked, and what it costs

**Scope:** I only read code, migrations, seed config and docs in `/Users/shashwat/Documents/Credit/260323_Credit-Score`. I connected to no database and edited no files.

## 0. Bottom line

The repo contains **no parameter seed data**, so the RM's policy-driven question count cannot be measured from the repo. It is set entirely by whatever sits in `parameter_definitions` in the live database. What the code does fix is the *shape* of the load, and that shape works against the RM in four ways:

1. **Defaults push every new parameter onto the RM at intake.** The admin dialog creates new parameters with these defaults: subject = customer, stage = 1, owner = RM, input = manual grade, required = true, remember = none, rubric = empty. The admin can't change "required" or the scenario rules from the UI at all. So unless the admin overrides the defaults, every parameter they add becomes another required RM question in Step 4 for scenarios 1 and 2.
2. **Several questions cost effort but don't change the score.** Parameters about the case itself (subject "case") are never scored. Text fields and weight-0 parameters add nothing either. All of them are still required at intake.
3. **There are re-ask and re-entry loops.** KAM-side party facts, imported payment history and the RM's own later-stage questions are not captured once and reused.
4. **The RM gets nothing back at submit.** No score is computed, and the pre-approved credit-days band, which already exists in code, is never shown at intake.

## 1. Evidence base: what was measured and what was estimated

| Item | Status | Source |
|---|---|---|
| Parameter rows in migrations or seed | **Measured: 0** | Only 2 `INSERT`s across 7 migrations: `system_settings` (2 pre-approval keys) and a `profiles` trigger. `supabase/config.toml` points to `./seed.sql`, which **does not exist**. |
| Parameter rows in tests or fixtures | **Measured: 0 realistic ones** | `src/app/cases/new/actions.test.ts:217-219` uses only stub ids `param1-3`. The policy-parsing test has one example ("Bank statement", customer, stage 1, RM, grade_select). |
| Parameter schema | Measured | `remote_schema.sql:541-575`: 8 input types, 3 subject types, stages 1–3, 4 remember scopes (none/party/site/rm), plus is_required, is_critical, require_reasoning, rubric guidance, weight, conditional rules, auto-banding, SLA days. Plus `is_stable` (`20260524000000_preapproved_bands.sql`). |
| Fixed intake fields | **Measured from code** | `NewCaseForm.tsx` steps 1–3 and `PartyDialog.tsx` |
| Policy questions per scenario | **Formula from code; counts are estimates** | `actions.ts:274-315` |
| Rubric coverage, share remembered per party, input-type mix | **Not measurable** (needs DB) | See §9 for the read-only queries that would measure them |
| "12 active parameters" | Anecdotal only | Example copy quoted in UX_STUDY #(publish dialog). Not a measurement. |

## 2. How the intake question set is chosen (measured from code)

`fetchRmIntakeTasks(scenario)` (`src/app/cases/new/actions.ts:274-315`) applies these filters in order:

| # | Filter | Code | Effect on load |
|---|---|---|---|
| 1 | Active policy version only | :280 | — |
| 2 | `stage = 1` only | :296 | RM-owned stage 2/3 parameters are **deferred**, not offered at intake (see §6) |
| 3 | `subject_type` ∈ allowed set | :283-298 | S1 customer-pays: {case, customer}. S2 customer-name/contractor-pays: {case, customer, contractor}. S3 contractor-pays: {case, contractor} |
| 4 | Owner = `rm` | :303 | KAM, BDO and Accounts parameters never shown |
| 5 | `conditional_rules.scenarios` includes the scenario | :305-308 | Only when the rule is set. **The admin UI cannot set it** (missing from `PARAMETER_FIELDS`, `policy/actions.ts:500`), so in practice it is always null. |
| — | `conditional_rules.history` | **Not checked at intake** | It is checked in the engine (`engine.ts:298`) against `history_classification`, which **no code ever sets**, so it is always `'first_time'`. |
| — | persona, stage, prior answers (doctrine §06) | Not implemented anywhere | — |

**Formula (from code).** Let C1, K1 and X1 be the active stage-1, RM-owned parameters with subject customer, contractor and case.
- **S1 = C1 + X1**
- **S2 = C1 + K1 + X1**. Always the biggest set. A concept like "bank statement" defined for both customer and contractor is asked twice.
- **S3 = K1 + X1**

Every question renders as one answer control **plus** an optional "Reason or notes" textarea (`NewCaseForm.tsx:735-823`). So Step 4 shows 2 inputs per question, in one flat list with the review summary under it. That breaks the doctrine's 4–5 decisions per view as soon as Q ≥ 3.

## 3. Fixed (non-policy) intake load (measured from code)

| Step | Required inputs | Optional / auto |
|---|---|---|
| 1 Scenario & parties | scenario (pre-filled) + 1 party (S1, S3) or 2 (S2) | — |
| 2 Commercial ask | site value, credit % | tranche rows: 3 inputs each. One row is pre-filled at 100% / 30 days. |
| 3 Site & handoff | city code, site address, KAM, reason for credit | Site ID is auto-generated but editable |
| New party (per party) | Legal name, customer code (plus phone and city in practice, because ID generation needs them) | 12 fields in total. Party type defaults to "both" even when opened from the customer or contractor slot. |

**Required deliberate inputs before any policy question: S1 = 8, S2 = 9, S3 = 8.** One of these is the pre-filled scenario. Add +12 fields for each new party.

## 4. Estimated question load per scenario (ESTIMATES, no seed data)

| Policy size (P = active parameters) and allocation | S1 questions | S2 questions | S3 questions | S2 visible inputs (fixed 9 + 2Q) |
|---|---|---|---|---|
| **A. Admin defaults accepted** (every parameter customer / stage 1 / RM / required), P = 12 | 12 | 12 | **0** | 33 |
| B. Balanced: P = 12, ⅓ per stage, 75% RM at stage 1, subjects 40/40/20 | ~2 | ~3 | ~2 | ~15 |
| B. Balanced, P = 20 | ~3 | ~5 | ~3 | ~19 |
| B. Balanced, P = 30 | ~4–5 | ~7–8 | ~4–5 | ~24 |

Allocation A is a real risk because of the defaults in `ParametersClient.tsx:323-339`. It also means S3 contractor cases get **no** stage-1 contractor evidence, so the S3 score, which is contractor-only, starts at 0.

## 5. Input types: how each one is captured and whether it scores (measured from code)

| input_type | Intake control | Grade source | Adds to score? |
|---|---|---|---|
| grade_select (**admin default**) | 1–5 select. Labels come from grade_scale, falling back to "Grade 5…1". | RM picks directly | Yes, if subject is customer or contractor |
| numeric | number box | client-side band lookup | Yes, if a band matches. Otherwise silently ungraded (#77). |
| link_list / dropdown | select from mappings | mapping lookup. The intake client doesn't map legacy `dropdown`. | Yes |
| yes_no | Yes/No | mapping. Both mappings are enforced at save. | Yes |
| date | date picker | client bands. The server path doesn't map dates (#62). | Only if bands are configured |
| short_text / long_text | text box | none | **No**, but still required |

**Questions that cost but don't pay (measured from code):**
- **Subject = case:** `calculateSubjectScore` only keeps customer or contractor tasks (`scoring.ts:62`). Case parameters only affect the ambiguity check, and only when marked critical (`scoring.ts:283-300`).
- **Text inputs:** never graded.
- **Weight-0 parameters:** "0 excludes this parameter from scoring", yet they are still required at intake.

The intake query doesn't fetch `weight`, `is_critical` or `require_reasoning`. So the RM can't tell which questions matter.

## 6. Answers remembered per party vs per case only (mechanics measured; counts not measurable)

- **Writing to party memory:** this happens **only** in `handleNewCase` (`actions.ts:88-120`), for any answer whose parameter is remembered per party, on both draft and submit. The only other writer is the bulk import (`admin/imports/actions.ts:225`). Workspace completions, KAM edits and stage 2/3 answers are **never** written back. So the memory keeps the RM's first value even after a KAM corrects it.
- **Reading from party memory:** `fetchPartyDetails` loads **all** of the party's saved values, from any stage and any owner, into `rmTaskAnswers` (`NewCaseForm.tsx:114-127, 145-158`). Then:
  - Stage-1 RM questions show a "Reused from …" marker. That is the only visible part.
  - Saved values for **RM-owned stage 2/3 parameters** go into `draft_rm_answers`. `generateStageTasks` then marks those tasks **Completed at submit** (`engine.ts:306-320`) without the RM ever seeing them. They have no provenance and no `completed_at`, which breaks Principle 12.
  - Saved values for **KAM, BDO or Accounts parameters** are ignored (`isRmTask` guard), so those people re-ask facts the system already holds.
  - Each submit writes every reused value back with `captured_at = now`, which makes stale values look freshly captured (#3).
- **Default remember scope = none.** Reuse is therefore zero unless the admin changes it per parameter. The `site` and `rm` scopes exist in the schema and the admin labels but are never read or written ("not yet used at intake").
- **Two overlapping flags.** `is_stable` ("from party-level history", used by the pre-approval band) and remember-per-party are separate fields. A stable parameter that isn't also remembered per party never gets a value, so pre-approval coverage stays at 0%.
- **Imported history is never used to answer questions.** The imported payment and exposure history (order count, average and maximum delay, payment recency, outstanding, overdue) is displayed in the workspace (`cases/[id]/actions.ts:60-64`). It is never used to pre-answer a parameter or to set `history_classification`, so any payment-behaviour parameter has to be re-typed by a person.

## 7. Re-ask and duplicate effort

| # | Pathway | Measured or estimated | Cost |
|---|---|---|---|
| D1 | S2 asks parallel customer and contractor versions of the same concept. There is no shared concept key. | Structural (measured) | Up to 2× for the shared concepts |
| D2 | KAM can "Edit answer" on every RM intake task (`StagesTab.tsx:278`, `TaskCompleteForm.tsx:20-46`). There is no "verified" state, so re-grading is the only form of review. | Measured | One re-entry per question the KAM disputes |
| D3 | `require_reasoning` is enforced in the workspace (`cases/[id]/actions.ts:317`) but not at intake. A later edit forces the reason that intake skipped (#15). | Measured | 2nd touch for every require_reasoning parameter |
| D4 | RM stage 2/3 questions are generated at submit. They go straight into the RM's My Tasks (`page.tsx:326-332` filters only on assignee and Pending) but can only be answered once that stage is current. They stay in the queue even when routing says stage 1 is enough (`engine.ts:343-344` generates all 3 stages; `required_stage` is ignored). | Measured | Re-entry later, plus tasks in the queue that can't be done |
| D5 | Party facts owned by KAM or BDO are re-asked on every case (not remembered, ignored when reused) | Measured | One question per case per such parameter |
| D6 | Imported payment history gets re-typed as parameters | Measured (no mapping exists) | One question per history-type parameter |
| D7 | A history-conditioned RM parameter is asked at intake, but no task is ever created for `repeat` (classification is always `first_time`) | Measured (only reachable via SQL-set rules) | The answer is thrown away |
| D8 | PartyDialog re-asks the party type the slot already implies, and city overlaps with the step-3 city code | Measured | 1–2 fields per new party |

## 8. What the RM gets back

- `submitCase` never calls `updateCycleScore`. The cycle has **no score, band or credit days** until someone completes a task in the workspace (prior study #15 and #75).
- `refreshPreapprovedBand` / `getPreapprovedBand` (`src/utils/preapproval.ts`) already compute a policy minimum and maximum credit days per party. They work from saved party values plus best and worst grades for per-case parameters. They are called only from admin pages and from billing. **They are not called at intake.** This is the cheapest way to give the RM an early answer ("likely 30–45 days for this party").
- The receipt doesn't say which questions were auto-completed from party memory or which RM tasks will come back at stage 2 or 3.

## 9. Read-only SQL to turn the estimates into measurements (for someone with DB access)

```sql
-- Intake questions per scenario (active policy)
with p as (select pd.* from parameter_definitions pd join policy_versions v on v.id=pd.policy_version_id and v.is_active where pd.is_active)
select subject_type, stage, default_owning_role, input_type, persistence_scope, is_stable,
       count(*) n, count(*) filter (where coalesce(rubric_guidance,'')<>'') with_rubric,
       count(*) filter (where weight=0) weight0, count(*) filter (where is_critical) critical,
       count(*) filter (where require_reasoning) req_reason, count(*) filter (where conditional_rules is not null) conditional
from p group by 1,2,3,4,5,6 order by 2,1,3;
-- Reuse actually achieved
select count(*) total_rm_s1_tasks, count(*) filter (where completed_at is null and status='Completed') auto_completed
from stage_tasks where stage=1;
```

## 10. Recommendations, ranked by RM load removed

1. **Change the admin defaults and add guard rails.** Default the owner to KAM or "unassigned" and the remember scope to per party for customer/contractor parameters. Make "required" and the scenario rules editable. Warn when a parameter would add an RM intake question: "This adds 1 required question to every S1/S2 intake."
2. **Ask only what the system can't know.** Use imported history and exposure to pre-answer stable parameters. Set `history_classification` from matched history. Check parameter conditions in one function shared by intake and the engine.
3. **Ask once, everywhere.** Write every completion of a party-remembered parameter back to party memory, whoever answered it and at whatever stage. Use reused values for all owners. Show *all* auto-filled parameters at intake as "Pre-filled from party memory", one "Confirm all" with per-row edit, and record provenance on the task.
4. **Don't ask what doesn't score.** Hide or make optional the case-subject, text and weight-0 parameters, or label them "context, not scored". Show weight and critical badges on each question.
5. **Offer RM stage 2/3 questions optionally at intake.** Collapse them under "Answer now to speed up review". Keep stages beyond `required_stage` out of My Tasks.
6. **Give an answer back.** Show the pre-approval band and an indicative score on the submit step and in the receipt (pairs with prior study #135).
7. **Enforce `require_reasoning` at intake** and show the reason box only for those questions. That halves Step 4's visible inputs when most parameters don't need a reason.


## external-patterns

**Key numbers**

- Baseline from code: ~16 RM inputs/decisions plus 4 step transitions for a repeat-customer case (N=8 policy questions); ~28 for a new customer (Add Party dialog has ~12 fields)
- Estimated after P1-P8: repeat case ~4-6 inputs (about -65%); new GSTIN customer ~10-12 (about -60%). Estimates from counting fields in code, not measured
- GSTIN lookup turns about 12 typed party fields into 1 typed field plus 2 confirmations (~75-85% fewer keystrokes); offline GSTIN parsing alone (PAN, state, checksum) removes 2-3 fields at zero vendor cost
- Roughly 40-60% of Stage 1 RM questions are typically factual (payment delay, overdue, vintage, filing compliance) and could be system-answered through auto_band_config plus a source key; 20-40% from internal party_history/party_exposure alone
- fetchParties() caps the picker at 200 rows and searches by name only; there is no unique constraint on parties.gst_number/pan_number
- party_preapproved_bands is computed but shown 0 times in intake (only in admin and billing); parameter_definitions.persistence_scope 'site' and 'rm' exist but are never read or written
- Vendor claims, unverified: nCino 80% less duplicate data entry; HighRadius 80-90% of low-risk approvals automated; Perfios CAM AI 85% less underwriting time; nCino extraction needs human check in under 10% of cases
- Indicative GSP GST pull cost ~Rs 20-80 per 3B+1 summary profile (secondary source)

## External patterns for cutting RM load in CreditFlow intake

**Scope.** I read the code and migrations only. I edited nothing and connected to no database or service. Web sources are listed at the end. Most performance figures in vendor sources are marketing claims and are marked that way. My load estimates come from counting inputs and decisions in `NewCaseForm.tsx` and `PartyDialog.tsx`. They are not measured.

### 0. What CreditFlow asks today (baseline, from code)

| Step | What the RM has to supply or decide | Notes from code |
|---|---|---|
| 1 Scenario & parties | Scenario (3 options), customer `<select>` (capped at 200, no search), contractor `<select>` | `fetchParties()` has `.limit(200)` and searches only by name. |
| 1a Add party (dialog) | About 12 fields: legal name, customer code, type, subtype, phone, nickname, GSTIN, PAN, city, state, industry, credit limit | GSTIN and PAN are free text with no checksum check. Address is saved as `"city, state"`. There is no unique constraint on `gst_number`/`pan_number`, so duplicates are possible. The `credit_limit` field name does not match the `credit_line_amount` column (UX #17). |
| 2 Commercial ask | Site value, credit %, tranche grid (type/value/days per row) | The default tranche is 100% at 30 days. Reconciliation is exact. |
| 3 Site & handoff | City code, site address, KAM, justification | The site ID is generated automatically. The KAM is a pure recall decision with no default. |
| 4 Questions | N policy parameters (`stage=1`, `default_owning_role='rm'`), each with optional notes | The only reuse is `party_parameter_values` (`persistence_scope='party'`). The `site` and `rm` scopes exist in the schema CHECK but are never read or written. |

**Assets that exist but are not used at intake:**
- `party_preapproved_bands`, `getPreapprovedBand()`: shown only in admin and billing.
- `party_history`: avg/max delay, order count, payment recency.
- `party_exposure`: overdue amount and overdue days.
- `parameter_definitions.is_stable` and `auto_band_config` (numeric, date and mapping bands).
- `score_bands.approved_credit_days`.
- `evaluateRequiredStage` / `describeRoutingOutcome`.

So the system already holds much of what it asks the RM, and much of what it could hand back.

Rough baseline for a repeat customer with one tranche and N=8 questions: about 16 inputs or decisions and 4 step transitions. A new customer adds about 12 dialog fields, so about 28.

---

### 1. Patterns, fit with CreditFlow, and estimated load reduction

#### P1. Identifier-first party creation: "paste GSTIN, confirm, done" (India KYB standard)
- **What best-in-class does.** Indian KYB stacks (Cashfree, HyperVerge, Attestr, Signzy, Karza) take a GSTIN and return:
  - legal name and trade name
  - constitution of business (Pvt Ltd, Proprietorship and so on)
  - registration date
  - taxpayer type and status (active, cancelled, suspended)
  - nature of business
  - principal and additional places of business
- **Zero-cost offline layer (no vendor needed).** A GSTIN has a fixed structure: 2-digit state code, the 10-character PAN, entity number, `Z`, and a checksum. From that alone CreditFlow can:
  - derive PAN and state
  - catch typos with the checksum
  - dedupe by PAN or GSTIN, all on the client
- **Fit.** `parties` already has `legal_name`, `display_name` (fills from trade name), `gst_number`, `pan_number`, `address`, `industry_category` (fills from nature of business) and `is_candidate`. New columns needed:
  - `constitution`
  - `gst_status`
  - `gst_registered_on` (which gives vintage)
  - structured `city` and `state`
  - `kyb_source` and `kyb_fetched_at`, for provenance under doctrine Principle 12
- **How it would apply.** The PartyDialog becomes:
  1. GSTIN or PAN (one field).
  2. The system fills everything it can and shows a "Verified from GSTN · 9 Nov" chip.
  3. The RM confirms phone and party type.
  4. The customer code is generated automatically, as it already is for influencers.
  5. If GSTIN or PAN matches an existing party or alias, it shows "Already exists: use it" instead of creating a duplicate. `party_aliases` already exists for this.
- **Estimated reduction.** The new-party dialog goes from about 12 typed fields to 1 typed field plus 2 confirmations, roughly 75–85% fewer keystrokes. Name, PAN and state typos drop to almost zero. The offline-only version (PAN and state derivation, checksum, dedupe) still removes 2–3 fields with no vendor dependency.

#### P2. Search-anything party picker, with inline "not found? paste GSTIN" (fixes UX #16, #17)
- **What best-in-class does.** CRM and LOS pickers search across name, alias, code and tax ID, and show recent or "my" parties first. Creating a party happens inside the picker and auto-selects it in the slot that opened it.
- **Fit.** Replace the native `<select>` (capped at 200) with a server-side combobox that queries `legal_name`, `display_name`, `customer_code`, `gst_number`, `pan_number` and `party_aliases.alias_name`. If nothing matches, the GSTIN flow from P1 opens inline.
- **Estimated reduction.** No more scanning a 200-row list. Recall moves from "exact legal name" to "any fragment or ID". Expect about 10–20 seconds and one error class (wrong or duplicate party) removed per case.

#### P3. System-answered policy questions: "ask only what it cannot know"
- **What best-in-class does.**
  - Indian MSME underwriting (Perfios GST Analyser, AuthBridge, IIFL practice) derives turnover trend, filing consistency, late-filing recency, suspension flags and concentration from GST data.
  - HighRadius combines internal signals (average days to pay, utilisation, order history) with bureau data, so analysts never re-key them.
  - nCino reports document extraction that pulls revenue and cash flow automatically, with human checks in under 10% of cases (vendor claim).
- **Fit (strong).** `parameter_definitions` already has typed inputs, `auto_band_config` bands and mappings, and `is_stable`. Add one key, such as `auto_band_config.source`, with values like:
  - `party_history.average_delay_days`
  - `party_history.max_delay_days`
  - `party_exposure.overdue_days`
  - `party.gst_registered_on` (date band, giving vintage)
  - `gst.filing_ontime_pct_12m`
  - `udyam.enterprise_type`
  - `bureau.cmr_rank` (mapping CMR-1..10)

  A **server-side** resolver then fills the value and grade, with provenance. This also closes UX #62, where client-trusted grades come from three different resolvers. The RM sees something like "Auto: payment delay avg 12d → Grade 4 (party_history, as of 1 Nov) · override".
- **What can be answered from internal data today, with no external API:** payment track record (avg and max delay, recency), overdue days, order count and volume, existing credit line and outstanding.
- **What GSTIN lookup alone can answer:** business vintage, constitution, active status.
- **Estimated reduction.** In a typical trade-credit policy, roughly 40–60% of Stage 1 RM questions are factual rather than judgment calls. Each one auto-answered removes a recall-plus-lookup task: the RM no longer leaves the app to check an ERP ledger or the GST portal. What remains is judgment: relationship strength, site quality, contractor reliability.

#### P4. Live "likely outcome" panel while filing (fixes UX #75)
- **What best-in-class does.**
  - HighRadius sorts requests into auto-approve, escalate or decline and auto-approves low-risk cases (it claims 80–90% of low-risk approvals are automated; vendor figure).
  - Creditsafe returns a *recommended credit limit* alongside the score.
  - Indian fintechs show a "pre-approved limit" before application.
  - The pattern is to show the answer while the RM is still shaping the ask, not after submission.
- **Fit (very strong; mostly existing data).** A sticky side panel, updated as the RM types, showing:
  1. **Preapproved credit-days band** from `party_preapproved_bands`. This only reaches admin and billing screens today. Show it when `sufficient_history` is true.
  2. **Routing**: "Stage 2 review because exposure > ₹X", using `evaluateRequiredStage` (already on the client) and `describeRoutingOutcome` (move it to a shared module).
  3. **Headroom**: `credit_line_amount − party_exposure.outstanding_amount`, plus any current overdue.
  4. **Requested composite days vs band**: "Inside preapproved band, expect fast path" or "12 days above band, expect negotiation". The same panel becomes the submission receipt that §12.3 asks for (next owner, tasks created, expected timeline).
- **Estimated reduction.** Fewer bad-shape submissions that bounce in negotiation, so fewer re-entry loops. Plausibly removes one KAM back-and-forth on a meaningful share of cases. This is the main "useful outcome back" lever.

#### P5. Start from the previous case or repeat site ("clone and adjust")
- **What best-in-class does.** Commercial LOSs reuse relationship data across deals. nCino claims an 80% cut in duplicative data entry (vendor figure). B2B credit tools treat limit increases and repeat orders as a short path, not a fresh application.
- **Fit.** `fetchPartyDetails` already loads `lastCase` but only displays it. Add "Start from last case (₹X, 45d, 2 tranches)", which pre-fills:
  - scenario and contractor
  - tranche schedule (as percentages, scaled to the new exposure)
  - city code and site address (only if it is the same site)
  - KAM and justification

  Turn on the unused `persistence_scope='site'` (answers that belong to a site, reused for the next tranche or order at that site) and `'rm'` (the RM's own defaults).
- **Estimated reduction.** For a repeat party, roughly 16 inputs drop to about 3–5: amount, credit %, confirm, and anything stale. About 65–75% less effort. In B2B trade credit, repeat parties are usually the majority of volume, so this pattern has the largest total effect.

#### P6. Smart defaults instead of blank decisions
- **What best-in-class does.** Inferred defaults cut interaction cost (NN/g's concept, as cited by secondary sources). The caveat is that defaults must stay visible and editable, and must not be used where attention is required.
- **Fit in CreditFlow:**
  - KAM: default to the party's last-case KAM, otherwise the RM's usual KAM.
  - City code: default from the party's GSTIN state or address, or the RM's home city.
  - Scenario: default from party type, so contractor-only parties preselect "Contractor Name, Contractor Pays".
  - Tranches: offer template chips ("100% @ 30d", "50/50 @ 30/60", "Last case") instead of the raw grid. Keep the grid behind "Custom".
  - Amounts: Indian lakh/crore formatting and shorthand entry ("12.5L", "1.2Cr"), with the parsed value echoed back.
- **Estimated reduction.** Removes 3–4 blank decisions per case and the most common numeric slip (wrong number of zeros on lakh-scale values).

#### P7. Server autosave and resume, made safe against retries (fixes UX #2, #14, #61)
- **What best-in-class does.** The USDS pattern is to allow save and resume and say so up front. Mature implementations autosave between steps rather than rely on a button, and resume links must never break.
- **Fit.** Upsert the draft `credit_cases` row on step change and on a debounce, keyed by an idempotency token held in the form, so a retry never creates a second case. Add a "Continue draft (2 of 4 done)" row to the RM home queue (`src/app/page.tsx`). The `/cases/new?draft=<id>` route rehydrates state, including `draft_rm_answers`.
- **Estimated reduction.** Removes complete re-entry when a draft is abandoned or a navigation slips (today, drafts are a dead end). A single loss event costs the full intake, so this guards against the worst case rather than shaving the average.

#### P8. Progressive disclosure: ask at the moment it matters (doctrine §12.3)
- **What best-in-class does.** Reveal fields by context. Split long forms only alongside navigation, saved progress and progress tracking. Use GOV.UK "check answers" before submit.
- **Fit:**
  - Make the wizard non-linear: any step is reachable, and blocked Continue buttons say why (UX #76).
  - Hide contractor fields unless the scenario needs them (already partly done). Hide the tranche grid unless "Custom".
  - Defer what the RM does not need for routing: site address can be completed before submit or as a Stage 1 task. Documents become Stage 2 tasks that the system issues, not intake fields.
  - Move the final review above the question list (UX #78).
- **Estimated reduction.** No new automation, but less carried context: the RM sees about 5–7 fields up front instead of the full set.

#### P9. Mobile field capture for an RM at the site
- **What best-in-class does.** Indian LOS field apps (Nucleus mFin, Newgen, LeadSquared Finflo) offer geo-tagged visits and photos, offline capture, OCR of KYC documents, and PAN-based verification.
- **Fit.** CreditFlow is a responsive Next.js app, so a full native app is not needed:
  - Use device geolocation plus reverse geocoding to fill `site_address` and suggest `city_code`.
  - Use `<input capture="environment">` for site photos (geo and time stamped) as evidence on the case.
  - Optionally OCR a GST certificate or visiting card to feed P1.
- **Estimated reduction.** Removes typing the site address, the longest free-text field. It also turns the site visit itself into evidence.

#### P10. Consent-based deep data (GST returns, bank statements, bureau): system-issued, not RM-collected
- **What best-in-class does.**
  - GSTN went live as a Financial Information Provider on the Account Aggregator network in 2023.
  - GSPs (Vayana, Cygnet, MasterGST and others) pull GSTR-1/3B/2B with a one-time OTP from the taxpayer. Indicative cost is about ₹20–80 per summary pull (secondary source).
  - Perfios-style analysers reconcile GST against bank data; a GST-to-bank mismatch is a known MSME fraud signal.
  - TransUnion CIBIL's CMR (rank 1–10) predicts the chance of an MSME turning NPA within 12 months.
  - RBI's ULI is a consent layer that adds GST, land and CKYC data.
- **Fit (selective; Phase 3).** Two access caveats need checking, because CreditFlow appears to be a seller extending trade credit rather than a regulated lender:
  - Under the NBFC-AA Master Direction, AA data users (FIUs) must be regulated by a financial-sector regulator.
  - Commercial bureau access is limited to bureau members and specified users under CICRA.

  The practical route is GSP OTP pulls, which need no FIU status, or a regulated partner. Trigger this only above a routing threshold, such as Stage 3 exposures. The system sends the consent link to the customer by SMS or WhatsApp, and the results feed P3 parameters automatically. The RM never chases PDFs.
- **Estimated reduction.** Removes document collection and manual spreading for large cases. Perfios claims an 85% cut in underwriting time (vendor figure, unverified). Low value on small tickets, so it must be gated by exposure.

#### P11. Duplicate and open-case warnings on party selection
- **Fit.** When a party is picked, show "1 open case for this party (CF-0412, In Review, ₹8L)" and same-site cases, using `case_attributes->>site_id` and `city_code`. Doctrine §12.3 lists this explicitly. It prevents duplicate work and the confusion of parallel negotiations.

---

### 2. Fit matrix and sequencing

| # | Pattern | Data model fit | External dependency | Est. RM load cut | Priority |
|---|---|---|---|---|---|
| P5 | Clone last case / site reuse | Strong (`lastCase`, unused `site`/`rm` scopes) | None | ~65–75% on repeat cases | Now |
| P4 | Live likely-outcome panel | Strong (preapproved bands, routing, headroom already exist) | None | Fewer negotiation loops; gives the outcome back | Now |
| P7 | Autosave and resume, idempotent | Draft row exists; add resume and idempotency key | None | Removes catastrophic re-entry | Now |
| P6 | Smart defaults and templates | Strong | None | 3–4 decisions per case | Now |
| P2 | Search-anything picker | Strong (aliases exist) | None | 10–20 s and duplicate errors | Now |
| P3a | Auto-answer from `party_history` / `party_exposure` | Strong (`auto_band_config`, `is_stable`); needs a `source` key and server resolver | None | ~20–40% of questions | Next |
| P1a | GSTIN offline parse (PAN, state, checksum, dedupe) | Strong | None | 2–3 fields plus typo class | Now |
| P1b | GSTIN/PAN KYB lookup autofill | Good; add constitution, status, reg date, structured address, provenance | KYB API (Cashfree, Signzy and others) | ~75–85% of new-party dialog | Next |
| P3b | GST vintage, filing compliance, Udyam auto-answers | Good via P1b data | KYB / GSP API | Another ~10–20% of questions | Next |
| P8 | Non-linear, progressive intake | UI only | None | Lower carried context | Next |
| P9 | Mobile geo and photo capture | Good (`case_attributes`) | Geocoder | Removes site-address typing | Later |
| P10 | GSP / AA / bureau consented pulls | Partial; legal access must be checked | GSP, AA partner, bureau | Large cases only | Later, gated by exposure |
| P11 | Duplicate and open-case warning | Strong | None | Prevents duplicate cases | Now |

**Combined estimate (inputs and decisions, from code count):**

| Persona | Today | With P1–P8 |
|---|---|---|
| Repeat customer | ~16 inputs, 4 transitions | ~4–6 inputs, 1 screen (about −65%) |
| New customer with GSTIN | ~28 | ~10–12 (about −60%) |
| New PAN-only proprietor contractor (no GSTIN) | Same as new customer | Gains less: PAN parse only, no autofill; judgment questions remain |

**Preconditions.** Do server-side grade resolution (UX #62) before P3, so system answers can be trusted. Fix the reused-answer carryover bug (UX #3) before scaling reuse in P5.

### Sources
- GSTIN verification fields: https://www.cashfree.com/docs/secure-id/know-your-business/verify-gstin.md ; https://cashfree.com/docs/api-reference/vrs/v2/gstin/verify-gstin ; https://documentation.hyperverge.co/api-reference/india_api/GST%20Authentication%20APIs/india_gst_authentication_v2_api ; https://attestr.developerhub.io/attestr-docs/gstin-verification-api ; https://microvistatech.com/gst-verification-api
- PAN → GSTIN lookup: https://docs.enriched-api.vayana.com/routes/enriched/gstn/apis/pan-to-gstin-lookup/ ; https://www.cashfree.com/docs/secure-id/know-your-business/pan-to-gstin ; https://attestr.developerhub.io/attestr-docs/search-gstin-by-pan-number-api ; https://sovos.com/in/wiki/knowledge-base/taxpayer-search-by-pan-api/
- GST portal turnover and cash-paid % visible after login: https://tutorial.gst.gov.in/userguide/taxpayersdashboard/Search_Taxpayer_manual.htm ; https://www.taxmann.com/post/blog/new-functionality-on-annual-aggregate-turnover-aato-deployed-on-gst-portal-for-taxpayers/
- GST filing-status APIs and lender use: https://developer.gsp.finagg.in/ ; https://www.iifl.com/blogs/business-loans/the-impact-of-regular-gstr-1-filings-on-loan-renewal-options ; https://quicko.com/tools/gst-return-status ; https://authbridge.com/?p=71747
- GSP data, derived signals, costs: https://javajack.github.io/b2b-lending-india/04-integrations/gst-data-and-gsps/
- Signzy GST analytics (turnover range without consent): https://www.signzy.com/?p=8920
- Udyam verification: https://www.cashfree.com/docs/api-reference/vrs/v2/udyam/verify-udyam ; https://docs.signzy.com/api-marketplace/udyam-registration
- Account Aggregator and GSTN as FIP: https://setu.co/blog/the-gst-data-tale-on-account-aggregator ; https://sahamati.org.in/wp-content/uploads/2025/01/Pragati-Session-on-AA-360.pdf ; https://inc42.com/?p=369348 ; https://ignosis.ai/blog/how-aa-is-transforming-msme-lending-adoption-trends-and-portfolio-intelligence
- RBI ULI: https://www.iifl.com/blogs/other/what-is-uli-unified-lending-interface ; https://yourstory.com/2024/08/rbi-guv-unveils-unified-lending-interface-to-revolutionise-credit-access
- CIBIL CMR / commercial report: https://newsroom.transunioncibil.com/enhanced-cibil-msme-rank-launched-by-transunion-cibil-to-cover-smaller-businesses/ ; https://www.transunioncibil.com/content/dam/transunion-cibil/business/collateral/report/cibil-creditvision-cmr.pdf
- Perfios analysers / CAM AI: https://perfios.ai/products/document-analysers/ ; https://perfios.ai/resources/blogs/strengthening-sme-lending-with-multi-gstin/ ; https://fintech.global/?p=211220
- nCino prefill and extraction: https://fintech.global/2025/11/14/solving-european-banks-data-nightmare-with-ncino/ ; https://ncino.com/community-financial-institutions ; https://bankinnovation.net/allposts/biz-lines/lending/how-gulf-coast-bank-and-trust-cut-loan-underwriting-times-in-half/
- HighRadius automated B2B credit decisioning: https://highradius.com/?p=224762 ; https://www.highradius.com/resources/Blog/faqs-on-b2b-credit-management-and-decisioning/ ; https://www.highradius.com/?p=257119
- Creditsafe recommended limit: https://www.creditsafe.com/us/en/b2b-guide/risk/understanding-creditsafes-credit-model.html ; https://www.creditsafe.com/gb/en/credit-risk/credit-reports/international-credit-reports
- Indian LOS field mobility: https://www.nucleussoftware.com/wp-content/uploads/2023/07/mFin_Lending-Mobility_Sell_Sheet-v1.pdf ; https://landing.newgensoft.com/hubfs/_2020%20Website%20files/Brochures/Brochure%20Lending%20Software%20for%20MFIs.pdf ; https://www.leadsquared.com/lending/finflo/
- Form patterns (save/resume, progressive disclosure, defaults): https://designsystem.digital.gov/patterns/complete-a-complex-form/progress-easily/ ; https://uxmovement.substack.com/p/how-to-simplify-a-massive-form-with ; https://shop.smashingmagazine.com/2017/06/designing-efficient-web-forms/ ; https://ui-patterns.com/blog/people-choose-the-path-of-least-effort ; https://design-system.service.gov.uk/patterns/check-answers/
