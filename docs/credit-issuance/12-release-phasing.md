# Release Phasing

## Delivery Strategy

Recommended rollout is phased rather than one broad all-at-once implementation.

The goal is to ship the reactive core with strong correctness before layering in more advanced admin and reporting behavior.

## Phase 1: Core Reactive Workflow

Primary focus:

- authentication and fixed roles
- party master and candidate-party creation
- case intake
- tranche builder
- branch tagging
- draft and submission flow
- KAM ownership
- review cycles
- 3-stage workflow shell
- tasks and comments
- basic ordinary approvals
- audit timeline foundation

Phase 1 must establish the case and review-cycle backbone cleanly.

## Phase 2: Policy And Scoring Administration

Primary focus:

- parameter definitions
- shared grade scale
- personas
- weight matrices
- stage scoring logic
- ambiguity rules
- dominance matrix
- score-to-credit-days mapping
- draft/publish policy versions
- policy snapshots
- simulation tools

This phase turns the workflow shell into a real decision engine.

## Phase 3: Exception Workflows, Imports, And Operational Reporting

Primary focus:

- appeal workflow
- ambiguity workflow
- shared 7-person board
- vote windows and board history
- CSV imports and mapping templates
- outstanding exposure and derived metrics
- role-tailored dashboards
- decision memo PDFs
- CSV exports
- sensitive-view logs
- basic realized-outcome tracking

## What Must Ship First

Must be correct before rollout:

- case intake
- cycle lifecycle
- stage routing basics
- commercial term calculation
- policy snapshot behavior
- audit integrity
- role-based visibility

## What Can Follow

May be delivered after the core is stable:

- richer simulation UX
- broader dashboards
- deeper outcome analytics
- proactive monitoring workflows
- more advanced dependency logic between tasks

## Rollout Notes

Even though this document recommends phased delivery, the data model and architecture should be designed from the start to support:

- board reviews
- imports
- future proactive modules

That avoids a rewrite between phases.
