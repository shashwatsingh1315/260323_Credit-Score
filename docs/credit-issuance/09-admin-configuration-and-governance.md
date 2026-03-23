# Admin Configuration And Governance

## Configuration Philosophy

Business values must live in admin-configurable data wherever practical. The application code should implement workflow and scoring mechanics, not frozen thresholds or matrices.

## Admin-Editable Objects

Admin must be able to manage:

- parameters
- stages within the fixed 3-stage frame
- stage max totals
- personas
- weight matrices
- score bands
- routing thresholds
- ambiguity bands
- dominance categories
- scenario plus dominance combination matrices
- combination-formula parameters such as weights or exponents where the configured method requires them
- approval-validity windows
- closure reasons
- waiting reasons
- branches or regions
- committee rosters
- import mapping templates
- case attributes backed by enumerations

Parameter metadata must include editable fields for:

- signal strength
- cost of signal
- signal lag

Approval-validity windows should be rule-driven rather than one flat default, so admin can vary validity by score band, scenario, persona, or other allowed policy context.

Case attributes backed by enumerations are expected to cover a small policy-driving set such as:

- product or material category
- project or site type
- market segment
- deal-size bucket

## What Is Structurally Fixed

These elements are fixed in v1 and not admin-defined from scratch:

- the existence of `credit_case`
- the existence of `review_cycle`
- fixed 3-stage review depth
- fixed system roles
- single active review cycle per case
- one customer plus at most one contractor per case

## Policy Versioning

Policy changes follow a draft-then-publish model.

Rules:

- admins edit draft policy data
- draft policy can be simulated before publish
- publishing creates a new policy version
- active review cycles keep their existing snapshot
- future cycles consume the new published version

## Policy Simulation

Before publishing a draft policy, admin should be able to test it with:

- manual sample scenarios
- selected prior cases

Simulation should preview:

- score result
- approved credit-day output
- routing behavior
- ambiguity implications

Policy publish validation should also reject ambiguous rule overlaps. Default precedence rule:

- more specific rule beats a generic default
- equal-specificity conflicting rules are invalid and should fail publish validation

## Deactivate, Do Not Delete

Policy objects should normally be deactivated or archived rather than hard-deleted.

This keeps prior review cycles interpretable and avoids invalidating history.

## Rollback Pattern

V1 should support republishing a previous version rather than destructive rollback.

That means:

- historical versions stay intact
- an earlier version may be cloned or republished as a fresh new active version

## Governance Boundaries

V1 intentionally does not require maker-checker governance for all sensitive actions.

Planned governance shape:

- single authorized publisher is enough for policy publication
- admin-only for party alias merge
- frozen snapshots and audit trails provide the main governance safety

This keeps the first release operationally simpler while preserving defensible history.

## Branch And Region Administration

Branch or region values must be admin-managed master data.

They should be used for:

- case tagging
- visibility filtering
- reporting

They should not create separate policy branches in v1 unless a later version explicitly adds that feature.
