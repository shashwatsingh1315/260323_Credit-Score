import { describe, expect, it } from 'vitest';
import {
  approvalSuccessRate,
  collectionRealisation,
  computeTranchePdcr,
  formatDaysVsPromised,
  outstandingExposure,
  type MetricCase,
} from './metrics';

describe('approvalSuccessRate', () => {
  it('counts only decided cases (approved vs rejected)', () => {
    const rows = [
      { status: 'Approved' },
      { status: 'Billing Active' },
      { status: 'Closed' },
      { status: 'Rejected' },
      { status: 'In Review' },
      { status: 'Awaiting Approval' },
      { status: 'Draft' },
    ];
    // 3 approved / (3 approved + 1 rejected) = 75%, in-flight cases ignored
    expect(approvalSuccessRate(rows)).toBe(75);
  });

  it('counts Accepted cases as approved so they are not dropped from the rate', () => {
    const rows = [
      { status: 'Accepted' },
      { status: 'Rejected' },
    ];
    // 1 approved (Accepted) / (1 approved + 1 rejected) = 50%
    expect(approvalSuccessRate(rows)).toBe(50);
  });

  it('returns null when nothing has been decided', () => {
    expect(approvalSuccessRate([{ status: 'In Review' }, { status: 'Draft' }])).toBeNull();
    expect(approvalSuccessRate([])).toBeNull();
  });
});

describe('outstandingExposure', () => {
  it('sums promised minus actual on billing-active and write-off-pending cases only', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Billing Active', promised_bill_amount: 1000, actual_bill_amount: 400 },
      { id: '2', status: 'Pending Write-Off Approval', promised_bill_amount: 500, actual_bill_amount: 0 },
      { id: '3', status: 'Closed', promised_bill_amount: 800, actual_bill_amount: 800 },
      { id: '4', status: 'Billing Active', promised_bill_amount: 100, actual_bill_amount: 300 },
    ];
    // 600 + 500 + 0 (overpaid case floored at zero)
    expect(outstandingExposure(rows)).toBe(1100);
  });

  it('falls back to decided_bill_amount when promised_bill_amount is null', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Billing Active', promised_bill_amount: null, decided_bill_amount: 1000, actual_bill_amount: 250 },
    ];
    expect(outstandingExposure(rows)).toBe(750);
  });

  it('falls back to bill_amount when both promised and decided are null', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Billing Active', promised_bill_amount: null, decided_bill_amount: null, bill_amount: 900, actual_bill_amount: 100 },
    ];
    expect(outstandingExposure(rows)).toBe(800);
  });

  it('floors at zero when actual exceeds the basis', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Pending Write-Off Approval', promised_bill_amount: 500, actual_bill_amount: 700 },
    ];
    expect(outstandingExposure(rows)).toBe(0);
  });

  it('excludes cases whose status is not outstanding', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Approved', promised_bill_amount: 1000, actual_bill_amount: 0 },
      { id: '2', status: 'Closed', decided_bill_amount: 1000, actual_bill_amount: 0 },
      { id: '3', status: 'Cancelled', bill_amount: 1000, actual_bill_amount: 0 },
      { id: '4', status: 'Billing Active', bill_amount: 300, actual_bill_amount: 0 },
    ];
    expect(outstandingExposure(rows)).toBe(300);
  });
});

describe('collectionRealisation', () => {
  it('measures collected over decided on Closed cases only', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Closed', decided_bill_amount: 1000, actual_bill_amount: 900 },
      { id: '2', status: 'Closed', decided_bill_amount: 1000, actual_bill_amount: 1100 },
    ];
    expect(collectionRealisation(rows)).toBe(100);
  });

  it('ignores partly collected Billing Active cases so they do not read as a loss', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Billing Active', decided_bill_amount: 1000, actual_bill_amount: 0 },
      { id: '2', status: 'Billing Active', decided_bill_amount: 1000, actual_bill_amount: 500 },
      { id: '3', status: 'Closed', decided_bill_amount: 1000, actual_bill_amount: 800 },
    ];
    expect(collectionRealisation(rows)).toBe(80);
  });

  it('ignores Cancelled cases and Closed cases with no collection', () => {
    const rows: MetricCase[] = [
      { id: '1', status: 'Cancelled', decided_bill_amount: 1000, actual_bill_amount: 0 },
      { id: '2', status: 'Closed', decided_bill_amount: 1000, actual_bill_amount: 0 },
    ];
    expect(collectionRealisation(rows)).toBeNull();
  });
});

describe('computeTranchePdcr', () => {
  const tranches = [{ type: 'percentage', value: 100, days_after_billing: 30 }];
  const base: MetricCase = {
    id: 'c1',
    status: 'Closed',
    billing_date: '2026-01-01',
    decided_bill_amount: 1000,
    proposed_tranches: tranches,
  };

  it('reports on-time payment and negative days-vs-promised when paid early', () => {
    const result = computeTranchePdcr([base], {
      c1: [{ amount: 1000, payment_date: '2026-01-21' }],
    });
    expect(result.countPDCR).toBe(100);
    expect(result.amountPDCR).toBe(100);
    expect(result.avgDaysVsPromised).toBeCloseTo(-10, 5);
  });

  it('reports late payment without capping the days ratio', () => {
    const result = computeTranchePdcr([base], {
      c1: [{ amount: 1000, payment_date: '2026-02-15' }],
    });
    expect(result.countPDCR).toBe(0);
    expect(result.amountPDCR).toBe(0);
    expect(result.avgDaysVsPromised).toBeCloseTo(15, 5);
  });

  it('returns nulls when there is no billed schedule', () => {
    const result = computeTranchePdcr([{ id: 'x', status: 'Billing Active' }], {});
    expect(result).toEqual({ countPDCR: null, amountPDCR: null, avgDaysVsPromised: null });
  });
});

describe('formatDaysVsPromised', () => {
  it('describes late, early and on-time averages', () => {
    expect(formatDaysVsPromised(12.4)).toBe('+12 days late on average');
    expect(formatDaysVsPromised(-3)).toBe('3 days early on average');
    expect(formatDaysVsPromised(0.2)).toBe('on time on average');
    expect(formatDaysVsPromised(null)).toBeNull();
  });
});
