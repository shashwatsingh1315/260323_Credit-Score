/**
 * Pure portfolio-metric formulas shared by the home page and any other
 * surface that reports the same numbers. No I/O here — callers fetch rows
 * and pass them in, so every formula is unit-testable.
 */

/** Window used for decision-based metrics (approval success). */
export const METRIC_PERIOD_DAYS = 90;

/** 'Accepted' = approved, customer accepted terms, not yet billed. It is still an approval. */
export const APPROVED_STATUSES: readonly string[] = ['Approved', 'Accepted', 'Billing Active', 'Pending Write-Off Approval', 'Closed'];
export const REJECTED_STATUSES: readonly string[] = ['Rejected'];
export const OUTSTANDING_STATUSES: readonly string[] = ['Billing Active', 'Pending Write-Off Approval'];
/** Statuses that carry a bill and therefore take part in collection metrics. */
export const PORTFOLIO_STATUSES: readonly string[] = [...OUTSTANDING_STATUSES, 'Closed', 'Cancelled'];

export type MetricCase = {
  id: string;
  status: string;
  billing_date?: string | null;
  decided_bill_amount?: number | null;
  promised_bill_amount?: number | null;
  bill_amount?: number | null;
  actual_bill_amount?: number | null;
  proposed_tranches?: unknown;
};

export type Repayment = { amount: number; payment_date: string };

/** One entry of a case's proposed_tranches JSON (percentage or fixed amount). */
type TrancheDef = { type?: string; value: number; days_after_billing?: number | null };

/**
 * Approval success = approved / (approved + rejected), over decided cases only.
 * In-flight cases (In Review, Awaiting Approval, Draft) are not counted.
 * Returns null when nothing has been decided, so the UI shows "No data yet"
 * rather than an implied 0%.
 */
export function approvalSuccessRate(rows: { status: string }[]): number | null {
  const approved = rows.filter((r) => APPROVED_STATUSES.includes(r.status)).length;
  const rejected = rows.filter((r) => REJECTED_STATUSES.includes(r.status)).length;
  const decided = approved + rejected;
  return decided > 0 ? (approved / decided) * 100 : null;
}

/**
 * Outstanding exposure = billed basis minus actual on cases still being billed,
 * floored at zero per case. The basis is promised_bill_amount first (approved
 * credit notes already reduce it on approval), then decided_bill_amount, then
 * bill_amount. This matches the estimated-schedule fallback used for the
 * overdue banner, so the two figures agree on legacy/imported cases where
 * promised_bill_amount is null.
 */
export function outstandingExposure(rows: MetricCase[]): number {
  return rows
    .filter((c) => OUTSTANDING_STATUSES.includes(c.status))
    .reduce((sum, c) => {
      const basis = c.promised_bill_amount || c.decided_bill_amount || c.bill_amount || 0;
      return sum + Math.max(0, basis - (c.actual_bill_amount ?? 0));
    }, 0);
}

/**
 * Collection realisation = collected ÷ decided bill amount, as a percentage.
 * Only Closed cases with a recorded collection (actual > 0) and a decided
 * amount count. Billing Active (partly collected), Cancelled and zero-collection
 * cases are excluded so in-progress collection is not read as a loss.
 */
export function collectionRealisation(rows: MetricCase[]): number | null {
  const closed = rows.filter((c) =>
    c.status === 'Closed' && (c.decided_bill_amount ?? 0) > 0 && (c.actual_bill_amount ?? 0) > 0,
  );
  const decided = closed.reduce((s, c) => s + (c.decided_bill_amount ?? 0), 0);
  if (closed.length === 0 || decided === 0) return null;
  const collected = closed.reduce((s, c) => s + (c.actual_bill_amount ?? 0), 0);
  return (collected / decided) * 100;
}

export type TranchePdcr = {
  /** Share of tranches paid in full by their due date. */
  countPDCR: number | null;
  /** Share of tranche amount paid by its due date. */
  amountPDCR: number | null;
  /**
   * Amount-weighted average of (actual days to pay − promised days).
   * Positive = late, negative = early. Not capped, so lateness stays visible.
   */
  avgDaysVsPromised: number | null;
};

