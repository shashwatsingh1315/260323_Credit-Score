"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Trash2, UserPlus } from 'lucide-react';
import { handleNewCase, fetchParties, fetchEnumerations, fetchRmIntakeTasks, fetchActiveRoutingThresholds, fetchKams, fetchPartyDetails, fetchCityCodes, generateSiteIdPreview } from './actions';
import { PartyDialog } from '@/components/admin/PartyDialog';
import { cn } from '@/lib/utils';
import { SCENARIO_LABELS } from '@/lib/vocabulary';
import { evaluateRequiredStage } from '@/utils/routing';
import { formatPolicyOptionLabel, parseRubricGuidance } from '@/lib/format';

interface Tranche {
  type: 'amount' | 'percentage';
  value: number;
  days_after_billing: number;
}

const SCENARIOS = [
  { value: 'customer_name_customer_pays', label: 'Customer Name, Customer Pays' },
  { value: 'customer_name_contractor_pays', label: 'Customer Name, Contractor Pays' },
  { value: 'contractor_name_contractor_pays', label: 'Contractor Name, Contractor Pays' },
];

/* Shared token classes (page.module.css retired — semantic tokens only) */
const inputCls = 'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none';
const groupCls = 'mb-5 flex flex-col gap-2';
const labelCls = 'text-xs font-medium text-muted-foreground';
const actionsCls = 'mt-6 flex flex-wrap items-center justify-end gap-3';
const errorCls = 'rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive';

