# Party Master, History Imports, And Outcomes

## Shared Party Master

V1 uses one party master for both customers and contractors.

Core party fields:

- legal or display name
- aliases
- contact info
- address
- optional GST, PAN, customer codes, or similar IDs

The goal is a reliable identity spine without overbuilding a compliance-heavy master record.

## Candidate Parties

When RM or KAM cannot find a matching party:

- they may create a candidate party during intake
- admin may later merge or normalize it

This avoids blocking case creation on master-data cleanup.

## Matching Logic

Matching is:

- automatic where possible
- correctable by users

V1 should support:

- name and alias matching
- optional identifier matching when IDs are available
- manual override when automatic matching is wrong

Design assumption:

- most imports will rely primarily on names and aliases
- identifiers help when present but are not guaranteed

First-time versus repeat classification is inferred from matched history. KAM or another authorized reviewer may override the inferred classification when the imported history or match quality is misleading, and that override must be auditable.

This classification is a live policy context, not only a reporting label. It may be used to suggest personas, change parameter applicability, or influence routing and scoring policy where configured, while still preserving human persona selection on the case.

## Alias And Merge Rules

Only founder/admin can:

- create or edit alias relationships at the master-data level
- merge duplicate party records

Merge and alias actions must preserve:

- audit trail
- import lineage
- case references

## Repeat-Party Behavior

For repeat cases:

- show inline history summary with drilldown
- prefill party and commercial context selectively from the latest relevant case
- do not silently carry prior scored judgments into the new active decision

Prefill should include:

- party details
- recent commercial structure context
- historical summary

Prefill should not include active scored parameter values as if they were current truth.

## Historical Imports

V1 relies on CSV or admin-led imports instead of live ERP integration.

Supported import patterns:

- saved mapping templates
- preview before import
- partial import of valid rows with error reporting
- append behavior for normal new data
- corrective imports with audit trail

## Outstanding Exposure And Overdue Position

Current outstanding exposure and overdue position are part of the review context and should feed both:

- scoring parameters
- reviewer judgment

Freshness model:

- data is refreshed through periodic imports
- last updated timestamp is shown on the case
- reviewers are expected to judge whether the data is still fresh enough for the live decision
- if the data is stale beyond the configured freshness threshold, the system raises a strong warning and treats stale exposure context as an ambiguity or review-risk signal by default

## Derived Metrics

The system should compute reusable history metrics from imported data, such as:

- order count
- total volume
- payment recency
- average delay
- maximum delay
- current outstanding exposure
- overdue position

Users still apply final grades or judgments manually where the policy expects human review.

## Inline History Experience

When a party is selected:

- show compact inline summary in the case workspace
- allow drilldown to detailed records
- show open review cycles, active still-valid approvals, and recent closures for that party

This keeps history visible during review without forcing a context switch.

## Realized Outcomes

V1 should store basic post-decision outcome fields for later learning, including:

- whether the deal happened
- whether payment was on time
- realized delays or late behavior when available
- realized exposure facts when they later become known

Outcome updates may be made by:

- Accounts
- KAM

This is not a full collections workflow in v1.
