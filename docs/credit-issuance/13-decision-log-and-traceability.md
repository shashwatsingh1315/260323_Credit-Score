# Decision Log And Traceability

This file lists major decisions captured in the documentation set and points to the source file that specifies each rule in detail.

## Product Scope

| Decision | Reference |
| --- | --- |
| Reactive workflow is the full v1 scope; proactive support is only a future hook | [01-product-overview.md](./01-product-overview.md) |
| Primary success metric is lower credit risk | [01-product-overview.md](./01-product-overview.md) |
| Delivery should be phased rather than one broad launch | [12-release-phasing.md](./12-release-phasing.md) |
| Proactive readiness in v1 means data hooks only, not proactive workflows or queues | [01-product-overview.md](./01-product-overview.md), [11-technical-architecture.md](./11-technical-architecture.md) |

## Structural Constraints

| Decision | Reference |
| --- | --- |
| Fixed 3-stage review depth | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md), [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) |
| One customer and at most one contractor per case | [02-domain-model-and-glossary.md](./02-domain-model-and-glossary.md), [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| One active review cycle per case | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Human-readable case IDs with year context | [02-domain-model-and-glossary.md](./02-domain-model-and-glossary.md) |

## Commercial Model

| Decision | Reference |
| --- | --- |
| Bill amount and requested exposure are separate | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Normal-flow output is approved credit days | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md), [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Normal flow still requires human final approval rather than autonomous approval | [01-product-overview.md](./01-product-overview.md), [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Exposure is a reviewed input in normal flow, not the main normal-flow output | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Tranche builder supports amounts or percentages | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Composite credit days use weighted average days after billing | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Advance payments count as 0 days | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Post-submission commercial edits are controlled through reopen or selective unlock, not free editing | [03-user-roles-and-permissions.md](./03-user-roles-and-permissions.md), [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Tranche inputs must reconcile exactly to bill amount before submission | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Counter-offers are allowed when requested terms exceed approved days | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| In-limit restructuring after approval does not require new review if bill amount, requested exposure, parties, and scenario remain unchanged | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md), [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Same-case negotiation outcomes are tracked as accepted, revised again, dropped, or escalated | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Exact final accepted structure must be stored | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |

## Scenarios And Parties

| Decision | Reference |
| --- | --- |
| Support 3 specific billing/paying scenarios | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Each scenario has explicit required-party rules | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md) |
| Contractor-name, contractor-pays treats end customer as context only | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md), [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Shared party master for customer and contractor | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Auto-match with manual override | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| First-time versus repeat classification is inferred from matched history and may be overridden with audit history | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| First-time versus repeat classification is a policy context that may influence persona defaults, routing, and applicability rules | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md), [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Admin-only merge and alias cleanup | [03-user-roles-and-permissions.md](./03-user-roles-and-permissions.md), [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |

## Workflow And Lifecycle

| Decision | Reference |
| --- | --- |
| RM creates and submits; KAM owns after submission | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md), [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Stage routing is policy-driven but manual escalation is allowed | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Direct jump to Stage 3 is allowed | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Tasks run in parallel by default within a stage | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| KAM assigns work to specific individuals, not a generic pickup queue | [03-user-roles-and-permissions.md](./03-user-roles-and-permissions.md) |
| Waiting state stops SLA clock | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md), [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| KAM can force-ready incomplete stages with reason and missing-items list | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Force-ready with missing critical inputs makes the case ambiguity-prone | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Stage intent follows the current process pattern: Stage 1 fast desk review, Stage 2 intensified field/accounts/reputation review, Stage 3 deep-dive vendor/reputation review | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Scenario or party identity changes require a new review cycle | [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md), [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Selective reopen is allowed | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| New review cycles carry forward commercial and reference context but not live scored judgments | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md) |
| Related-party warnings should show open reviews, valid active approvals, and recent closures | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md), [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |

## Scoring And Policy

| Decision | Reference |
| --- | --- |
| No hardcoded business values; admin-managed policy | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md), [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) |
| Parameters are modeled by subject type and stage | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Parameters include signal strength, cost of signal, and signal lag metadata | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md), [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) |
| Shared grade scale | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Numeric/date fields can auto-band into grades | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Personas are manually chosen by KAM/approver | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Dominance category is chosen on the live case from an admin-managed list | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Stage 3 max total > Stage 2 max total > Stage 1 max total, and maxima are admin-managed | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md), [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) |
| Stage scoring is cumulative | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Customer and contractor are scored separately and then combined | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Combination logic uses scenario plus dominance matrix | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Combination logic may use weighted or power-law style policy parameters rather than one hardcoded blend formula | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md), [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) |
| Score bands map to exact approved day values | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Ambiguity depends on score bands plus missing critical signals | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| Current cycle keeps frozen policy snapshot even after later publish | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md), [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) |
| Live draft score may update during editing, but formal logic uses submitted snapshots | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md) |
| KAM, approvers, and board members see stage plus party score breakdowns; RM does not | [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md), [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| More specific config rules beat generic defaults, and equal-specificity conflicts must fail publish validation | [09-admin-configuration-and-governance.md](./09-admin-configuration-and-governance.md) |

## Approvals And Exceptions

| Decision | Reference |
| --- | --- |
| Ordinary approvals can be single or multi-approver | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Multi-approver default is all-must-approve | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Default operating setup may use KAM across all 3 stages while remaining configurable | [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md), [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Ordinary approvals may be selected by stage plus case-rule conditions such as exposure band, scenario, or branch | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| One rejection immediately fails an ordinary approval round | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| RM and KAM can initiate appeal | [03-user-roles-and-permissions.md](./03-user-roles-and-permissions.md), [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Appeal and ambiguity remain distinct workflows | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Shared 7-person board in v1 | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Majority of votes cast decides board outcome | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Vote window is editable | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Votes can change until close | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Abstain is recorded but ignored in majority count | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Tie or no-effective-vote board outcomes escalate as unresolved to founder/admin | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Board members see full breakdown and evidence links | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Board can override terms with rationale | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |
| Revised submissions create new approval or board rounds instead of mutating old ones | [07-approvals-appeals-and-ambiguity-review.md](./07-approvals-appeals-and-ambiguity-review.md) |

## Imports, History, And Outcomes

| Decision | Reference |
| --- | --- |
| CSV imports with mapping templates are the history source | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Preview plus partial import behavior | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Append plus correction import behavior | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Outstanding exposure and overdue data feed score and review | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Stale imported exposure data raises a warning and contributes an ambiguity or review-risk signal | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Imports depend mostly on names and aliases, with optional identifiers where available | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Inline history summary plus drilldown | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |
| Basic realized outcomes, including realized exposure facts, are captured without building a full collections workflow | [08-party-master-history-imports-and-outcomes.md](./08-party-master-history-imports-and-outcomes.md) |

## Audit, UX, And Architecture

| Decision | Reference |
| --- | --- |
| In-app notifications only | [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| Mention-driven alerts | [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| Case and task priority are editable and informed by policy urgency signals | [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| Sensitive-section view logging required | [03-user-roles-and-permissions.md](./03-user-roles-and-permissions.md), [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| Decision memo PDF is internal-only and per finalized cycle | [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| RM receives a system-drafted, reviewer-editable business summary instead of raw internal rationale | [03-user-roles-and-permissions.md](./03-user-roles-and-permissions.md), [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| Concurrent editing uses warnings and stale-save guards rather than hard locks | [10-search-dashboards-notifications-and-audit.md](./10-search-dashboards-notifications-and-audit.md) |
| Next.js on Vercel plus Supabase | [11-technical-architecture.md](./11-technical-architecture.md) |
| Mobile-important responsive web, no offline | [11-technical-architecture.md](./11-technical-architecture.md) |
| English-only and single-currency assumptions | [11-technical-architecture.md](./11-technical-architecture.md) |
