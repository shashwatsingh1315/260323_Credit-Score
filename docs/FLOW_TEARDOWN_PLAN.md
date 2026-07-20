# Flow Teardown & Redo Plan

**Date:** 2026-07-19
**Method:** Every major flow audited against `CREDITFLOW_PRODUCT_UX_DESIGN_DOCTRINE.md` for (a) half-implemented features, (b) logic that contradicts the product model, (c) UX that hides state or ownership. Each flow gets a verdict: **KEEP** (sound), **FIX** (sound skeleton, targeted repairs), or **REDO** (structure fights the doctrine — rebuild the experience).

Items marked ✅ were completed in the 2026-07-18/19 working session. Unchecked items are planned work, roughly in priority order within each flow.

---

## Verdict summary

| Flow | Verdict | Why |
|---|---|---|
| Policy engine (config) | **REDO** → ✅ rebuilt | Draft workflow existed but drafts were invisible/uneditable — the core loop was broken |
| Policy simulation | **REDO** (pending) | Fakes results with duplicated client math; stub server action |
| Validity rules | **FIX** (pending) | Configurable but never enforced — approvals never expire |
| Intake wizard | **KEEP** | Sound after token migration + grade-label fixes |
| Review & scoring (workspace) | **FIX** | Engine now correct; task-completion UX needs prefill + context |
| Approval / decision | **KEEP** | Round model works; return-for-revision path is wired |
| Board / appeal | **FIX** → ✅ guards fixed | Vote & finalize authz was open to any user; roster now enforced |
| Negotiation / acceptance | **REDO** (partially ✅) | Was a two-button afterthought that recorded no terms; guards + tranche freeze done, real counter-offer editor pending |
| Billing / ledger | **FIX** | Bill-lock invariant enforced; needs a state audit pass next loop |
| Collections | **KEEP** | Recently reworked; tokenized this session |
| Admin / party master | **FIX** | Not yet fully audited; imports flow works |
| Audit log | **KEEP** | Immutable, complete event coverage from actions |
| Dashboard (My Work) | **KEEP** | Honest empty states; approval-success truthfulness fixed ✅ |

---

## 1. Policy engine configuration — REDO ✅ (rebuilt this session)

**What was broken:** `createNewDraft` produced an empty, invisible version. Every sub-page (parameters, grades, personas, bands, dominance, weights, routing, validity, stages, simulation) read and wrote **only the active policy**. The advertised loop — draft → edit → publish — was impossible; the de facto loop was "edit the live policy that open cycles score against," which violates decision integrity (doctrine §17), because `review_cycles.policy_snapshot_id` points at the live `policy_versions` row (there is no snapshot table).

**Rebuild (done):**
- ✅ `createNewDraft` clones the active policy's entire child graph (parameters, grade scale, bands, personas, weight matrices with FK remapping, dominance, routing, validity, stage max totals).
- ✅ Version context via `?v=<id>` on all 10 sub-pages; `resolvePolicyVersion` falls back to active.
- ✅ `PolicyContextBar` on every screen: **Live** (warning, "changes apply immediately to open cycles"), **Draft** (info, "takes effect when published"), **Archived** (read-only notice).
- ✅ Server-side immutability: every upsert/delete asserts the target version is draft or active; archived versions reject mutations with a clear error.
- ✅ Hub version list: "Open" enters a version's context; sub-page cards carry the context; current context highlighted.

**Still open:**
- [ ] Sub-page → sub-page navigation (e.g. Bands "Back") drops the `?v=` param; thread `policyVersionQuery` through client back-links.
- [ ] Publish confirmation dialog summarizing the diff vs the outgoing active version (band/parameter counts changed, weights touched). Publishing is currently one silent click.
- [ ] Deleting a draft (abandon) has no UI at all.

## 2. Policy simulation — REDO (pending, chip filed)

`runSimulation` is a stub returning `{simulated:true}`; the UI imports five engine functions it never calls and re-implements the math client-side. An admin can "verify" a draft with math that diverges from production. Plan: extract the pure scoring math from `utils/scoring.ts` so it runs on hypothetical inputs, call it server-side, delete the duplicate client math, and test simulation-vs-engine equivalence.

