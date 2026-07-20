/**
 * Shared product vocabulary (doctrine §5, §10, §13.1).
 *
 * One authoritative mapping from internal case status to:
 *  - macro lifecycle phase (for the progress rail and grouped filters)
 *  - plain-language meaning a business user can understand
 *  - semantic family (colour is reinforcement, never the only signal)
 *  - the owner and the one authoritative next action
 *
 * Screens must not invent their own status interpretations.
 */

export type SemanticFamily = 'neutral' | 'active' | 'waiting' | 'positive' | 'negative' | 'exception';

export type MacroPhase =
  | 'draft'
  | 'review'
  | 'decision'
  | 'approved'
  | 'accepted'
  | 'billing'
  | 'closed';

export interface StatusMeta {
  /** Plain-language label (may differ from the raw DB status). */
  label: string;
  phase: MacroPhase;
  family: SemanticFamily;
  /** What this state means to a business user. */
  meaning: string;
  /** Role that owns the next step. */
  ownerRole: string;
  /** The one authoritative next action in this state. */
  nextAction: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  'Draft': {
    label: 'Draft',
    phase: 'draft',
    family: 'neutral',
    meaning: 'Saved but not yet submitted for review.',
    ownerRole: 'rm',
    nextAction: 'Complete intake and submit for review',
  },
  'In Review': {
    label: 'In review',
    phase: 'review',
    family: 'active',
    meaning: 'Evidence tasks are being completed by the assigned owners.',
    ownerRole: 'kam',
    nextAction: 'Complete current stage tasks',
  },
  'Awaiting Input': {
    label: 'Waiting for input',
    phase: 'review',
    family: 'waiting',
    meaning: 'Progress is blocked by a named dependency.',
    ownerRole: 'kam',
    nextAction: 'Provide or chase the requested input',
  },
  'Awaiting Approval': {
    label: 'Awaiting decision',
    phase: 'decision',
    family: 'waiting',
    meaning: 'Evidence is complete; an authorized approver must decide.',
    ownerRole: 'ordinary_approver',
    nextAction: 'Review the decision brief and decide',
  },
  'Appealed': {
    label: 'Appeal / board review',
    phase: 'decision',
    family: 'exception',
    meaning: 'A rejected or ambiguous decision is under governed board review.',
    ownerRole: 'board_member',
    nextAction: 'Cast an independent board vote',
  },
  'Approved': {
    label: 'Approved — awaiting negotiation',
    phase: 'approved',
    family: 'positive',
    meaning: 'Terms are authorized. The customer has not yet accepted.',
    ownerRole: 'rm',
    nextAction: 'Negotiate with the customer and record accepted terms',
  },
  'Accepted': {
    label: 'Terms accepted',
    phase: 'accepted',
    family: 'positive',
    meaning: 'The customer accepted the terms. Ready for billing handoff.',
    ownerRole: 'kam',
    nextAction: 'Initiate billing and hand over to collections',
  },
  'Billing Active': {
    label: 'Billing active',
    phase: 'billing',
    family: 'active',
    meaning: 'Payments are expected and being collected against tranches.',
    ownerRole: 'kam',
    nextAction: 'Record collections against due tranches',
  },
  'Pending Write-Off Approval': {
    label: 'Write-off review',
    phase: 'billing',
    family: 'exception',
    meaning: 'Closure would leave a shortfall above the allowed threshold. Requires founder approval.',
    ownerRole: 'founder_admin',
    nextAction: 'Resolve the write-off decision',
  },
  'Closed': {
    label: 'Closed',
    phase: 'closed',
    family: 'positive',
    meaning: 'The case is complete.',
    ownerRole: '',
    nextAction: 'No further action',
  },
  'Rejected': {
    label: 'Rejected',
    phase: 'closed',
    family: 'negative',
    meaning: 'Credit was not authorized.',
    ownerRole: 'rm',
    nextAction: 'Appeal is available if new evidence exists',
  },
  'Cancelled': {
    label: 'Cancelled',
    phase: 'closed',
    family: 'negative',
    meaning: 'The order ended before payment under allowed conditions.',
    ownerRole: '',
    nextAction: 'No further action',
  },
  'Withdrawn': {
    label: 'Withdrawn',
    phase: 'closed',
    family: 'neutral',
    meaning: 'The originator ended the request.',
    ownerRole: '',
    nextAction: 'No further action',
  },
  'Expired': {
    label: 'Expired',
    phase: 'closed',
    family: 'neutral',
    meaning: 'Approval or case validity ended.',
    ownerRole: 'rm',
    nextAction: 'Start a new review cycle if the deal is still live',
  },
};

