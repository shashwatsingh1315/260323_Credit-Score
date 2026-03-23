# Approvals, Appeals, And Ambiguity Review

## Ordinary Approvals

Standard approvals are configurable by stage and case context.

Case-context selection rules may use examples such as:

- exposure band
- case scenario
- branch or region
- other allowed policy-driving attributes

The system may support:

- single approver rounds
- multi-approver rounds

Default rule for multi-approver ordinary approvals:

- all assigned approvers must approve

The default initial operating setup may use KAM as the practical approver across all 3 stages, but the engine must support richer stage plus case-rule configuration.

Ordinary approvers may only:

- approve
- reject
- return for revision

They do not abstain.

## Ordinary Approval Round Rules

| Rule | Behavior |
| --- | --- |
| Roster freeze | Once the round starts, the approver set is frozen |
| Early reject | One rejection immediately fails the round |
| Return for revision | Sends work back to KAM-coordinated revision flow |
| Resubmission | Starts a fresh approval round |
| Live changes | Roster changes after start do not alter the active round |

## Appeal Workflow

Appeal exists for cases where RM or KAM wants a different outcome than the current decision path provides.

Initiators:

- RM
- KAM

Required appeal payload:

- appeal reason code
- requested revised terms
- supporting note

## Ambiguity Workflow

Ambiguity review is distinct from appeal.

It is used when the case remains unclear, especially after deeper review.

Key rule:

- if a case is still unclear after Stage 3, KAM decides whether to send it to ambiguity review

Required ambiguity submission:

- unresolved issues summary
- missing critical items
- KAM recommendation or context note

## Shared Board In V1

V1 starts with one shared 7-person board behind both exception flows, while preserving separate workflow types:

- appeal
- ambiguity review

Schema must remain ready for later separation into distinct committees.

## Board Voting Rules

| Rule | Behavior |
| --- | --- |
| Size | 7-person board in v1 |
| Decision basis | Majority of votes cast |
| Vote window | Editable time window |
| Vote changes | Allowed until window closes |
| Abstain | Recorded but ignored in yes/no majority count |
| Vote visibility | Hidden while open, visible after close |
| Member comments | Optional |
| Material revision | Starts a new board round |
| Roster changes mid-review | Do not change active round; active roster is frozen |
| Tie or no-effective-vote outcome | Ends as unresolved and escalates to founder/admin manual disposition |

## Board Powers

Board may:

- uphold the existing result
- reject
- override to revised terms, including credit days and exposure when the exception path explicitly allows it

Overrides require:

- reason code
- mandatory explanatory text
- recorded vote history

## Exception Visibility

Board members should see full detail:

- stage and subject score breakdown
- per-parameter reasons
- stage findings
- Google Drive evidence links
- history and change timeline

RM does not get this full internal exception view.

## Board Outcome Persistence

A board round is historical and immutable once finalized. If a materially revised case returns to the board:

- a new round is created
- a new vote window opens
- prior round history remains visible but no prior votes are reused

The same principle applies to ordinary approvals: active rounds are frozen historical units and revised submissions create new rounds rather than mutating old ones.

## Relationship To Normal Flow

Appeal and ambiguity review sit on top of normal flow. They do not replace the need for:

- standard stage reviews
- ordinary approvals
- policy snapshots

Instead, they form tightly logged exception mechanisms when normal flow is insufficient.