## 3. Validity rules — FIX (pending, chip filed)

Rules are stored per policy version but no lifecycle code reads them; an approval from last year is still acceptable today. The page now carries an honest "not yet enforced" banner (✅). Plan: stamp expiry at approval time, surface it in the terms ladder, block acceptance/billing after expiry.

## 4. Intake wizard — KEEP

Now fully tokenized; active step visible; errors render in destructive color; grade dropdowns labeled from the policy's `grade_scale` (the hardcoded labels were **inverted** — "Grade 1 (Best)" while the engine treats higher as better). Reused party answers carry provenance chips; unsaved-work protection works. Remaining niceties: none blocking.

## 5. Review & scoring workspace — FIX

Engine layer corrected this session (0-weights honored, parallel scoring, stage-bounded ambiguity that now matches the missing-critical rule, SLA clocks start on stage entry). Remaining UX repairs:
- [ ] `TaskCompleteForm` starts blank when re-completing a completed task — prefill current answer/reason so editing isn't destructive re-entry.
- [ ] Show each scoring task's weight and its contribution to the running score (doctrine: help the user understand consequence before acting).
- [ ] `parameter_definitions.signal_strength` / `signal_cost` are captured in admin but drive nothing — either surface them in task prioritization or drop the fields.

## 6. Approval / decision — KEEP

Rounds, decisions, return-for-revision, rejection reasons all wired; duplicate dead engine code removed ✅. Watch item: `'Cancelled'` appears in status guards but nothing ever sets it — either implement cancellation or remove it from guards.

## 7. Board / appeal — FIX ✅ (guards landed)

Was: any authenticated user could cast/overwrite votes via `submitBoardVote` (no role check) and **any user could finalize the board decision**. Roster membership was never checked in either vote path.
Done: shared `assertCanCastBoardVote` (round open + inside window + voter on frozen roster) in both vote actions, decision whitelist, admin-only finalize.
Open:
- [ ] Auto-close rounds whose `vote_window_end` passed (currently they linger open until an admin finalizes).
- [ ] Board page should show the voter their own eligibility state before they try to vote.

## 8. Negotiation / acceptance — REDO (first half ✅)

Was a two-button form ("accepted"/"dropped") with no role check, no status guard, and — worst — **it never recorded which terms were accepted** while the Overview terms ladder claimed "Accepted … N tranches" from a column nothing wrote.
Done: KAM/admin-only, must be `Approved`, accepted tranche schedule frozen into `final_accepted_tranches`, composite-days validated.
The actual redo (planned): a negotiation surface where the KAM can record a *counter* schedule (edit tranches within approved credit-day bounds), see policy limits inline, and capture who agreed and when — acceptance today assumes the proposal was accepted verbatim.

## 9. Billing / ledger — FIX (audit next loop)

Bill-lock after first repayment is enforced in actions (per CLAUDE.md). Not yet audited end-to-end this loop: write-off approval path, credit-note lifecycle, restructure extension validation against `original_tranches`. Schedule a dedicated pass.

## 10. Collections — KEEP

Recently rebuilt (kanban triage, PTP hygiene, escalations wired through `billing-actions`); tokenized this session. Revisit only the `text-[11px]` density choice when standardizing type scale.

## 11–13. Admin/party master, Audit, Dashboard — KEEP/FIX

Audit log and dashboard are sound (dashboard truthfulness fix ✅). Admin/party master and CSV imports functioned in spot checks but haven't had a doctrine pass; queue for next loop along with `/search`, notifications, and mobile widths.

---

## Sequencing

1. ~~Policy version context rebuild~~ ✅ (this session)
2. ~~Board/negotiation authz + terms freeze~~ ✅ (this session)
3. Simulation honesty (chip filed — highest remaining integrity risk)
4. Validity enforcement (chip filed)
5. Workspace task UX (prefill, weight visibility)
6. Negotiation counter-offer editor
7. Billing/ledger doctrine pass; then admin/search/notifications/mobile
