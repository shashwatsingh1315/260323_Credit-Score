# Domain Model And Glossary

## Core Domain Objects

| Term | Definition |
| --- | --- |
| Credit Case | The top-level record for one commercial credit request raised by the business |
| Review Cycle | A specific evaluation round inside a case, tied to one frozen policy snapshot |
| Party | A real-world business entity in the shared party master |
| Customer | The party treated as the buying customer in the case context |
| Contractor | The party treated as the paying or billing contractor in the case context |
| Persona | A business-defined scoring cohort selected for a party on a live case |
| Dominance Category | An admin-managed category that controls how customer and contractor scores are combined |
| Parameter | A configurable input or evaluative field used in scoring or case review |
| Stage | One of the fixed review depths: Stage 1, Stage 2, Stage 3 |
| Task | A unit of work created within a stage; may be scoring or operational |
| Approval Round | A frozen set of ordinary approvers for a standard stage decision |
| Board Review | A frozen set of board members reviewing an appeal or ambiguity case |
| Appeal | A formal exception workflow triggered when RM/KAM wants a different decision than the current normal-flow outcome |
| Ambiguity Review | A formal exception workflow for unresolved or unclear cases, usually after deeper review |
| Approved Credit Days | The primary normal-flow output of the scoring and approval process |
| Requested Exposure | The requested amount of credit exposure for the commercial request |
| Bill Amount | The total bill or commercial amount relevant to the case; separate from requested exposure |
| Final Accepted Structure | The exact tranche structure eventually agreed with the customer, if the deal proceeds |
| Policy Version | A published scoring and workflow configuration version |
| Policy Snapshot | The frozen copy of policy data used by a specific review cycle |

## Relationship Model

High-level structure:

```text
Party Master
  -> referenced by Credit Case

Credit Case
  -> has one RM
  -> has one KAM owner after submission
  -> has one customer party
  -> may have one contractor party
  -> has one or more review cycles over time

Review Cycle
  -> uses exactly one policy snapshot
  -> moves through up to three stages
  -> creates tasks, approvals, and possibly board reviews
  -> ends in a decision, expiry, withdrawal, or supersession
```

## Core Structural Rules

- One case can have at most one customer and one contractor.
- A case can have only one active review cycle at a time.
- A review cycle can use only one policy snapshot.
- Stage depth is structurally fixed at 3 stages.
- A finalized review cycle produces its own decision memo.

## Case Scenario Glossary

The case scenario controls scoring and party treatment.

| Scenario | Meaning |
| --- | --- |
| Customer name, customer pays | Customer is the named and paying party |
| Customer name, contractor pays | Customer is named; contractor pays; both may be scored and combined |
| Contractor name, contractor pays | Contractor is the true named and paying risk party; end customer is context-only |

## Commercial Terms Glossary

| Term | Meaning |
| --- | --- |
| Tranche | One payment component inside the commercial structure |
| Composite Credit Days | Weighted average post-bill day value derived from tranches |
| Counter-offer | A lower approved term position when requested terms exceed the approved limit |
| Approval Validity Window | The period during which an approved review-cycle outcome remains valid before expiry |

## Review-State Concepts

| Term | Meaning |
| --- | --- |
| Draft | RM is preparing a case but has not submitted it into formal review |
| In Review | Review cycle is open and active |
| Waiting | Work is paused with a reason code; SLA clock is stopped |
| Returned For Revision | Case or stage has been sent back for corrections |
| Approved | Review cycle has a positive finalized decision |
| Rejected | Review cycle has a negative finalized decision |
| Appealed | Review cycle is in or has entered the appeal path |
| Accepted | RM/customer has accepted a structure within approved bounds |
| Closed | The case is operationally complete |
| Expired | Approved validity has lapsed and manual reopen or a new cycle is required |

## Human-Readable ID Conventions

Visible identifiers should be human-readable rather than raw UUIDs.

| Object | Convention |
| --- | --- |
| Case | Sequential number with year context |
| Review cycle | Case ID plus cycle number |
| Decision memo | Tied to the finalized review cycle |

UUIDs or similar internal identifiers may still be used in storage, but they are not the primary user-facing references.

## Important Distinctions

`Requested exposure` is not the same as `bill amount`.

`Approved credit days` is not the same as the final negotiated tranche structure.

`Policy version` is the published admin configuration, while `policy snapshot` is the frozen copy consumed by a review cycle.

`Review cycle` is not the same as `case`: one case may accumulate multiple cycles over time.
