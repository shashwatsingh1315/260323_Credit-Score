# Credit Issuance Documentation Pack

This directory is the source of truth for the internal credit-issuance application design. It captures the approved reactive workflow, scoring and policy logic, approval and exception handling, audit behavior, admin controls, and technical architecture.

The documentation is intentionally split into multiple files so different readers can enter from the right level:

| File | Purpose |
| --- | --- |
| [01-product-overview.md](./01-product-overview.md) | Business goals, boundaries, stakeholders, and success criteria |
| [02-domain-model-and-glossary.md](./02-domain-model-and-glossary.md) | Core entities, language, and relationship model |
| [03-user-roles-and-permissions.md](./03-user-roles-and-permissions.md) | Fixed roles, visibility, permissions, and sensitive-data rules |
| [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) | RM intake, case scenarios, amounts, and tranche-term model |
| [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) | Review-cycle lifecycle, stage routing, revision, expiry, and closure |
| [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) | Parameter model, score computation, ambiguity rules, and policy snapshots |
| [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) | Ordinary approvals, appeals, board voting, and ambiguity review |
| [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) | Party master, matching, CSV imports, history metrics, and outcomes |
| [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) | Everything configurable in admin and how policy versions are governed |
| [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) | Queues, dashboards, search, notifications, comments, exports, and audit |
| [11-technical-architecture.md](./11-technical-architecture.md) | Recommended stack, module boundaries, and implementation architecture |
| [12-release-phasing.md](./12-release-phasing.md) | Delivery phases after docs approval |
| [13-decision-log-and-traceability.md](./13-decision-log-and-traceability.md) | Decision-by-decision traceability back into this documentation set |

## Reading Order

Recommended paths through the docs:

| Audience | Suggested Reading Order |
| --- | --- |
| Founders and business owners | `01 -> 04 -> 05 -> 06 -> 07 -> 09 -> 12 -> 13` |
| Product and operations | `01 -> 02 -> 03 -> 04 -> 05 -> 07 -> 08 -> 10 -> 12 -> 13` |
| Engineering | `02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12 -> 13` |
| Risk and audit stakeholders | `03 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 13` |

## Short Summary

The application is an internal tool for issuing and reviewing customer credit terms. The first release is reactive-first: it handles credit requests that are actively raised by the business. The tool is built around:

- one `credit_case` per request
- one active `review_cycle` at a time inside that case
- a configurable policy and scoring engine
- fixed 3-stage review depth
- `approved_credit_days` as the main normal-flow decision output
- exception workflows for appeal and ambiguity review

## Fixed Assumptions

The following are structural assumptions for v1:

- The app is a greenfield web app deployed on `Vercel`.
- `Supabase` provides authentication and primary data services.
- The first release focuses on the reactive workflow only.
- Review depth is fixed at 3 stages, but the logic inside each stage is configurable.
- One case can include at most one customer and one contractor.
- Normal-flow decisions primarily govern `approved_credit_days`.
- The workspace is English-only and single-currency in v1.
- The app is responsive web with mobile-important task execution, but not offline-first.

## Editing Principles For This Doc Pack

- Treat business values as configurable unless a document explicitly marks them as structurally fixed.
- Preserve auditability and decision history in every workflow description.
- Avoid hidden assumptions. If a rule matters operationally, it should appear in one of these files.
- Use [13-decision-log-and-traceability.md](./13-decision-log-and-traceability.md) to confirm that a specific nuance from the design discussion was captured.