export default function NewCaseForm({
  initialParties,
  kams,
  routingThresholds,
  creditReasons,
  cityCodes,
  initialSiteDate,
  gradeScale = []
}: {
  initialParties: any[], kams: any[], routingThresholds: any[], creditReasons: any[], cityCodes: any[], initialSiteDate: string,
  gradeScale?: { grade_value: number; grade_label: string; description?: string }[]
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [parties, setParties] = useState<any[]>(initialParties);
  const [kamUserId, setKamUserId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [missingTaskIds, setMissingTaskIds] = useState<string[]>([]);

  // Unsaved-work protection (doctrine Principle 11): warn before abandoning a
  // partially-filled intake; submission clears the flag.
  const submittedRef = useRef(false);
  const hasContentRef = useRef(false);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasContentRef.current && !submittedRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [partyTypeForDialog, setPartyTypeForDialog] = useState<'customer' | 'contractor'>('customer');
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [contractorDetails, setContractorDetails] = useState<any>(null);
  /** Provenance for answers reused from party records (doctrine Principle 12):
   *  reused values must be visibly marked, never silently presented as new. */
  const [reusedParams, setReusedParams] = useState<Record<string, { partyName: string; capturedAt?: string }>>({});

  // Site Generation State
  const [siteAddress, setSiteAddress] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [generatedSiteId, setGeneratedSiteId] = useState('');
  const [siteDate] = useState(initialSiteDate);

  // Form state
  const [scenario, setScenario] = useState('customer_name_customer_pays');
  const [customerPartyId, setCustomerPartyId] = useState('');
  const [contractorPartyId, setContractorPartyId] = useState('');

  const refreshParties = async (newParty?: any) => {
    const p = await fetchParties();
    setParties(p);
    if (newParty?.id) {
      if (partyTypeForDialog === 'customer') {
        setCustomerPartyId(newParty.id);
      } else {
        setContractorPartyId(newParty.id);
      }
    }
  };

  const [billAmount, setBillAmount] = useState(0);
  const [creditPercentage, setCreditPercentage] = useState(0);
  const requestedExposure = Math.round((billAmount * creditPercentage / 100) * 100) / 100;
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [isLoadingContractor, setIsLoadingContractor] = useState(false);

  const updateCreditPercentage = (value: number) => {
    setCreditPercentage(Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);
  };

  // Auto-fetch party details on selection (M1)
  const handleCustomerSelect = async (id: string) => {
    setCustomerPartyId(id);
    if (id) {
      setIsLoadingCustomer(true);
      const details = await fetchPartyDetails(id);
      setCustomerDetails(details);
      
      if (details?.savedParams && details.savedParams.length > 0) {
        setRmTaskAnswers(prev => {
          const next = { ...prev };
          details.savedParams.forEach((sp: any) => {
             if (!next[sp.parameter_id]) {
               next[sp.parameter_id] = { grade_value: sp.grade_value, raw_input_value: sp.raw_input_value };
             }
          });
          return next;
        });
        setReusedParams(prev => {
          const next = { ...prev };
          details.savedParams.forEach((sp: any) => {
            if (!next[sp.parameter_id]) next[sp.parameter_id] = { partyName: details.legal_name, capturedAt: sp.captured_at };
          });
          return next;
        });
      }
      setIsLoadingCustomer(false);
    } else {
      setCustomerDetails(null);
    }
  };

  const handleContractorSelect = async (id: string) => {
    setContractorPartyId(id);
    if (id) {
      setIsLoadingContractor(true);
      const details = await fetchPartyDetails(id);
      setContractorDetails(details);

      if (details?.savedParams && details.savedParams.length > 0) {
        setRmTaskAnswers(prev => {
          const next = { ...prev };
          details.savedParams.forEach((sp: any) => {
             if (!next[sp.parameter_id]) {
               next[sp.parameter_id] = { grade_value: sp.grade_value, raw_input_value: sp.raw_input_value };
             }
          });
          return next;
        });
        setReusedParams(prev => {
          const next = { ...prev };
          details.savedParams.forEach((sp: any) => {
            if (!next[sp.parameter_id]) next[sp.parameter_id] = { partyName: details.legal_name, capturedAt: sp.captured_at };
          });
          return next;
        });
      }
      setIsLoadingContractor(false);
    } else {
      setContractorDetails(null);
    }
  };
  const [tranches, setTranches] = useState<Tranche[]>([
    { type: 'percentage', value: 100, days_after_billing: 30 },
  ]);
  const [justification, setJustification] = useState('');
  const [rmTasks, setRmTasks] = useState<any[]>([]);
  const [rmTaskAnswers, setRmTaskAnswers] = useState<Record<string, any>>({});

  const needsContractor = scenario !== 'customer_name_customer_pays';
  const needsCustomer = scenario !== 'contractor_name_contractor_pays';

  useEffect(() => {
    hasContentRef.current = !!(customerPartyId || contractorPartyId || billAmount > 0 || requestedExposure > 0 || siteAddress || justification);
  }, [customerPartyId, contractorPartyId, billAmount, requestedExposure, siteAddress, justification]);

  // Fetch RM tasks whenever scenario changes
  useEffect(() => {
    async function fetchTasks() {
      const tasks = await fetchRmIntakeTasks(scenario);
      setRmTasks(tasks);
    }
    fetchTasks();
  }, [scenario]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (cityCode) {
        const id = await generateSiteIdPreview(cityCode, siteDate);
        setGeneratedSiteId(id || '');
      } else {
        setGeneratedSiteId('');
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [cityCode, siteDate]);

  // Composite credit day calculation
  const compositeDays = useCallback(() => {
    if (requestedExposure <= 0 || tranches.length === 0) return 0;
    let weightedDays = 0;
    let totalWeight = 0;
    for (const t of tranches) {
      const w = t.type === 'percentage' ? t.value / 100 : t.value / requestedExposure;
      totalWeight += w;
      weightedDays += w * t.days_after_billing;
    }
    if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.001) {
      weightedDays = weightedDays / totalWeight;
    }
    return Math.round(weightedDays * 100) / 100;
  }, [tranches, requestedExposure]);

  // The repayment schedule covers only the portion requested on credit.
  const trancheTotal = tranches.reduce((sum, t) => {
    return sum + (t.type === 'percentage' ? (t.value / 100) * requestedExposure : t.value);
  }, 0);
  const tranchesReconcile = requestedExposure > 0 ? Math.abs(trancheTotal - requestedExposure) < 0.01 : true;

  const addTranche = () => setTranches([...tranches, { type: 'amount', value: 0, days_after_billing: 0 }]);
  const removeTranche = (idx: number) => setTranches(tranches.filter((_, i) => i !== idx));
  const updateTranche = (idx: number, field: string, value: any) => {
    const updated = [...tranches];
    (updated[idx] as any)[field] = value;
    setTranches(updated);
  };

  const handleTaskAnswerChange = (taskId: string, field: 'grade_value' | 'raw_input_value' | 'reason', value: any) => {
    // Editing a reused answer confirms it as the RM's own — drop the provenance marker.
    if (field !== 'reason' && reusedParams[taskId]) {
      setReusedParams(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
    setRmTaskAnswers(prev => {
      const updated = { ...prev };
      const taskAnswer = { ...(updated[taskId] || {}) };
      taskAnswer[field] = value;

      // Auto-band mapping calculation
      const taskDef = rmTasks.find(t => t.id === taskId);
      if (field === 'raw_input_value' && taskDef?.auto_band_config) {
        let mappedGrade: number | undefined = undefined;

        if (taskDef.input_type === 'numeric' && taskDef.auto_band_config.bands) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            const band = taskDef.auto_band_config.bands.find((b: any) => numValue >= b.min && numValue <= b.max);
            if (band) mappedGrade = band.grade;
          }
        } else if (taskDef.input_type === 'date' && taskDef.auto_band_config.bands) {
          const dateVal = new Date(value);
          const now = new Date();
          const daysDiff = Math.floor((dateVal.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (!isNaN(daysDiff)) {
            const band = taskDef.auto_band_config.bands.find((b: any) => daysDiff >= b.min && daysDiff <= b.max);
            if (band) mappedGrade = band.grade;
          }
        } else if ((taskDef.input_type === 'link_list' || taskDef.input_type === 'yes_no') && taskDef.auto_band_config.mappings) {
          const mapping = taskDef.auto_band_config.mappings.find((m: any) => m.value.toLowerCase() === String(value).toLowerCase());
          if (mapping) mappedGrade = mapping.grade;
        }

        if (mappedGrade !== undefined) {
          taskAnswer.grade_value = mappedGrade;
        } else {
           taskAnswer.grade_value = undefined; // clear if no mapping found
        }
      }

      updated[taskId] = taskAnswer;
      return updated;
    });
  };

  const handleSubmit = async (action: 'draft' | 'submit') => {
    setError('');
    setMissingTaskIds([]);
    setSubmitting(true);

    if (action === 'submit' && !kamUserId) {
      setError('Select a KAM owner before submitting for review. You can save a draft without one.');
      setSubmitting(false);
      return;
    }

    if (action === 'submit' && requestedExposure > 0 && !tranchesReconcile) {
      setError('Tranches must reconcile exactly to the expected credit exposure before submission.');
      setSubmitting(false);
      return;
    }

    // Check if required tasks are answered before submitting
    if (action === 'submit') {
      // A task is considered incomplete only if BOTH raw_input_value AND grade_value are missing
      // (grade_select tasks only fill grade_value; numeric/text tasks only fill raw_input_value)
      const missingTasks = rmTasks.filter(t => {
        if (!t.is_required) return false;
        const ans = rmTaskAnswers[t.id];
        if (!ans) return true;
        const hasGrade = ans.grade_value != null && ans.grade_value !== '';
        const hasRaw = ans.raw_input_value != null && String(ans.raw_input_value).trim() !== '';
        return !hasGrade && !hasRaw;
      });
      if (missingTasks.length > 0) {
        setError('Answer the required intake questions before submitting.');
        setMissingTaskIds(missingTasks.map((task) => task.id));
        setStep(4);
        setSubmitting(false);
        return;
      }
    }

    const fd = new FormData();
    fd.set('caseScenario', scenario);
    fd.set('customerPartyId', customerPartyId);
    fd.set('contractorPartyId', contractorPartyId);
    fd.set('billAmount', billAmount.toString());
    fd.set('requestedExposure', requestedExposure.toString());
    fd.set('tranches', JSON.stringify(tranches));
    if (kamUserId) fd.set('kamUserId', kamUserId);
    fd.set('justification', justification);
    fd.set('rmTaskAnswers', JSON.stringify(rmTaskAnswers));
    fd.set('action', action);
    fd.set('siteAddress', siteAddress);
    fd.set('cityCode', cityCode);
    fd.set('generatedSiteId', generatedSiteId);

    try {
      submittedRef.current = true;
      const result = await handleNewCase(fd);
      if (result?.error) {
        submittedRef.current = false;
        setError(result.error);
        setSubmitting(false);
      }
    } catch (err: any) {
      submittedRef.current = false;
      const isSanitizedServerError = typeof err?.message === 'string' && err.message.includes('Server Components render');
      const reference = typeof err?.digest === 'string' ? ` Reference: ${err.digest}.` : '';
      setError(isSanitizedServerError
        ? `An unexpected server error prevented the case from being created.${reference} Please share the reference with support.`
        : err?.message || 'Failed to create case.');
      setSubmitting(false);
    }
  };

  /** Save progress from any step — submission, not saving, enforces readiness. */
  const saveDraftButton = (
    <button type="button" className="btn-secondary" onClick={() => handleSubmit('draft')} disabled={submitting}>
      {submitting ? 'Saving…' : 'Save draft & exit'}
    </button>
  );

  const focusTask = (taskId: string) => {
    const field = document.getElementById(`intake-task-${taskId}`);
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus({ preventScroll: true });
  };
  const errorAlert = error ? (
    <div className={errorCls} role="alert">
      <p>{error}</p>
      {missingTaskIds.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {missingTaskIds.map((taskId) => <li key={taskId}><button type="button" className="underline" onClick={() => focusTask(taskId)}>{rmTasks.find((task) => task.id === taskId)?.name || 'Required question'}</button></li>)}
        </ul>
      )}
    </div>
  ) : null;

  const canGoNext = (currentStep: number) => {
    if (currentStep === 1) {
       return (needsCustomer ? !!customerPartyId : true) && 
              (needsContractor ? !!contractorPartyId : true) && 
              !!scenario;
    }
    if (currentStep === 2) {
       return billAmount > 0 && requestedExposure > 0 && requestedExposure <= billAmount && tranchesReconcile &&
              (() => {
                const activeDetails = scenario.startsWith('customer') ? customerDetails : contractorDetails;
                const creditLine = activeDetails?.credit_line_amount;
                return !(creditLine !== null && creditLine !== undefined && requestedExposure > creditLine);
              })();
    }
    if (currentStep === 3) return !!cityCode && !!siteAddress.trim() && justification.trim().length > 0;
    return true;
  };

  const requiredStage = evaluateRequiredStage(routingThresholds, {
    exposure: requestedExposure,
    scenario,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Cases</span>
          <ChevronRight size={16} />
          <span className="font-medium text-foreground">New Intake</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">New Credit Case</h1>
        <p className="text-sm text-muted-foreground">Create a draft or submit a case for review.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Semantic stepper: keyboard operable, current step announced (Principle 15) */}
        <div className="flex flex-row gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0" role="group" aria-label="Intake steps">
          {['Scenario & parties', 'Commercial ask', 'Site & handoff', 'Questions & review'].map((label, i) => {
            const stepNum = i + 1;
            const isAccessible = stepNum <= step || (stepNum === step + 1 && canGoNext(step));
            return (
              <button
                key={i}
                type="button"
                className={cn(
                  'flex w-auto shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-muted lg:w-full',
                  step === stepNum && 'bg-muted',
                  !isAccessible && 'pointer-events-none opacity-40'
                )}
                onClick={() => isAccessible && setStep(stepNum)}
                aria-current={step === stepNum ? 'step' : undefined}
                disabled={!isAccessible}
              >
                <div
                  className={cn(
                    'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-muted-foreground',
                    step === stepNum && 'border-primary bg-primary text-primary-foreground',
                    step > stepNum && 'border-success/25 bg-success/15 text-success'
                  )}
                  aria-hidden="true"
                >
                  {step > stepNum ? '✓' : stepNum}
                </div>
                <div className="text-sm font-medium text-foreground">{label}</div>
              </button>
            );
          })}
        </div>

        <div className="card lg:p-8">
          {/* Step 1: Scenario & Parties */}
          {step === 1 && (
            <div className="flex flex-col">
              <h2 className="mb-1 text-lg font-semibold tracking-tight">Case Scenario & Parties</h2>
              <p className="mb-6 text-xs text-muted-foreground">Select the billing/payment scenario and link relevant parties.</p>

              <div className={groupCls}>
                <label htmlFor="case-scenario" className={labelCls}>Case Scenario *</label>
                <select id="case-scenario" value={scenario} onChange={e => setScenario(e.target.value)} className={inputCls}>
                  {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">
                  Billed to <strong>{SCENARIO_LABELS[scenario]?.billedTo}</strong> · payment expected from <strong>{SCENARIO_LABELS[scenario]?.pays}</strong>
                </p>
              </div>

              {needsCustomer && (
                <div className={groupCls}>
                  <div className="flex justify-between items-center mb-1">
                    <label className={labelCls}>Customer Party *</label>
                    <button
                      type="button"
                      onClick={() => { setPartyTypeForDialog('customer'); setPartyDialogOpen(true); }}
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                    >
                      <UserPlus size={12} /> Add New
                    </button>
                  </div>
                  <select value={customerPartyId} onChange={e => handleCustomerSelect(e.target.value)} className={inputCls} disabled={isLoadingCustomer}>
                    <option value="">{isLoadingCustomer ? 'Loading details...' : '-- Select Customer --'}</option>
                    {parties
                      .filter(p => !p.party_type || p.party_type === 'customer' || p.party_type === 'both')
                      .map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.customer_code ? `(${p.customer_code})` : ''}</option>)}
                  </select>
                  {customerDetails && (
                    <div className="mt-2 p-3 rounded-md bg-muted/60 border border-border text-xs space-y-1 text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Industry:</span> {customerDetails.industry_category || '—'}</p>
                      {customerDetails.credit_line_amount !== null && customerDetails.credit_line_amount !== undefined && (
                        <p><span className="font-semibold text-warning">Credit Limit:</span> ₹{customerDetails.credit_line_amount.toLocaleString('en-IN')}</p>
                      )}
                      <p>
                        <span className="font-semibold text-foreground">Current outstanding:</span>{' '}
                        {customerDetails.currentExposure
                          ? <>₹{Number(customerDetails.currentExposure.outstanding_amount || 0).toLocaleString('en-IN')} <span className="text-muted-foreground">(as of {new Date(customerDetails.currentExposure.data_as_of).toLocaleDateString('en-IN')})</span></>
                          : <span className="italic">No exposure data imported</span>}
                      </p>
                      {customerDetails.address && <p><span className="font-semibold text-foreground">Location:</span> {customerDetails.address}</p>}
                      {customerDetails.lastCase && (
                        <p><span className="font-semibold text-foreground">Last case site value:</span> ₹{customerDetails.lastCase.bill_amount?.toLocaleString('en-IN')} · {customerDetails.lastCase.composite_credit_days}d credit</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {needsContractor && (
                <div className={groupCls}>
                  <div className="flex justify-between items-center mb-1">
                    <label className={labelCls}>Contractor / Influencer Party *</label>
                    <button
                      type="button"
                      onClick={() => { setPartyTypeForDialog('contractor'); setPartyDialogOpen(true); }}
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                    >
                      <UserPlus size={12} /> Add New
                    </button>
                  </div>
                  <select value={contractorPartyId} onChange={e => handleContractorSelect(e.target.value)} className={inputCls} disabled={isLoadingContractor}>
                    <option value="">{isLoadingContractor ? 'Loading details...' : '-- Select Influencer --'}</option>
                    {parties
                      .filter(p => p.party_type === 'influencer' || p.party_type === 'both' || p.party_type === 'contractor')
                      .map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.influencer_subtype ? `[${p.influencer_subtype}]` : ''}</option>)}
                  </select>
                  {contractorDetails && (
                    <div className="mt-2 p-3 rounded-md bg-muted/60 border border-border text-xs space-y-1 text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Sub-type:</span> {contractorDetails.influencer_subtype || '—'}</p>
                      {contractorDetails.credit_line_amount !== null && contractorDetails.credit_line_amount !== undefined && (
                        <p><span className="font-semibold text-warning">Credit Limit:</span> ₹{contractorDetails.credit_line_amount.toLocaleString('en-IN')}</p>
                      )}
                      <p>
                        <span className="font-semibold text-foreground">Current outstanding:</span>{' '}
                        {contractorDetails.currentExposure
                          ? <>₹{Number(contractorDetails.currentExposure.outstanding_amount || 0).toLocaleString('en-IN')} <span className="text-muted-foreground">(as of {new Date(contractorDetails.currentExposure.data_as_of).toLocaleDateString('en-IN')})</span></>
                          : <span className="italic">No exposure data imported</span>}
                      </p>
                      {contractorDetails.address && <p><span className="font-semibold text-foreground">Location:</span> {contractorDetails.address}</p>}
                      {contractorDetails.lastCase && (
                        <p><span className="font-semibold text-foreground">Last case site value:</span> ₹{contractorDetails.lastCase.bill_amount?.toLocaleString('en-IN')} · {contractorDetails.lastCase.composite_credit_days}d credit</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {errorAlert}
              <div className={actionsCls}>
                {saveDraftButton}
                <button type="button" className="btn-primary" onClick={() => setStep(2)} disabled={!canGoNext(1)}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 2: Tranche Builder */}
          {step === 2 && (
            <div className="flex flex-col">
              <h2 className="mb-1 text-lg font-semibold tracking-tight">Commercial ask</h2>
              <p className="mb-6 text-xs text-muted-foreground">Set the total site value, choose how much is expected on credit, and define the repayment schedule.</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={groupCls}>
                  <label className={labelCls}>Total Site Value (₹) *</label>
                  <input type="number" value={billAmount || ''} onChange={e => setBillAmount(parseFloat(e.target.value) || 0)} className={inputCls} placeholder="0" required />
                </div>
                <div className={groupCls}>
                  <div className="flex justify-between items-center">
                    <label htmlFor="credit-percentage" className={labelCls}>Expected Credit Exposure (%) *</label>
                    <span className="text-xs font-semibold tabular-nums text-primary">
                      ₹{requestedExposure.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-tiny text-muted-foreground">Percentage of the Total Site Value requested on credit.</p>
                  <div className="flex items-center gap-3">
                    <input
                      id="credit-percentage"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={creditPercentage}
                      onChange={e => updateCreditPercentage(Number(e.target.value))}
                      className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
                      aria-valuetext={`${creditPercentage}% credit, ₹${requestedExposure.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    />
                    <div className="relative w-24 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={creditPercentage || ''}
                        onChange={e => updateCreditPercentage(Number(e.target.value))}
                        className={cn(inputCls, 'pr-8 text-right tabular-nums')}
                        placeholder="0"
                        aria-label="Expected credit exposure percentage"
                        required
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-tiny text-muted-foreground" aria-hidden="true">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                  {(() => {
                    const creditLine = (scenario.startsWith('customer') ? customerDetails : contractorDetails)?.credit_line_amount;
                    return creditLine != null && requestedExposure > creditLine
                      ? <p className="text-tiny font-medium text-destructive">Exposure exceeds the configured credit limit of ₹{creditLine.toLocaleString('en-IN')}.</p>
                      : null;
                  })()}
                </div>
              </div>

              <div className="mb-3 mt-2">
                <h3 className="text-sm font-semibold">Credit repayment schedule</h3>
                <p className="mt-0.5 text-tiny text-muted-foreground">Allocate only the expected credit exposure of ₹{requestedExposure.toLocaleString('en-IN', { maximumFractionDigits: 2 })}; the remaining site value is not financed.</p>
              </div>

              <div className="mb-2 hidden grid-cols-[1fr_1fr_1fr_40px] gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                <span>Type</span><span>Value</span><span>Days After Billing</span><span></span>
              </div>
              {tranches.map((t, i) => (
                <div key={i} className="mb-2 grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_40px] sm:border-0 sm:p-0">
                  <select aria-label={`Tranche ${i + 1} type`} value={t.type} onChange={e => updateTranche(i, 'type', e.target.value)} className={inputCls}>
                    <option value="amount">Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                  <input aria-label={`Tranche ${i + 1} value`} type="number" value={t.value || ''} onChange={e => updateTranche(i, 'value', parseFloat(e.target.value) || 0)} className={inputCls} placeholder="0" />
                  <input aria-label={`Tranche ${i + 1} days after billing`} type="number" value={t.days_after_billing || ''} onChange={e => updateTranche(i, 'days_after_billing', parseInt(e.target.value) || 0)} className={inputCls} placeholder="0" />
                  <button type="button" aria-label={`Remove tranche ${i + 1}`} onClick={() => removeTranche(i)} className="flex min-h-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30 sm:min-h-0" disabled={tranches.length === 1}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}

              <button type="button" onClick={addTranche} className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-ring hover:text-foreground">
                <Plus size={16} /> Add Tranche
              </button>

              <div className="mt-6 flex flex-col gap-2 rounded-lg bg-muted p-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tranche Total:</span>
                  <span className={cn('font-semibold tabular-nums', tranchesReconcile ? 'text-success' : 'text-destructive')}>₹{trancheTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Expected Credit Exposure:</span>
                  <span className="font-medium tabular-nums text-foreground">₹{requestedExposure.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Non-credit Site Value:</span>
                  <span className="tabular-nums">₹{Math.max(0, billAmount - requestedExposure).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Remaining to allocate:</span>
                  <span className={cn(
                    'font-semibold tabular-nums',
                    Math.abs(requestedExposure - trancheTotal) < 0.01 ? 'text-success' : 'text-destructive'
                  )}>
                    ₹{Math.max(0, requestedExposure - trancheTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {trancheTotal > requestedExposure && ' (over-allocated)'}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Composite Credit Days:</span>
                  <span className="tabular-nums">{compositeDays()} days</span>
                </div>
              </div>

              {!tranchesReconcile && requestedExposure > 0 && (
                <p className={errorCls}>Tranches must sum exactly to the expected credit exposure of ₹{requestedExposure.toLocaleString('en-IN')} before continuing.</p>
              )}

              {errorAlert}
              <div className={actionsCls}>
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                {saveDraftButton}
                <button type="button" className="btn-primary" onClick={() => setStep(3)} disabled={!canGoNext(2)}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Context & Strategy */}
          {step === 3 && (
            <div className="flex flex-col">
              <h2 className="mb-1 text-lg font-semibold tracking-tight">Site & handoff</h2>
              <p className="mb-6 text-xs text-muted-foreground">Identify where the work happens, who owns the review, and why credit is justified.</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={groupCls}>
                  <label className={labelCls}>City Code *</label>
                  <select value={cityCode} onChange={e => setCityCode(e.target.value)} className={inputCls}>
                    <option value="">-- Select City --</option>
                    {cityCodes.map(c => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
                <div className={groupCls}>
                  <label className={labelCls}>Site ID</label>
                  <input value={generatedSiteId} onChange={e => setGeneratedSiteId(e.target.value.toUpperCase())} className={cn(inputCls, 'font-mono font-semibold')} placeholder="Generated from city" maxLength={30} />
                </div>
              </div>
              <div className={groupCls}>
                <label className={labelCls}>Site Address *</label>
                <textarea value={siteAddress} onChange={e => setSiteAddress(e.target.value)} className={inputCls} rows={2} placeholder="Street address of the site" required />
              </div>
              <div className={groupCls}>
                <label htmlFor="kam-assignee" className={labelCls}>KAM Assignee <span className="font-normal">(required to submit)</span></label>
                <select id="kam-assignee" value={kamUserId} onChange={e => setKamUserId(e.target.value)} className={inputCls}>
                  <option value="">-- Select KAM --</option>
                  {kams.map((k: any) => <option key={k.id} value={k.id}>{k.full_name}</option>)}
                </select>
              </div>

              <div className={groupCls}>
                <label className={labelCls}>Strategic Justification (Reason for Credit) *</label>
                <select name="justification" value={justification} onChange={e => setJustification(e.target.value)} className={inputCls} required>
                  <option value="">-- Select Reason --</option>
                  {creditReasons.map((r: any) => (
                    <option key={r.id} value={r.value}>{r.value}</option>
                  ))}
                </select>
              </div>

              {errorAlert}
              <div className={actionsCls}>
                <button type="button" className="btn-secondary" onClick={() => setStep(2)}>Back</button>
                {saveDraftButton}
                <button type="button" className="btn-primary" onClick={() => setStep(4)} disabled={!canGoNext(3)}>Continue to Questions</button>
              </div>
            </div>
          )}

          {/* Step 4: RM Intake Tasks */}
          {step === 4 && (
            <div className="flex flex-col">
              <h2 className="mb-1 text-lg font-semibold tracking-tight">Stage 1 Intake Questions</h2>
              <p className="mb-6 text-xs text-muted-foreground">Required stage 1 items for RM completion based on selected scenario and policy.</p>

              {rmTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground my-4">No specific intake questions required for this scenario.</p>
              ) : (
                <div className="flex flex-col gap-6 my-4">
                  {rmTasks.map((task) => (
                    <div key={task.id} className="p-4 border border-border rounded-md bg-muted">
                      <label className="font-semibold block mb-1">
                        {task.name} {task.is_required && <span className="text-destructive">*</span>}
                      </label>
                      {reusedParams[task.id] && (
                        <p className="text-tiny text-info bg-info/10 border border-info/25 rounded px-2 py-1 mb-2">
                          Reused from {reusedParams[task.id].partyName}
                          {reusedParams[task.id].capturedAt && `, captured ${new Date(reusedParams[task.id].capturedAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                          {' '}— confirm or update before submitting.
                        </p>
                      )}
                      {task.rubric_guidance && (
                        <div
                          className="text-xs text-muted-foreground mb-3"
                        >
                          {parseRubricGuidance(task.rubric_guidance).map((line, i) => (
                            <span key={i} className="block">
                              {line.map((part, j) => part.strong ? <strong key={j}>{part.text}</strong> : <span key={j}>{part.text}</span>)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {task.input_type === 'grade_select' ? (
                        <select
                          id={`intake-task-${task.id}`}
                          className={inputCls}
                          value={rmTaskAnswers[task.id]?.grade_value ?? ''}
                          onChange={(e) => handleTaskAnswerChange(task.id, 'grade_value', e.target.value === '' ? undefined : Number(e.target.value))}
                        >
                          <option value="">-- Select --</option>
                          <>
                              {task.auto_band_config?.mappings ? (
                                task.auto_band_config.mappings.map((m: any, i: number) => (
                                  <option key={i} value={m.grade}>{formatPolicyOptionLabel(m.value)} (Grade {m.grade})</option>
                                ))
                              ) : gradeScale.length > 0 ? (
                                /* Labels come from policy grade_scale — higher grade = better */
                                gradeScale.map(g => (
                                  <option key={g.grade_value} value={g.grade_value}>{g.grade_value} — {g.grade_label}</option>
                                ))
                              ) : (
                                [5, 4, 3, 2, 1].map(n => (
                                  <option key={n} value={n}>Grade {n}{n === 5 ? ' (strongest)' : n === 1 ? ' (weakest)' : ''}</option>
                                ))
                              )}
                          </>
                        </select>
                      ) : task.input_type === 'link_list' || task.input_type === 'dropdown' || task.input_type === 'yes_no' ? (
                         <select
                           id={`intake-task-${task.id}`}
                           className={inputCls}
                           value={rmTaskAnswers[task.id]?.raw_input_value ?? ''}
                           onChange={(e) => handleTaskAnswerChange(task.id, 'raw_input_value', e.target.value)}
                         >
                           <option value="">-- Select --</option>
                           {task.input_type === 'yes_no' ? (
                             <><option value="Yes">Yes</option><option value="No">No</option></>
                           ) : task.auto_band_config?.mappings?.map((m: any, i: number) => (
                               <option key={i} value={m.value}>{formatPolicyOptionLabel(m.value)}</option>
                             ))}
                         </select>
                      ) : (
                        <input
                          id={`intake-task-${task.id}`}
                          type={task.input_type === 'numeric' ? 'number' : task.input_type === 'date' ? 'date' : 'text'}
                          className={inputCls}
                          placeholder="Enter value"
                          value={rmTaskAnswers[task.id]?.raw_input_value || ''}
                          onChange={(e) => handleTaskAnswerChange(task.id, 'raw_input_value', e.target.value)}
                        />
                      )}

                      {/* Display automatically mapped grade if applicable */}
                      {task.auto_band_config && rmTaskAnswers[task.id]?.grade_value !== undefined && (
                        <div className="mt-1 text-xs text-success font-medium">
                           Auto-mapped to Grade {rmTaskAnswers[task.id].grade_value}
                        </div>
                      )}

                      <textarea
                        className={inputCls}
                        placeholder="Reason or notes (optional)"
                        rows={2}
                        value={rmTaskAnswers[task.id]?.reason || ''}
                        onChange={(e) => handleTaskAnswerChange(task.id, 'reason', e.target.value)}
                      />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Final review — see the whole submission before committing (§12.3) */}
              <div className="my-6 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Review before submit</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Scenario</dt>
                    <dd className="font-medium text-right">Billed to {SCENARIO_LABELS[scenario]?.billedTo} · pays {SCENARIO_LABELS[scenario]?.pays}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd className="font-medium text-right">{parties.find(p => p.id === customerPartyId)?.legal_name || <span className="text-warning">Not selected</span>}</dd>
                  </div>
                  {needsContractor && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Contractor</dt>
                      <dd className="font-medium text-right">{parties.find(p => p.id === contractorPartyId)?.legal_name || <span className="text-warning">Not selected</span>}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">KAM owner</dt>
                    <dd className="font-medium text-right">{kams.find((k: any) => k.id === kamUserId)?.full_name || <span className="text-warning">Required to submit</span>}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Site value / expected exposure</dt>
                    <dd className="font-medium text-right tabular-nums">₹{billAmount.toLocaleString('en-IN')} / ₹{requestedExposure.toLocaleString('en-IN')} ({creditPercentage}% credit)</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Repayment schedule</dt>
                    <dd className="font-medium text-right tabular-nums">{tranches.length} tranche{tranches.length !== 1 ? 's' : ''} · {compositeDays()}d composite</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Required review depth</dt>
                    <dd className="font-medium text-right">Stage {requiredStage} before approval</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Site</dt>
                    <dd className="font-medium text-right">{generatedSiteId || '—'} · {cityCode || '—'}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  On submit, the case moves to In Review, Stage 1 tasks are created, and the KAM is notified. Any missing question is linked directly in the error summary.
                </p>
              </div>

              {errorAlert}

              <div className={actionsCls}>
                <button type="button" className="btn-secondary" onClick={() => setStep(3)}>Back</button>
                <div className="flex gap-2">
                  {saveDraftButton}
                  <button type="button" className="btn-primary" onClick={() => handleSubmit('submit')} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit for Review'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <PartyDialog
        open={partyDialogOpen}
        onOpenChange={setPartyDialogOpen}
        onSuccess={(newParty) => refreshParties(newParty)}
      />
    </div>
  );
}
