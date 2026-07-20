# Deep UX & Policy-Engine Critique — 2026-07-19

Method: every screen read end-to-end; every policy-engine input traced from form field →
DB column → runtime consumer. Verdicts are framed around cognitive-load principles:
working-memory limits (~4 chunks), Hick's law (decision cost grows with equal-weight
options), recognition-over-recall, and prediction-error (UI that promises behavior the
system doesn't perform corrupts the operator's mental model).

---

## A. The headline problem: the policy engine is a museum of dead inputs

Every field an operator can enter is a promise: "this number governs something."
Traced field-by-field, a large fraction of the policy engine breaks that promise.

| Field / page | Entered where | Consumed where | Verdict |
|---|---|---|---|
| `parameter.weight` | Parameters dialog | `calculateSubjectScore` default | ✅ used |
| `weight_matrices.weight` | Weights page | persona override in scoring | ✅ used |
| `grade_scale` | Grades page | labels at intake + task completion | ✅ used |
| `score_bands` | Bands page | `mapScoreToCreditDays` | ✅ used |
| `dominance_categories` | Dominance page | `calculateFinalCaseScore` | ✅ used |
| `stage_max_totals` | Stages page | normalization denominator | ✅ used (but see §C.7) |
| `parameter.sla_days` | Parameters dialog | SLA clocks | ✅ used |
| `parameter.require_reasoning` | Parameters dialog | TaskCompleteForm | ✅ used |
| `parameter.is_stable` | Parameters dialog | preapproval band | ✅ used |
| `parameter.rubric_guidance` | Parameters dialog | intake only — **not** shown in review TaskCompleteForm | ⚠️ half-used |
| `parameter.signal_strength` | Parameters dialog (numeric 1–5) | **nothing** — not even the list table | ❌ dead |
| `parameter.signal_cost` | Parameters dialog (numeric 1–5) | **nothing** | ❌ dead |
| `parameter.signal_lag` | Parameters dialog (Leading/Lagging) | unexplained badge in "Flags" column; no logic | ❌ decorative |
| `parameter.is_critical` | **no UI exists** | `checkAmbiguity` — drives board routing! | ❌ inverse-dead: used but unenterable |
| `personas.minimum_score` | Personas dialog (**required** field, labeled "Minimum Approval Score") | **nothing** | ❌ dead + dangerous illusion of a gate |
| `routing_thresholds` (whole page) | Routing page | **no runtime consumer.** Only a client-side "Routing Preview" string at intake | ❌ fiction |
| `validity_rules` (whole page) | Validity page | none (honest banner present) | ❌ stored fiction |
| yes/no auto-band mappings | Parameters dialog ("Yes/No (Auto-Mapped)") | **bypassed** — intake & TaskCompleteForm hardcode Yes=1/No=0 as grade_value | ❌ dead path + scoring distortion |
| `deal_size_bucket` | fetched + posted + stored | no input control exists in the intake form; always `''` | ❌ ghost field |
| Simulation page | 2 score inputs + dominance | duplicates ~10% of the engine client-side; `runSimulation` + 5 imports + `exposure` state all unused | ❌ dishonest tool |

Specific severities:

1. **`is_critical` is the worst kind of asymmetry.** The one parameter flag with real
   teeth (missing critical parameters ⇒ case flagged ambiguous ⇒ board review) cannot be
   set from the UI, while three decorative signal fields occupy prime dialog real estate.
   The admin literally cannot configure the behavior that exists, and can configure three
   behaviors that don't.
2. **`personas.minimum_score` is a phantom control.** It is *required* at entry and
   labeled "Minimum Approval Score," so an admin reasonably believes personas gate
   approvals. Nothing reads it. An operator who trusts this gate is making credit
   decisions on a control that does not exist. Delete the field or implement the gate.
3. **Routing is theater.** The Routing page's form offers `exposure_min` + `score_below`;
   the intake preview evaluates `exposure_min` + `case_scenario` + `deal_size_bucket`
   (two keys the form cannot produce) and ignores `score_below` entirely (no score exists
   at intake). At runtime, stage progression is fully manual (`progressStage`), always
   generates tasks for all 3 stages, and never reads `target_stage`. The intake screen
   tells the RM "this case is expected to route up to Stage X" — a prediction no code
   fulfills.
4. **Yes/No scoring distortion.** Because both entry surfaces write grade_value 1/0
   directly, (a) configured Yes/No→grade mappings never run, and (b) on a 1–5 grade
   scale a yes/no parameter contributes at most `1 × weight` — it is arithmetically
   almost mute next to graded parameters, whatever its weight. This is a correctness bug
   surfaced by UX tracing.
5. **Simulation validates the wrong thing.** It asks for hypothetical *final subject
   scores* — the output of 90% of the engine — and exercises only dominance-blend +
   band lookup, with client-side math that can drift from production. It receives
   `parameters`, `grades`, `personas` as props and uses none of them.

**Principle:** an input that drives nothing must not be collectible. Dead fields are not
neutral — every visible input taxes every future admin with "do I need to fill this?",
and mis-labeled dead fields (minimum_score) actively miscalibrate trust.

## B. Screen order & workflow critique

Macro order (Dashboard → Cases → Intake → Workspace → Board → Collections) is sound and
role-scoped. The problems are within screens:

### Intake wizard (4 steps)
- **Step-load imbalance.** Step 1 carries ~10 decisions (scenario, city, site ID, site
  address, customer, contractor, KAM, bill amount, exposure); Step 3 is a single dropdown.
  Step 1 alone exceeds working memory; Step 3 exists mostly to house the (fictional)
  routing preview.
