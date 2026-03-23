# Product Overview

## Problem Statement

The company needs an internal system for disciplined, explainable issuance of credit to buyers. The current process is relationship-driven and distributed across RM, KAM, accounts, field inputs, and founder judgment. Important policy knowledge exists as tribal knowledge, spreadsheets, and interpersonal escalation rather than as a controlled system.

The product must convert that process into a modular, auditable application that:

- standardizes what is checked
- quantifies what can be quantified
- preserves room for exception handling
- reduces bad credit decisions
- keeps business values editable in the product rather than hardcoded in code

## Product Goal

The primary goal of the first release is:

`Lower credit risk through a more structured and auditable reactive credit-decision process.`

Secondary goals:

- reduce dependence on memory and informal judgment
- make decisions explainable at parameter level
- maintain flexibility for human override through explicit appeal and ambiguity workflows
- create a policy engine that can later support proactive monitoring

## Reactive Versus Proactive Boundary

The broader vision has two tracks:

- `Reactive`: a specific customer or contractor request for credit enters the system and is reviewed.
- `Proactive`: the business periodically reviews parties or exposures even when no fresh request has been raised.

This documentation pack covers the reactive system in full detail. The first release should only create:

- clean schema hooks for proactive expansion
- navigation space that does not block future proactive modules

It should not implement proactive workflows in the first delivery.

## Why The First Release Is Reactive-First

Reactive workflow is the highest-value first slice because it directly governs live credit issuance decisions and captures the core decision logic needed later for proactive monitoring. It also forces the system to model:

- party identity
- history and matching
- staged review
- score calculation
- approval and exception routing
- audit trail and decision memo generation

Those same foundations are prerequisites for any proactive capability.

## Core Stakeholders

| Stakeholder | Business Role In The Process |
| --- | --- |
| RM | Creates the request, negotiates commercial terms, and communicates outcome |
| KAM | Owns the case after submission, coordinates specialists, chooses personas, and manages progression |
| Accounts | Provides financial and outstanding-exposure inputs, bank-statement findings, and realized outcomes |
| BDO | Provides site-level or field observations and related checks |
| Approvers | Provide standard stage approvals when configured |
| Board members | Participate in appeal and ambiguity review |
| Founders/Admin | Govern the policy engine, publish configurations, manage users, and inspect full risk/audit state |

## Business Outcomes The Product Must Support

- give a disciplined, reviewable credit recommendation
- output `approved_credit_days` in normal flow
- let RM compare requested terms against approved limits
- route deeper-risk or unclear cases into more intensive review stages
- allow structured human override through board-backed exceptions
- generate an internal memo and full audit trail for each finalized decision

## Scope Boundaries For V1

In scope:

- reactive credit cases
- configurable scoring and policy administration
- fixed 3-stage review
- standard approvals
- appeal workflow
- ambiguity workflow
- party history imports and outstanding exposure context
- dashboards, queues, audit, PDF memos, and CSV exports

Out of scope:

- proactive monitoring workflows
- ERP live integrations
- native document storage inside the app
- offline-first behavior
- multi-currency logic
- multilingual UI
- custom arbitrary role builder
- generic workflow platform behavior beyond the credit use case

## Product Principles

1. Business configuration belongs in admin screens, not in hardcoded values.
2. Auditability is a first-class product requirement, not a reporting add-on.
3. The system should support human judgment, but only through explicit and logged actions.
4. The workflow should be modular enough to let policy evolve without redesigning the application.
5. The model should remain deterministic where possible: same policy snapshot plus same inputs should lead to the same normal-flow decision.

## Success Criteria

The product should be considered successful when it can reliably:

- process the full reactive credit workflow end-to-end
- keep all major policy values editable by authorized admin users
- store per-parameter rationale and full review history
- support customer-versus-contractor scoring logic across the three agreed case scenarios
- preserve human final approval in normal flow rather than turning credit issuance into a fully autonomous approval engine
- support counter-offer behavior when requested terms exceed approved limits
- produce repeatable, auditable review-cycle outcomes

## Proactive-Ready Foundation

Although v1 does not implement proactive review workflows, it must preserve the data foundation needed to add them later. "Proactive-ready" in v1 means the system already stores:

- reusable party history
- imported outstanding exposure and overdue position
- realized post-decision outcomes
- approval-validity and expiry data

V1 does not need:

- proactive queues
- renewal screens
- periodic watchlist workflows

Further detail on lifecycle and policy logic appears in:

- [04-case-intake-and-commercial-structure.md](./04-case-intake-and-commercial-structure.md)
- [05-reactive-workflow-and-case-lifecycle.md](./05-reactive-workflow-and-case-lifecycle.md)
- [06-scoring-engine-and-policy-model.md](./06-scoring-engine-and-policy-model.md)
