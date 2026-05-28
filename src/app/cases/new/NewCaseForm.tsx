"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Trash2, UserPlus } from 'lucide-react';
import { handleNewCase, fetchParties, fetchEnumerations, fetchRmIntakeTasks, fetchActiveRoutingThresholds, fetchKams, fetchPartyDetails, fetchCityCodes, generateSiteIdPreview } from './actions';
import { PartyDialog } from '@/components/admin/PartyDialog';
import styles from './page.module.css';
import { cn } from '@/lib/utils';

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

export default function NewCaseForm({ 
  initialParties, 
  kams, 
  dealBuckets, 
  routingThresholds, 
  creditReasons, 
  cityCodes,
  initialSiteDate
}: { 
  initialParties: any[], kams: any[], dealBuckets: any[], routingThresholds: any[], creditReasons: any[], cityCodes: any[], initialSiteDate: string 
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [parties, setParties] = useState<any[]>(initialParties);
  const [kamUserId, setKamUserId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [partyTypeForDialog, setPartyTypeForDialog] = useState<'customer' | 'contractor'>('customer');
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [contractorDetails, setContractorDetails] = useState<any>(null);

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
  const [requestedExposure, setRequestedExposure] = useState(0);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [isLoadingContractor, setIsLoadingContractor] = useState(false);

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
      }
      setIsLoadingContractor(false);
    } else {
      setContractorDetails(null);
    }
  };
  const [tranches, setTranches] = useState<Tranche[]>([
    { type: 'percentage', value: 100, days_after_billing: 30 },
  ]);
  const [dealSizeBucket, setDealSizeBucket] = useState('');
  const [justification, setJustification] = useState('');
  const [rmTasks, setRmTasks] = useState<any[]>([]);
  const [rmTaskAnswers, setRmTaskAnswers] = useState<Record<string, any>>({});

  const needsContractor = scenario !== 'customer_name_customer_pays';
  const needsCustomer = scenario !== 'contractor_name_contractor_pays';

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

  const formatRubricGuidance = (text: string) => {
    if (!text) return null;
    return text.split(/\\n|\n/).map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
          })}
          <br />
        </span>
      );
    });
  };

  // Composite credit day calculation
  const compositeDays = useCallback(() => {
    if (billAmount <= 0 || tranches.length === 0) return 0;
    let weightedDays = 0;
    let totalWeight = 0;
    for (const t of tranches) {
      const w = t.type === 'percentage' ? t.value / 100 : t.value / billAmount;
      totalWeight += w;
      weightedDays += w * t.days_after_billing;
    }
    if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.001) {
      weightedDays = weightedDays / totalWeight;
    }
    return Math.round(weightedDays * 100) / 100;
  }, [tranches, billAmount]);

  // Tranche total
  const trancheTotal = tranches.reduce((sum, t) => {
    return sum + (t.type === 'percentage' ? (t.value / 100) * billAmount : t.value);
  }, 0);
  const tranchesReconcile = billAmount > 0 ? Math.abs(trancheTotal - billAmount) < 0.01 : true;

  const addTranche = () => setTranches([...tranches, { type: 'amount', value: 0, days_after_billing: 0 }]);
  const removeTranche = (idx: number) => setTranches(tranches.filter((_, i) => i !== idx));
  const updateTranche = (idx: number, field: string, value: any) => {
    const updated = [...tranches];
    (updated[idx] as any)[field] = value;
    setTranches(updated);
  };

  const handleTaskAnswerChange = (taskId: string, field: 'grade_value' | 'raw_input_value' | 'reason', value: any) => {
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
    setSubmitting(true);

    if (action === 'submit' && billAmount > 0 && !tranchesReconcile) {
      setError('Tranches must reconcile exactly to bill amount before submission.');
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
        setError(`Please answer all required RM intake questions before submitting: ${missingTasks.map(t => t.name).join(', ')}`);
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
    fd.set('dealSizeBucket', dealSizeBucket);
    fd.set('justification', justification);
    fd.set('rmTaskAnswers', JSON.stringify(rmTaskAnswers));
    fd.set('action', action);
    fd.set('siteAddress', siteAddress);
    fd.set('cityCode', cityCode);
    fd.set('generatedSiteId', generatedSiteId);

    try {
      await handleNewCase(fd);
    } catch (err: any) {
      setError(err.message || 'Failed to create case.');
      setSubmitting(false);
    }
  };

  const canGoNext = (currentStep: number) => {
    if (currentStep === 1) {
       return (needsCustomer ? !!customerPartyId : true) && 
              (needsContractor ? !!contractorPartyId : true) && 
              !!scenario && 
              !!siteAddress && 
              !!cityCode &&
              !!kamUserId &&
              billAmount > 0 && 
              requestedExposure > 0 && 
              requestedExposure <= billAmount &&
              (() => {
                const activeDetails = scenario.startsWith('customer') ? customerDetails : contractorDetails;
                const creditLine = activeDetails?.credit_line_amount;
                return !(creditLine !== null && creditLine !== undefined && requestedExposure > creditLine);
              })();
    }
    if (currentStep === 2) return tranchesReconcile;
    if (currentStep === 3) return justification.trim().length > 0;
    return true;
  };

  const expectedStage = () => {
    for (const rule of routingThresholds) {
      let matches = true;
      if (rule.context_rule?.exposure_min && requestedExposure < rule.context_rule.exposure_min) matches = false;
      if (rule.context_rule?.case_scenario && rule.context_rule.case_scenario !== scenario) matches = false;
      if (rule.context_rule?.deal_size_bucket && dealSizeBucket && rule.context_rule.deal_size_bucket !== dealSizeBucket) matches = false;
      // Removed product_category match as it is removed from UI
      if (matches) return rule.target_stage;
    }
    return 1; // Default
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.breadcrumbs}>
          <span>Cases</span>
          <ChevronRight size={16} />
          <span className={styles.currentBreadcrumb}>New Intake</span>
        </div>
        <h1 className={styles.title}>New Credit Case</h1>
        <p className={styles.subtitle}>Create a draft or submit a case for review.</p>
      </div>

      <div className={styles.wizard}>
        <div className={styles.sidebar}>
          {['Parties & Terms', 'Tranche Builder', 'Context', 'Intake Questions'].map((label, i) => {
            const stepNum = i + 1;
            const isAccessible = stepNum <= step || (stepNum === step + 1 && canGoNext(step));
            return (
              <div 
                key={i} 
                className={cn(
                  styles.step, 
                  step === stepNum && styles.active, 
                  step > stepNum && styles.done,
                  !isAccessible && styles.disabled
                )} 
                onClick={() => isAccessible && setStep(stepNum)}
              >
                <div className={styles.stepNum}>{step > stepNum ? '✓' : stepNum}</div>
                <div className={styles.stepText}>{label}</div>
              </div>
            );
          })}
        </div>

        <div className={`card ${styles.formContent}`}>
          {/* Step 1: Scenario & Parties */}
          {step === 1 && (
            <div className={styles.formSection}>
              <h2>Case Scenario & Parties</h2>
              <p className={styles.helperText}>Select the billing/payment scenario and link relevant parties.</p>

              <div className={styles.inputGroup}>
                <label>Case Scenario *</label>
                <select value={scenario} onChange={e => setScenario(e.target.value)} className={styles.input}>
                  {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={styles.inputGroup}>
                  <label>City Code *</label>
                  <select value={cityCode} onChange={e => setCityCode(e.target.value)} className={styles.input}>
                    <option value="">-- Select City --</option>
                    {cityCodes.map(c => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Generated Site ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={generatedSiteId}
                      onChange={e => setGeneratedSiteId(e.target.value.toUpperCase())}
                      className={`${styles.input} font-mono font-semibold`}
                      placeholder="Select city to auto-generate..."
                      maxLength={30}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      editable
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Site Address *</label>
                <textarea 
                  value={siteAddress} 
                  onChange={e => setSiteAddress(e.target.value)} 
                  className={styles.input} 
                  rows={2} 
                  placeholder="Street address of the site..." 
                  required 
                />
              </div>

              {needsCustomer && (
                <div className={styles.inputGroup}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="mb-0">Customer Party *</label>
                    <button
                      type="button"
                      onClick={() => { setPartyTypeForDialog('customer'); setPartyDialogOpen(true); }}
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                    >
                      <UserPlus size={12} /> Add New
                    </button>
                  </div>
                  <select value={customerPartyId} onChange={e => handleCustomerSelect(e.target.value)} className={styles.input} disabled={isLoadingCustomer}>
                    <option value="">{isLoadingCustomer ? 'Loading details...' : '-- Select Customer --'}</option>
                    {parties
                      .filter(p => !p.party_type || p.party_type === 'customer' || p.party_type === 'both')
                      .map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.customer_code ? `(${p.customer_code})` : ''}</option>)}
                  </select>
                  {customerDetails && (
                    <div className="mt-2 p-3 rounded-md bg-muted/60 border border-border text-xs space-y-1 text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Industry:</span> {customerDetails.industry_category || '—'}</p>
                      {customerDetails.credit_line_amount !== null && customerDetails.credit_line_amount !== undefined && (
                        <p><span className="font-semibold text-foreground text-warning">Credit Limit:</span> ₹{customerDetails.credit_line_amount.toLocaleString('en-IN')}</p>
                      )}
                      {customerDetails.address && <p><span className="font-semibold text-foreground">Location:</span> {customerDetails.address}</p>}
                      {customerDetails.lastCase && (
                        <p><span className="font-semibold text-foreground">Last case bill:</span> ₹{customerDetails.lastCase.bill_amount?.toLocaleString('en-IN')} · {customerDetails.lastCase.composite_credit_days}d credit</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {needsContractor && (
                <div className={styles.inputGroup}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="mb-0">Contractor / Influencer Party *</label>
                    <button
                      type="button"
                      onClick={() => { setPartyTypeForDialog('contractor'); setPartyDialogOpen(true); }}
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                    >
                      <UserPlus size={12} /> Add New
                    </button>
                  </div>
                  <select value={contractorPartyId} onChange={e => handleContractorSelect(e.target.value)} className={styles.input} disabled={isLoadingContractor}>
                    <option value="">{isLoadingContractor ? 'Loading details...' : '-- Select Influencer --'}</option>
                    {parties
                      .filter(p => p.party_type === 'influencer' || p.party_type === 'both' || p.party_type === 'contractor')
                      .map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.influencer_subtype ? `[${p.influencer_subtype}]` : ''}</option>)}
                  </select>
                  {contractorDetails && (
                    <div className="mt-2 p-3 rounded-md bg-muted/60 border border-border text-xs space-y-1 text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Sub-type:</span> {contractorDetails.influencer_subtype || '—'}</p>
                      {contractorDetails.credit_line_amount !== null && contractorDetails.credit_line_amount !== undefined && (
                        <p><span className="font-semibold text-foreground text-warning">Credit Limit:</span> ₹{contractorDetails.credit_line_amount.toLocaleString('en-IN')}</p>
                      )}
                      {contractorDetails.address && <p><span className="font-semibold text-foreground">Location:</span> {contractorDetails.address}</p>}
                      {contractorDetails.lastCase && (
                        <p><span className="font-semibold text-foreground">Last case bill:</span> ₹{contractorDetails.lastCase.bill_amount?.toLocaleString('en-IN')} · {contractorDetails.lastCase.composite_credit_days}d credit</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className={styles.inputGroup}>
                <label>KAM Assignee *</label>
                <select value={kamUserId} onChange={e => setKamUserId(e.target.value)} className={styles.input}>
                  <option value="">-- Select KAM --</option>
                  {kams.map((k: any) => <option key={k.id} value={k.id}>{k.full_name}</option>)}
                </select>
              </div>

              <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold mb-3">Commercial Terms</h3>
                <div className={styles.row}>
                  <div className={styles.inputGroup}>
                    <label>Bill Amount (₹) *</label>
                    <input type="number" value={billAmount || ''} onChange={e => setBillAmount(parseFloat(e.target.value) || 0)} className={styles.input} placeholder="0" required />
                  </div>
                  <div className={styles.inputGroup}>
                    <div className="flex justify-between items-center">
                      <label className="mb-0">Requested Exposure (₹) *</label>
                      {billAmount > 0 && (
                        <span className={cn("text-xs font-medium", requestedExposure > billAmount ? "text-destructive" : "text-primary")}>
                          {((requestedExposure / billAmount) * 100).toFixed(1)}% of bill
                        </span>
                      )}
                    </div>
                    <input 
                      type="number" 
                      value={requestedExposure || ''} 
                      onChange={e => setRequestedExposure(parseFloat(e.target.value) || 0)} 
                      className={cn(styles.input, requestedExposure > billAmount && "border-destructive focus:border-destructive")} 
                      placeholder="0" 
                      required
                    />
                    {requestedExposure > billAmount && (
                      <p className="text-tiny text-destructive mt-1 font-medium">⚠ Exposure cannot exceed total bill amount.</p>
                    )}
                    {(() => {
                      const activeDetails = scenario.startsWith('customer') ? customerDetails : contractorDetails;
                      const creditLine = activeDetails?.credit_line_amount;
                      if (creditLine !== null && creditLine !== undefined && requestedExposure > creditLine) {
                        return <p className="text-tiny text-destructive mt-1 font-medium">⚠ Exposure exceeds configured credit limit (₹{creditLine.toLocaleString('en-IN')}). Cannot submit.</p>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={() => setStep(2)} disabled={!canGoNext(1)} className={cn("btn-primary", !canGoNext(1) && "opacity-50")}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 2: Tranche Builder */}
          {step === 2 && (
            <div className={styles.formSection}>
              <h2>Tranche Builder</h2>
              <p className={styles.helperText}>Model proposed payment terms. Total must reconcile to bill amount.</p>

              <div className={styles.trancheHeader}>
                <span>Type</span><span>Value</span><span>Days After Billing</span><span></span>
              </div>
              {tranches.map((t, i) => (
                <div key={i} className={styles.trancheRow}>
                  <select value={t.type} onChange={e => updateTranche(i, 'type', e.target.value)} className={styles.input}>
                    <option value="amount">Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                  <input type="number" value={t.value || ''} onChange={e => updateTranche(i, 'value', parseFloat(e.target.value) || 0)} className={styles.input} placeholder="0" />
                  <input type="number" value={t.days_after_billing || ''} onChange={e => updateTranche(i, 'days_after_billing', parseInt(e.target.value) || 0)} className={styles.input} placeholder="0" />
                  <button type="button" onClick={() => removeTranche(i)} className={styles.deleteBtn} disabled={tranches.length === 1}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <button type="button" onClick={addTranche} className={styles.addTrancheBtn}>
                <Plus size={16} /> Add Tranche
              </button>

              <div className={styles.trancheSummary}>
                <div className={styles.summaryItem}>
                  <span>Tranche Total:</span>
                  <span className={tranchesReconcile ? styles.success : styles.danger}>₹{trancheTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span>Bill Amount:</span>
                  <span>₹{billAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span>Composite Credit Days:</span>
                  <span>{compositeDays()} days</span>
                </div>
              </div>

              {!tranchesReconcile && billAmount > 0 && (
                <p className={styles.errorMsg}>Tranches must sum exactly to ₹{billAmount.toLocaleString('en-IN')} before continuing.</p>
              )}

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                <button type="button" onClick={() => setStep(3)} disabled={!canGoNext(2)} className={cn("btn-primary", !canGoNext(2) && "opacity-50")}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Context & Strategy */}
          {step === 3 && (
            <div className={styles.formSection}>
              <h2>Context & Strategy</h2>
              <p className={styles.helperText}>Provide strategic justification for this exposure.</p>

              <div className={styles.inputGroup}>
                <label>Strategic Justification (Reason for Credit) *</label>
                <select name="justification" value={justification} onChange={e => setJustification(e.target.value)} className={styles.input} required>
                  <option value="">-- Select Reason --</option>
                  {creditReasons.map((r: any) => (
                    <option key={r.id} value={r.value}>{r.value}</option>
                  ))}
                </select>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-md text-sm border">
                <strong>Routing Preview:</strong> Based on the requested exposure (₹{requestedExposure.toLocaleString('en-IN')}), this case is expected to route up to <strong>Stage {expectedStage()}</strong>.
              </div>

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setStep(2)}>Back</button>
                <button type="button" onClick={() => setStep(4)} disabled={!canGoNext(3)} className={cn("btn-primary", !canGoNext(3) && "opacity-50")}>Continue to Questions</button>
              </div>
            </div>
          )}

          {/* Step 4: RM Intake Tasks */}
          {step === 4 && (
            <div className={styles.formSection}>
              <h2>Stage 1 Intake Questions</h2>
              <p className={styles.helperText}>Required stage 1 items for RM completion based on selected scenario and policy.</p>

              {rmTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground my-4">No specific intake questions required for this scenario.</p>
              ) : (
                <div className="flex flex-col gap-6 my-4">
                  {rmTasks.map((task) => (
                    <div key={task.id} className="p-4 border border-border rounded-md bg-muted">
                      <label className="font-semibold block mb-1">
                        {task.name} {task.is_required && <span className="text-red-500">*</span>}
                      </label>
                      {task.rubric_guidance && (
                        <div
                          className="text-xs text-muted-foreground mb-3"
                        >
                          {formatRubricGuidance(task.rubric_guidance)}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {task.input_type === 'grade_select' || task.input_type === 'yes_no' ? (
                        <select
                          className={styles.input}
                          value={rmTaskAnswers[task.id]?.grade_value ?? ''}
                          onChange={(e) => handleTaskAnswerChange(task.id, 'grade_value', e.target.value === '' ? undefined : Number(e.target.value))}
                        >
                          <option value="">-- Select --</option>
                          {task.input_type === 'yes_no' ? (
                            <>
                              <option value="1">Yes</option>
                              <option value="0">No</option>
                            </>
                          ) : (
                            <>
                              {task.auto_band_config?.mappings ? (
                                task.auto_band_config.mappings.map((m: any, i: number) => (
                                  <option key={i} value={m.grade}>{m.value} (Grade {m.grade})</option>
                                ))
                              ) : (
                                <>
                                  <option value="1">Grade 1 (Best)</option>
                                  <option value="2">Grade 2</option>
                                  <option value="3">Grade 3</option>
                                  <option value="4">Grade 4 (Worst)</option>
                                  <option value="5">Grade 5</option>
                                </>
                              )}
                            </>
                          )}
                        </select>
                      ) : task.input_type === 'link_list' || task.input_type === 'dropdown' ? (
                         <select
                           className={styles.input}
                           value={rmTaskAnswers[task.id]?.raw_input_value ?? ''}
                           onChange={(e) => handleTaskAnswerChange(task.id, 'raw_input_value', e.target.value)}
                         >
                           <option value="">-- Select --</option>
                           {task.auto_band_config?.mappings?.map((m: any, i: number) => (
                             <option key={i} value={m.value}>{m.value}</option>
                           ))}
                         </select>
                      ) : (
                        <input
                          type={task.input_type === 'numeric' ? 'number' : task.input_type === 'date' ? 'date' : 'text'}
                          className={styles.input}
                          placeholder="Enter value"
                          value={rmTaskAnswers[task.id]?.raw_input_value || ''}
                          onChange={(e) => handleTaskAnswerChange(task.id, 'raw_input_value', e.target.value)}
                        />
                      )}

                      {/* Display automatically mapped grade if applicable */}
                      {task.auto_band_config && rmTaskAnswers[task.id]?.grade_value !== undefined && (
                        <div className="mt-1 text-xs text-green-600 font-medium">
                           Auto-mapped to Grade {rmTaskAnswers[task.id].grade_value}
                        </div>
                      )}

                      <textarea
                        className={styles.input}
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

              {error && <p className={styles.errorMsg}>{error}</p>}

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setStep(3)}>Back</button>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={() => handleSubmit('draft')} disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button type="button" className="btn-primary" onClick={() => handleSubmit('submit')} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit for Review'}
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