- **Money is split across steps.** Bill amount (step 1) and its tranche schedule (step 2)
  are one mental object; the RM must carry the number across a page boundary. Proposed
  regrouping: 1) Scenario & parties, 2) Commercial ask (bill + exposure + tranches +
  composite preview), 3) Site & assignment (site ID, city, KAM), 4) Questions & review.
- **KAM assignment** is an org-routing decision sandwiched between party pickers and
  commercial terms.
- Step 4's error message says missing questions "are listed above in red" — forcing a
  scroll-hunt instead of focusing the first missing field.
- Good: provenance chips on reused answers, unsaved-work guard, draft-from-any-step,
  honest review block, grade labels from policy.

### Case workspace
- Command bar (identity / status / owner / next action), score explained with polarity,
  and the terms ladder (requested → recommended → approved → accepted → realized) are
  genuinely strong. Keep.
- **Friction inversion at task completion.** The most consequential act in the whole
  system — a human scoring judgment that moves credit terms — is a `w-24/text-xs` inline
  micro-form: no rubric (the RM at intake sees `rubric_guidance`; the reviewer in the
  workspace does not — the workspace query doesn't even select it), no weight/contribution
  shown, no prefill when re-completing (destructive re-entry), reason as dropdown when
  required but free-text when optional. Meanwhile the *low*-consequence intake gets a
  4-step ceremony. Friction should scale with consequence, not inversely.
- Persona/dominance change is a small header dialog that silently rescores the case;
  no impact preview ("this changes the score from X to Y"), no explanation that
  "Default (no persona)" means parameter default weights.
- "Request early approval" sits adjacent to "Submit Stage" with no consequence preview.

### Dashboard / cases list
- Both strong: role-specific queues in urgency order, honest empty states, metric cards
  with definitions and scopes, rows that answer what/where/who/next. Minor: `countPDCR`
  and `weightedDaysPDCR` are computed on every load and never displayed (server-side
  dead weight); "Recent activity" queue partially duplicates /cases.

## C. Policy hub information architecture

1. **10 equal cards ≠ 10 equal things.** Parameters/weights/bands are the model; grades/
   stage-totals are calibration; routing/validity are (today) fiction; simulation is a
   tool. Equal-weight grid maximizes Hick's-law scan cost and hides the pipeline.
2. **The engine is a pipeline; show it as one:** evidence (parameters) → measurement
   (grades) → importance (weights/personas) → normalization (stage totals) → blending
   (dominance) → outcome (bands). Ordering the hub this way offloads the schema the admin
   otherwise must hold in their head.
3. **Weight matrices through a keyhole.** One row at a time via two dropdowns + number,
   pure recall ("which combos did I already set?"). It's called a matrix — render one:
   parameters as rows, personas as columns, blank cell = inherits parameter default.
   This also dissolves the invisible two-tier precedence (matrix overrides default).
4. **Parameter dialog = 14 fields, flat 2-col grid,** mixing identity (name/subject/
   stage), measurement (input type/auto-band), scoring (weight), workflow (owner/SLA/
   reasoning) and dead ops metadata. Chunk into labeled sections with progressive
   disclosure; delete the dead fields; add the missing `is_critical`.
5. **Dominance form shows all fields for all methods** — weights are meaningless for
   customer_only/contractor_only, exponent only matters for power_law. Conditionally
   reveal.
6. **Validity rules demand raw JSON authoring** with a placeholder schema no other screen
   documents — for rules that are not even enforced.
7. **Stage max totals are disconnected from what they normalize.** Nothing warns when
   Σ(weights×max grade) drifts from max_total; scores silently cap. Compute the implied
   maximum from the parameter set and surface the delta on the same screen (or derive the
   denominator entirely).
8. Version context (`?v=`) is good; sub-page Back links dropping it, one-click silent
   Publish (no diff vs outgoing version), and no way to abandon a draft remain open.

## D. Settings

- **Three unrelated jobs in two tabs:** risk governance (write-off slippage, tranche
  extension), vocabulary management (RCA/delay reasons), and identity formats (city
  codes, prefixes). Group by the admin's intent, not by storage table.
- The warning banner is generic anxiety ("modify with caution"); each setting should show
  its *specific* blast radius and where it's used (e.g. "raising slippage above 12% would
  auto-clear 3 currently-blocked write-offs").
- Unknown settings fall back to raw `s.key` rendering — future constants will leak as
  `SCREAMING_SNAKE` UI.
- "Reason for Credit (RCA)" mislabels: RCA reads as root-cause-analysis; these are credit
  justifications. Vocabulary must not overload.
- Good: per-setting last-updated stamp, unit suffixes, "effective immediately" honesty.

## E. Priority order

1. Fix yes/no grade mapping bypass (correctness).
2. Add `is_critical` to the parameter dialog (the engine already obeys it).
3. Delete or implement: `minimum_score`, `signal_strength`, `signal_cost`, `signal_lag`,
   routing page (or wire `target_stage` into cycle creation), `deal_size_bucket`.
4. Task completion: show rubric + weight, prefill on re-complete, unify reason input.
5. Weights page → real matrix grid.
6. Rebuild simulation server-side over the real engine.
7. Parameter dialog chunking; dominance conditional fields; stage-total drift warning.
8. Intake step regrouping; settings intent-grouping.