export function getStatusMeta(status: string | null | undefined): StatusMeta {
  return (
    STATUS_META[status ?? ''] ?? {
      label: status || 'Unknown',
      phase: 'review',
      family: 'neutral',
      meaning: 'State not recognized.',
      ownerRole: '',
      nextAction: 'Review the case',
    }
  );
}

export function getMacroPhase(status: string | null | undefined): MacroPhase {
  return getStatusMeta(status).phase;
}

/** Ordered nodes of the lifecycle progress rail. */
export const MACRO_RAIL: { key: MacroPhase; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'review', label: 'Review' },
  { key: 'decision', label: 'Decision' },
  { key: 'approved', label: 'Approved' },
  { key: 'accepted', label: 'Terms accepted' },
  { key: 'billing', label: 'Billing & collections' },
  { key: 'closed', label: 'Closed' },
];

/** Phase groups for the case index — users think in phases, not 14 statuses. */
export const PHASE_FILTERS: { key: string; label: string; statuses: string[] }[] = [
  { key: '', label: 'All', statuses: [] },
  { key: 'draft', label: 'Drafts', statuses: ['Draft'] },
  { key: 'review', label: 'In review', statuses: ['In Review'] },
  { key: 'waiting', label: 'Waiting on someone', statuses: ['Awaiting Input'] },
  { key: 'decision', label: 'Awaiting decision', statuses: ['Awaiting Approval', 'Appealed'] },
  { key: 'approved', label: 'Approved / negotiation', statuses: ['Approved', 'Accepted'] },
  { key: 'billing', label: 'Billing & collections', statuses: ['Billing Active', 'Pending Write-Off Approval'] },
  { key: 'closed', label: 'Closed / declined', statuses: ['Closed', 'Rejected', 'Cancelled', 'Withdrawn', 'Expired'] },
];

/** Layers of truth (doctrine Principle 4) — always label which layer a value belongs to. */
export const TERMS_LABELS = {
  requested: 'Requested terms',
  recommended: 'Policy recommendation',
  approved: 'Approved terms',
  override: 'Override terms',
  accepted: 'Accepted terms',
  realized: 'Realized',
} as const;

/** Operational acronyms must never appear without an available definition (doctrine §7.6). */
export const GLOSSARY: Record<string, string> = {
  PTP: 'Promise to Pay — a dated commitment recorded by the customer to pay an overdue amount.',
  DPD: 'Days Past Due — how many days a tranche has remained unpaid after its due date.',
  PDCR: 'Promised Day Collection Rate — share of promised money collected by the promised date.',
  Exposure: 'The outstanding amount of money currently at risk for a party.',
  SLA: 'Service Level Agreement — the time expectation for completing a work item.',
  'Bill amount': 'The gross commercial bill value presented at intake.',
  'Decided amount': 'The final commercial amount used as the margin baseline.',
  'Promised amount': 'The amount the customer commits to pay; collections measure against it.',
  'Collected amount': 'The sum of valid payment entries received.',
  Outstanding: 'Promised amount minus valid collected amount, adjusted by approved credit notes.',
};

/** Scenario values → plain "Billed to / payment from" language. */
export const SCENARIO_LABELS: Record<string, { label: string; billedTo: string; pays: string }> = {
  customer_name_customer_pays: {
    label: 'Customer name, customer pays',
    billedTo: 'Customer',
    pays: 'Customer',
  },
  customer_name_contractor_pays: {
    label: 'Customer name, contractor pays',
    billedTo: 'Customer',
    pays: 'Contractor',
  },
  contractor_name_contractor_pays: {
    label: 'Contractor name, contractor pays',
    billedTo: 'Contractor',
    pays: 'Contractor',
  },
};

export function describeScenario(scenario: string | null | undefined): string {
  const s = SCENARIO_LABELS[scenario ?? ''];
  if (!s) return scenario?.replace(/_/g, ' ') || '—';
  return `Billed to ${s.billedTo} · payment from ${s.pays}`;
}

/** Role → display label. */
export const ROLE_LABELS: Record<string, string> = {
  rm: 'Relationship Manager',
  kam: 'Key Account Manager',
  accounts: 'Accounts',
  bdo: 'BDO',
  ordinary_approver: 'Approver',
  board_member: 'Board Member',
  founder_admin: 'Founder / Admin',
  viewer: 'Viewer',
};
