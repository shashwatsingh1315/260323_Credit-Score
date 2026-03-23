# Case Intake And Commercial Structure

## Intake Ownership

RM creates the case draft and submits it. After submission, KAM becomes the operational owner of the case.

RM may prepare drafts before submission. Drafts are intended to prevent loss of partially prepared requests.

## Intake Data Model

Core intake fields:

- case scenario
- branch or region
- customer party
- optional contractor party
- bill amount
- requested exposure amount
- proposed tranche structure
- commercial notes
- contextual case attributes from admin-managed enumerations

Branch or region should default from the RM profile and remain editable by allowed users.

Example contextual case attributes include:

- product or material category
- project or site type
- market segment
- deal-size bucket

## Case Scenarios

V1 supports exactly 3 commercial/risk scenarios:

| Scenario | Billing / Payment Meaning | Scoring Treatment |
| --- | --- | --- |
| Customer name, customer pays | Customer is billed and pays | Customer is primary scored party |
| Customer name, contractor pays | Customer is billed, contractor pays | Customer and contractor may both be scored and combined |
| Contractor name, contractor pays | Contractor is billed and pays | Contractor is the scored risk party; end customer is context-only |

RM selects the scenario during intake. KAM may correct it later. Once submission has occurred, changing the scenario is a material commercial change and requires a new review cycle.

Required party rules:

| Scenario | Required Parties | Optional Context |
| --- | --- | --- |
| Customer name, customer pays | Customer required | Contractor absent |
| Customer name, contractor pays | Customer required, contractor required | None |
| Contractor name, contractor pays | Contractor required | End customer optional as context only |

## Party Rules During Intake

- RM can select existing parties from the party master.
- RM or KAM can create a candidate party if the entity does not yet exist in the party master.
- Customer and contractor are drawn from the same shared party master.
- At most one customer and one contractor may appear in a case.

## Amount Model

`Bill amount` and `requested exposure amount` are separate fields.

- `Bill amount` is the total commercial or billing value relevant to the case.
- `Requested exposure amount` is the amount of credit exposure requested from the company.

In normal flow, exposure is not the main model output. Normal flow primarily outputs `approved_credit_days`.

After submission, bill amount, requested exposure amount, party identity, and proposed terms should not be freely editable by RM or KAM. Material commercial edits require authorized reopen or selective unlock and, where applicable, a new review cycle or manual re-review.

## Tranche Builder

RM models proposed terms using an interactive tranche builder.

Each tranche contains:

- amount or percentage
- number of days after billing

The builder must support:

- amount-based entry
- percentage-based entry
- normalization to the total bill structure
- live composite day calculation
- live counter-offer restructuring within approved limits

Validation rules:

- mixed amount and percentage entry is allowed
- the final tranche structure must reconcile exactly to the bill amount before submission
- if normalization fails or total value does not reconcile, submission is blocked with correction errors

## Composite Credit-Day Formula

Composite credit days are calculated as weighted average post-bill days.

```text
composite_credit_days = sum(weight_of_tranche * days_after_billing)
```

Advance or at-billing payments are treated as `0` post-bill days.

## Requested Terms Versus Approved Terms

Evaluation rule:

- if requested composite credit days are within approved credit days, the request is eligible on term grounds
- if requested composite credit days exceed approved credit days, the system can issue a lower counter-offer instead of only rejecting the case

## Counter-Offer Behavior

When approved days are lower than requested:

- the system shows the approved day limit
- RM can restructure tranches live in the builder
- RM can negotiate a revised structure with the customer

If the revised structure remains within approved days and the following commercial bounds remain unchanged, it does not require a new review:

- bill amount
- requested exposure amount
- customer party
- contractor party
- case scenario

Negotiation outcome must be tracked in the same case as one of:

- accepted
- revised again
- dropped
- escalated

## Final Accepted Structure

The system must store the exact final accepted tranche structure if the customer accepts terms. The stored commercial record must include:

- final accepted tranches
- resulting composite credit days
- link to the review cycle that authorized the upper bound
- confirmation that the accepted structure stayed within the approved limit when no further review was required

## Material Changes That Require A New Review Cycle

The following changes require a new review cycle rather than silent reuse of the current one:

- changing the customer party
- changing the contractor party
- changing the case scenario
- other material changes as explicitly triggered by authorized reviewers

Exposure amount changes do not auto-recompute the case. Manual re-review must be triggered.
