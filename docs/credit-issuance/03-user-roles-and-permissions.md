# User Roles And Permissions

## Role Model

V1 uses fixed system roles, not an arbitrary role builder.

Allowed roles include:

- RM
- KAM
- Accounts
- BDO
- Ordinary Approver
- Board Member
- Founder/Admin

One user may hold multiple roles. Effective permissions are the union of assigned roles.

## Visibility Model

Default visibility is role-based and scoped.

| Role | Default Visibility |
| --- | --- |
| RM | Own cases only, plus curated RM-facing summaries and actions |
| KAM | Assigned cases and cases they own |
| Accounts | Cases and tasks where they are assigned or allowed by role |
| BDO | Cases and tasks where they are assigned or allowed by role |
| Ordinary Approver | Cases in approval rounds they participate in |
| Board Member | Full exception-review detail for board reviews they participate in |
| Founder/Admin | Full visibility across the system |

Branch/region supports visibility and reporting filters, but does not create separate scoring-policy branches in v1.

## Sensitive Data Restrictions

Sensitive financial inputs and related notes are restricted.

RM must not see:

- full internal scoring matrix
- raw sensitive financial inputs
- bank-statement findings
- internal-only evidence notes

Board members, KAM, relevant approvers, and allowed specialist roles may see full breakdowns where needed.

Sensitive section views must be logged.

## Permission Rules By Action

| Action | Allowed Roles |
| --- | --- |
| Create draft case | RM |
| Submit case | RM |
| Own case after submission | KAM |
| Edit intake after submission | KAM |
| Edit commercial fields after submission | Only through authorized reopen or selective unlock |
| Create candidate party | RM, KAM |
| Merge duplicate parties / manage aliases | Founder/Admin only |
| Create internal users | Founder/Admin |
| Publish policy versions | Founder/Admin with publish permission |
| Assign tasks | KAM, Founder/Admin where applicable |
| Reassign pending work | Founder/Admin |
| Initiate appeal | RM, KAM |
| Submit ambiguity case to board | KAM |
| Override terms through board review | Board members through formal workflow |
| Withdraw live case | RM, KAM, Founder/Admin |
| Reopen or selectively unlock case content | Authorized approver or Founder/Admin |

## Assignment Restrictions

Assignments are role-guarded:

- KAM or admin may assign a task only to users who hold an allowed role for that task.
- The same rule applies to ordinary approval assignment.
- KAM assigns work to specific individuals rather than sending work to a generic self-pick queue.
- Board review rosters are controlled by board configuration, not ad hoc assignment during an active round.

## Ordinary Approver Behavior

Ordinary approvers can:

- approve
- reject
- return for revision

They do not abstain in v1.

## Board Member Behavior

Board members can:

- approve
- reject
- abstain
- optionally leave comments

## RM-Facing Visibility

RM should see:

- own case status
- approved credit days or rejection status
- curated business-facing rationale summary
- next required action

RM should not see:

- full parameter-by-parameter internal scoring matrix
- sensitive financial inputs
- raw internal approval commentary

## Authentication And Access

V1 assumes every internal user has a unique email address.

Access pattern:

- admin creates the user account
- user completes password set or reset through the normal secure flow
- no requirement exists for Google Workspace SSO in v1
