# Scoring Engine And Policy Model

## Policy Philosophy

The application must not hardcode business scoring values. Code should implement scoring mechanics, not frozen business thresholds.

Admin-managed policy data controls:

- parameter definitions
- grade scale
- weight matrices
- personas
- score bands
- ambiguity bands
- criticality rules
- dominance categories and matrices
- stage configuration
- stage max totals
- validity windows

## Parameter Model

Each parameter is defined by:

- subject type: `customer`, `contractor`, or `case`
- stage assignment
- default owning role
- required or optional status
- input type
- rubric guidance
- criticality rules
- conditional visibility or requiredness rules

Stage assignment is explicit admin configuration. Signal strength, cost, and lag are metadata used for guidance and analysis, not automatic stage placement.

Parameter metadata should explicitly include:

- signal strength
- cost of signal
- signal lag

These fields are editable in admin, visible in policy-management views, and used to guide policy design and analysis rather than direct automatic stage placement in v1.

## Supported Input Types

The parameter engine should support a focused typed set:

- grade/select
- numeric
- yes/no
- date
- short text
- long text
- link list

This is a parameter engine, not a full general-purpose form builder.

## Shared Grade Scale

V1 uses a shared grade scale across parameters. Individual parameters still retain:

- rubric guidance
- reason expectations
- optional banding logic for numeric or date inputs

Per-parameter reasons are required when scored.

## Numeric And Date Auto-Banding

Numeric and date-style inputs may be mapped to the shared grade scale using editable bands or rules.

This allows the system to:

- store raw input value
- derive grade
- feed the score consistently

## Conditional Applicability

Basic conditional rules are supported.

Parameters may be shown, hidden, or required based on:

- case scenario
- stage
- persona
- history classification such as first-time versus repeat
- prior field values
- other allowed policy context

## Critical Parameters

Criticality is editable per parameter and may vary by context.

Criticality can depend on:

- stage
- scenario
- persona
- other policy context

Missing or inconclusive critical parameters contribute to ambiguity logic.

## Persona Selection

Personas are manually selected on live cases by KAM or authorized reviewer.

Rules:

- customer persona is selected separately from contractor persona
- persona selection is editable during an open cycle
- if persona changes make existing inputs inapplicable, the old inputs remain auditable but stop affecting the active score

Dominance category is also chosen on the live case from an admin-managed list by KAM or authorized reviewer.

## History Classification As Policy Context

First-time versus repeat classification is not just descriptive history. Once inferred from matched history, it becomes an auditable policy context field that may drive:

- suggested persona defaults
- parameter applicability
- routing expectations
- weight-matrix or model selection where policy allows it

The inferred classification may be overridden by an authorized reviewer when history or match quality is misleading, but final persona selection on the live case remains a human choice.

## Subject-Level Scoring

For each subject and stage, the system calculates a normalized weighted score.

Recommended formula:

```text
weighted_sum = sum(parameter_grade_value * parameter_weight)
normalized_model_score = weighted_sum / configured_model_max_total
```

This keeps models comparable even when later stages have higher max totals than earlier stages.

Stage max-total rule:

- Stage 3 max total > Stage 2 max total > Stage 1 max total
- these maxima are admin-managed policy values
- they are used in normalized score computation

## Stage Progression

Scoring is cumulative across stages.

- Stage 2 adds to Stage 1 context and recomputes.
- Stage 3 adds to Stage 1 and Stage 2 context and recomputes.
- Later stages may carry higher scoring power than earlier stages.

The stage model does not discard earlier-stage work.

## Combining Customer And Contractor Scores

The combination path is:

1. score each relevant subject separately
2. calculate stage-level subject totals
3. apply scenario plus dominance matrix to derive final case score using the configured combination method

Scenarios may use:

- customer only
- contractor only
- customer plus contractor weighted combination

In `contractor name, contractor pays`, the end customer is context-only and does not become a scored subject in v1.

Where both customer and contractor matter, the combination method should remain policy-driven rather than hardcoded. The admin-configured scenario plus dominance setup may define:

- direct subject selection when only one subject should control
- weighted blends between customer and contractor scores
- power-law style combination parameters, including configurable weights or exponents, when the business wants dominance-sensitive blending

The code should implement the combination mechanics generically so policy data controls which combination behavior applies.

## Final Case Score Path

V1 uses a `stage first, then subject combine` approach.

That means:

- each subject is scored within the active stage structure
- current stage totals are derived
- scenario and dominance logic then combine subject results into one final case score

## Mapping Score To Approved Credit Days

Final case score maps to exact approved credit-day values through editable score bands.

V1 does not use:

- freeform approver day selection inside a band
- variable day ranges per decision

The system should remain deterministic under the same policy snapshot and inputs.

## Reviewer Score Presentation

The internal review workspace should present different score visibility by role:

- KAM sees stage plus party breakdown with drilldown to parameter reasons and weighted effects
- ordinary approvers see the same stage plus party breakdown needed for decision-making
- board members see the full breakdown during exception workflows
- RM sees only the curated business summary, not the internal matrix

## Draft Score Versus Submitted Score

The scoring UX should show live draft score movement while users edit applicable inputs. However:

- routing
- formal approvals
- audit history
- decision logic

must depend on submitted stage or cycle snapshots, not on every keystroke.

## Ambiguity Logic

A case becomes ambiguous when either of the following is true:

- its score falls inside an editable ambiguity band
- required or critical signals are missing or inconclusive

The ambiguity state influences:

- deeper stage routing
- review flags
- potential board submission

## Policy Snapshots

Every review cycle uses a frozen policy snapshot captured at cycle start.

Rules:

- later policy publications do not silently alter open or completed cycles
- new policy versions affect only new cases or deliberately started new cycles
- current cycle stays frozen even if a new policy is published mid-case
