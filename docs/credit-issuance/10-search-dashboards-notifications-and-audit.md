# Search, Dashboards, Notifications, And Audit

## Dashboard Model

The product should provide role-tailored home views.

Examples:

- RM: own drafts, submitted cases, customer acceptance follow-ups
- KAM: owned case queue, revision workload, pending stage decisions
- Accounts and BDO: assigned tasks and waiting items
- Founders/Admin: global operational dashboard, policy health, queue aging

## Dashboard Emphasis

Day-one dashboards should emphasize work management over analytics.

Primary focus:

- pending tasks
- stage backlogs
- overdue work
- waiting reasons
- approvals needed
- operational bottlenecks

Priority model:

- case and task priority may be edited by KAM or another authorized reviewer
- policy signals such as requested exposure, overdue position, SLA aging, and stage should inform urgency cues in queues and dashboards

## Search And Filtering

V1 should support:

- global search by party and case identifiers
- saved filters
- role-based queue views
- branch or region filters

CSV export of filtered lists is supported for authorized users.

## Notifications

Notifications are in-app only in v1.

Events that should generate alerts include:

- assignment of tasks
- approval requests
- board participation requests
- mentions in comments
- status changes relevant to the user

No email or WhatsApp dependency is required in v1.

## Comments And Collaboration

The product supports:

- case comments
- task comments
- mentions

Comments may be edited, but:

- edit history must be retained
- hard delete is not allowed

## RM-Facing Summary

RM should receive a curated business-facing summary rather than raw internal scoring detail.

Expected behavior:

- the system generates a structured draft summary from the decision
- KAM or approver may refine that RM-facing wording before finalization
- the internal memo remains richer and internal-only

## SLA And Aging

Admin-configured SLA targets should support:

- case aging
- task aging
- overdue indicators
- queue prioritization

Pause behavior:

- waiting reason is recorded
- active SLA clock stops

## Audit Timeline

The system should present a readable timeline rather than only a raw event log.

Timeline should include:

- submissions
- edits and field diffs
- stage transitions
- approvals
- returns for revision
- board rounds and vote outcomes
- overrides
- policy snapshot references
- expiry, withdrawal, and closure events

## Sensitive-View Logging

When users open sensitive sections such as financial-review areas, the system should log:

- who viewed the section
- when it was viewed
- what sensitive area was opened

This is separate from ordinary edit logging.

## Concurrent Editing Guard

The application should warn when multiple users are editing the same case area and prevent silent overwrite with basic stale-save detection. V1 should not rely on hard document locking as the primary conflict strategy.

## Decision Memo PDFs

Each finalized review cycle generates an internal-only decision memo PDF.

The memo should include:

- case and cycle reference
- parties and scenario
- approved or rejected decision
- approved credit days
- requested versus final accepted structure where relevant
- rationale summary
- approval or board history
- policy-version reference
