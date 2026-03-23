# Technical Architecture

## Recommended Stack

Recommended v1 stack:

- `Next.js` application deployed on `Vercel`
- `Supabase` for authentication and primary data services
- responsive web UI

The app should be designed to work well on desktop and remain usable on mobile browsers for field and task users.

Proactive-ready in v1 means preserving data hooks, not building proactive workflows. The system should already hold:

- reusable party history
- realized outcome data
- approval validity and expiry data
- outstanding exposure and overdue data

It should not yet implement proactive queues, renewal screens, or periodic watchlist workflows.

## Core Architectural Modules

Suggested bounded modules:

1. `case-workflow`
- credit case creation
- review-cycle lifecycle
- stage routing
- waiting, revision, expiry, closure

2. `policy-and-scoring`
- parameters
- personas
- weight matrices
- score bands
- ambiguity rules
- credit-day mapping
- policy snapshots

3. `approvals-and-boards`
- ordinary approvals
- appeal flow
- ambiguity review
- board voting

4. `party-history-and-imports`
- party master
- matching and aliases
- history imports
- derived metrics
- outstanding exposure

5. `audit-and-reporting`
- event logging
- field diffs
- sensitive-view logs
- dashboards
- CSV exports
- decision memo generation

6. `admin-and-governance`
- user management
- branches/regions
- policy draft/publish
- simulations
- committee rosters

## Data Model Overview

High-level data model concepts:

- `users`
- `user_roles`
- `branches`
- `parties`
- `party_aliases`
- `credit_cases`
- `review_cycles`
- `cycle_policy_snapshots`
- `stages`
- `tasks`
- `task_comments`
- `approval_rounds`
- `approval_decisions`
- `board_rounds`
- `board_votes`
- `policy_versions`
- `parameter_definitions`
- `persona_models`
- `weight_matrices`
- `dominance_matrices`
- `imports`
- `import_mappings`
- `case_events`
- `decision_memos`

## Security And Access

The system needs:

- role-based authorization
- sensitive-section restrictions
- audit logging
- safe password-reset flow through email-backed accounts

The app does not require:

- offline synchronization
- external public user access
- multi-tenant SaaS-style separation

## Responsive Requirement

The app must work on mobile browsers for BDO and task execution, but v1 is not a mobile-native app and does not require offline-first capability.

Responsive priorities:

- task completion screens
- comments and mentions
- case summary visibility
- basic approval actions

## Fixed Technical Assumptions

- English-only UI and generated artifacts in v1
- single-currency model
- no native file storage requirement for evidence in v1
- Google Drive links used for audit evidence
- no live ERP integration required in v1

## Implementation Guidance

- Keep policy data separate from workflow-state data.
- Keep frozen round snapshots explicit for approvals and board reviews.
- Make review-cycle snapshots first-class rather than derived only from latest state.
- Design the schema so proactive modules can later be added without rewriting case or party fundamentals.
