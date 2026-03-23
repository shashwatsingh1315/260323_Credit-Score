# Reactive Workflow And Case Lifecycle

## Lifecycle Overview

The system is case-centric but cycle-driven.

- A `credit_case` is the long-lived commercial shell.
- A `review_cycle` is the active evaluation round.
- Only one review cycle may be active at a time.

## Main Flow

1. RM creates and saves a draft.
2. RM submits the case.
3. KAM becomes owner.
4. The system opens or continues the active review cycle under one frozen policy snapshot.
5. The system routes the case into the required stage depth.
6. Required tasks and approvals are completed, with a human final normal-flow approval rather than a fully autonomous system approval.
7. The cycle ends as approved, rejected, appealed, ambiguity-reviewed, expired, withdrawn, or superseded by a later cycle.

## Fixed 3-Stage Structure

Review depth is structurally fixed:

- Stage 1
- Stage 2
- Stage 3

Illustrative default stage intent from the current business process:

- Stage 1 is the fastest desk-review layer: RM intake, KAM correction, basic history matching, and low-cost signals that can be collected for every case.
- Stage 2 is a more intensive review layer: field or site checks, latest financial-data review, bank-statement review, and reputation inputs gathered through accounts or business teams.
- Stage 3 is the deepest review layer: extended vendor checks, broader reputation verification, and other expensive or slow signals used only when earlier layers remain unclear or high-risk.

These examples describe the intended review depth pattern, not a hardcoded task list. The specific parameters and tasks inside each stage remain admin-configurable.

What remains editable:

- which parameters belong to a stage
- which tasks are created
- who can work them
- thresholds and ambiguity bands
- approval requirements
- SLA targets

## Stage Routing

Routing is primarily policy-driven.

Routing inputs include:

- requested exposure amount
- approved or draft score state
- ambiguity bands
- missing critical inputs
- other configured policy context

The system may:

- remain in Stage 1
- move to Stage 2
- move to Stage 3
- jump directly from Stage 1 to Stage 3

Manual escalation is also allowed by authorized reviewers, with an audit reason.

Default normal-flow approver behavior may start with KAM across all 3 stages, but ordinary approval requirements must remain configurable by stage and case context.

## Task Behavior Inside A Stage

Tasks in a stage run in parallel by default.

Task types:

- scoring tasks linked to parameters
- operational tasks not directly scored
- ad hoc operational tasks added by KAM or approver when a case needs extra non-scoring work

Operational tasks may be configured as:

- required
- optional

Required operational tasks can block stage readiness unless explicitly waived.

## Stage Readiness

A stage is normally ready when required work is sufficiently complete. However, KAM may force-ready a stage before all work is complete.

When KAM force-readies a stage:

- a reason code is required
- the missing items list is recorded
- missing critical inputs remain visible
- the stage becomes ambiguity-prone in later review logic

## Waiting And SLA Behavior

Cases and tasks may be paused with a waiting reason.

When in waiting state:

- the reason code is required
- the pause is auditable
- SLA working-time clock stops

## Revisions

Approvers may return a case or stage for revision instead of only rejecting it.

Revision rules:

- KAM coordinates revision work by default
- resubmission starts a fresh ordinary approval round
- earlier approvals do not silently carry over

## Review Cycles

Each review cycle:

- uses one frozen policy snapshot
- produces one internal decision outcome
- may produce one decision memo when finalized

When a new cycle is started:

- prior cycle data remains read-only
- party identity, branch, scenario, bill amount, requested exposure amount, contextual case attributes, and the last accepted commercial structure may be carried as reference into the new cycle where allowed
- previous scored inputs remain historical, not silently carried into the new decision

## Changes That Stay Within The Same Cycle

Examples that may stay inside the active cycle, subject to permissions and audit:

- KAM correction of intake details
- persona changes before finalization
- dominance-category changes before finalization
- in-limit tranche restructuring after approval

If a context change makes an earlier parameter inapplicable, the system keeps the old input for audit but excludes it from the active draft score.

## Reopen And Unlock

An authorized approver or admin may reopen a case. Reopen is selective, not all-or-nothing.

Selective unlock may target:

- commercial section only
- other chosen sections as explicitly permitted

Changes made after selective unlock still follow normal re-review rules where applicable.

## Withdrawal, Expiry, And Closure

Withdrawal:

- RM, KAM, or admin may withdraw a live case
- closure reason and note are required

Expiry:

- approved decisions have admin-configured validity windows
- when validity expires, the case is marked expired
- manual reopen or a new review cycle is required

Closure:

- final closure uses editable closure reasons
- examples include rejected, customer declined, duplicate, superseded, or expired

## Duplicate And Linked Cases

When a new case is started for the same party:

- the system shows a strong warning for open reviews, active approvals that are still valid, and recent closures for the same party
- authorized users may still continue
- linked cases are reference-only cross-links, not shared workflow containers

## Main Status And Substatus Model

Recommended top-level statuses:

- Draft
- In Review
- Awaiting Input
- Awaiting Approval
- Approved
- Rejected
- Appealed
- Accepted
- Closed
- Expired

Substatus should carry detail such as:

- current stage
- waiting reason
- board review in progress
- returned for revision
- counter-offer pending acceptance

Evidence links may be attached at parameter, task, or case level so supporting material can sit at the most appropriate layer.