const DAY_MS = 1000 * 3600 * 24;

/**
 * Walks each case's proposed tranche schedule against its repayments in date
 * order (FIFO allocation) and measures on-time payment.
 */
export function computeTranchePdcr(
  cases: MetricCase[],
  repaymentsByCaseId: Record<string, Repayment[]>,
): TranchePdcr {
  let totalTranches = 0;
  let tranchesPaidOnTime = 0;
  let totalAmount = 0;
  let amountPaidOnTime = 0;
  let totalWeight = 0;
  let weightedDaysDelta = 0;

  for (const c of cases) {
    if (!c.billing_date || !c.proposed_tranches || !c.decided_bill_amount) continue;

    const billingDate = new Date(c.billing_date);
    const billAmt = c.decided_bill_amount;
    const repayments = repaymentsByCaseId[c.id] ?? [];

    const trancheSchedule = (c.proposed_tranches as TrancheDef[]).map((t) => {
      const amt = t.type === 'percentage'
        ? Math.round((t.value / 100) * billAmt)
        : Math.round(t.value);
      const due = new Date(billingDate);
      due.setDate(due.getDate() + (t.days_after_billing ?? 0));
      return { expectedAmount: amt, dueDate: due, proposedDays: t.days_after_billing ?? 0 };
    });

    const sortedRepayments = [...repayments].sort(
      (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(),
    );
    let repIdx = 0;
    let repRemaining = sortedRepayments.length > 0 ? sortedRepayments[0].amount : 0;

    for (const tranche of trancheSchedule) {
      let trancheRemaining = tranche.expectedAmount;
      let lastPaymentDateForTranche: Date | null = null;

      while (trancheRemaining > 0 && repIdx < sortedRepayments.length) {
        const curRep = sortedRepayments[repIdx];
        const fillAmount = Math.min(trancheRemaining, repRemaining);

        trancheRemaining -= fillAmount;
        repRemaining -= fillAmount;
        lastPaymentDateForTranche = new Date(curRep.payment_date);

        if (repRemaining <= 0) {
          repIdx++;
          if (repIdx < sortedRepayments.length) {
            repRemaining = sortedRepayments[repIdx].amount;
          }
        }
      }

      totalTranches++;
      totalAmount += tranche.expectedAmount;
      const fill = tranche.expectedAmount - trancheRemaining;

      if (fill >= tranche.expectedAmount && lastPaymentDateForTranche && lastPaymentDateForTranche <= tranche.dueDate) {
        tranchesPaidOnTime++;
      }
      if (lastPaymentDateForTranche && lastPaymentDateForTranche <= tranche.dueDate) {
        amountPaidOnTime += fill;
      }

      if (fill > 0 && lastPaymentDateForTranche) {
        const actualDays = (lastPaymentDateForTranche.getTime() - billingDate.getTime()) / DAY_MS;
        if (actualDays > 0 && tranche.proposedDays > 0) {
          const weight = tranche.expectedAmount;
          totalWeight += weight;
          weightedDaysDelta += (actualDays - tranche.proposedDays) * weight;
        }
      }
    }
  }

  return {
    countPDCR: totalTranches > 0 ? (tranchesPaidOnTime / totalTranches) * 100 : null,
    amountPDCR: totalAmount > 0 ? (amountPaidOnTime / totalAmount) * 100 : null,
    avgDaysVsPromised: totalWeight > 0 ? weightedDaysDelta / totalWeight : null,
  };
}

/** "+12 days late on average", "3 days early on average", or "on time on average". */
export function formatDaysVsPromised(days: number | null): string | null {
  if (days == null) return null;
  const rounded = Math.round(days);
  if (rounded > 0) return `+${rounded} days late on average`;
  if (rounded < 0) return `${-rounded} days early on average`;
  return 'on time on average';
}
