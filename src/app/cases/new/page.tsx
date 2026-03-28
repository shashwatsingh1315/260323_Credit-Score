"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Trash2, UserPlus } from 'lucide-react';
import { handleNewCase, fetchParties, fetchBranches, fetchEnumerations, fetchRmIntakeTasks, fetchActiveRoutingThresholds } from './actions';
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

export default function NewCasePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [parties, setParties] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [dealBuckets, setDealBuckets] = useState<any[]>([]);
  const [routingThresholds, setRoutingThresholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [partyTypeForDialog, setPartyTypeForDialog] = useState<'customer' | 'contractor'>('customer');

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

  // Form state
  const [scenario, setScenario] = useState('customer_name_customer_pays');
  const [customerPartyId, setCustomerPartyId] = useState('');
  const [contractorPartyId, setContractorPartyId] = useState('');
  const [billAmount, setBillAmount] = useState(0);
  const [requestedExposure, setRequestedExposure] = useState(0);
  const [tranches, setTranches] = useState<Tranche[]>([
    { type: 'percentage', value: 100, days_after_billing: 30 },
  ]);
  const [branchId, setBranchId] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [dealSizeBucket, setDealSizeBucket] = useState('');
  const [commercialNotes, setCommercialNotes] = useState('');
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
    async function load() {
      const [p, b, pc, ds, rts] = await Promise.all([
        fetchParties(),
        fetchBranches(),
        fetchEnumerations('product_category'),
        fetchEnumerations('deal_size_bucket'),
        fetchActiveRoutingThresholds(),
      ]);
      setParties(p);
      setBranches(b);
      setProductCategories(pc);
      setDealBuckets(ds);
      setRoutingThresholds(rts);
      setLoading(false);
    }
    load();
  }, []);

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
        } else if ((taskDef.input_type === 'dropdown' || taskDef.input_type === 'yes_no') && taskDef.auto_band_config.mappings) {
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
      const missingTasks = rmTasks.filter(t => t.is_required && !rmTaskAnswers[t.id]?.raw_input_value && rmTaskAnswers[t.id]?.grade_value === undefined);
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
    fd.set('branchId', branchId);
    fd.set('productCategory', productCategory);
    fd.set('dealSizeBucket', dealSizeBucket);
    fd.set('commercialNotes', commercialNotes);
    fd.set('justification', justification);
    fd.set('rmTaskAnswers', JSON.stringify(rmTaskAnswers));
    fd.set('action', action);

    try {
      await handleNewCase(fd);
    } catch (err: any) {
      setError(err.message || 'Failed to create case.');
      setSubmitting(false);
    }
  };

  const canGoNext = (currentStep: number) => {
    if (currentStep === 1) return (needsCustomer ? !!customerPartyId : true) && (needsContractor ? !!contractorPartyId : true) && !!scenario;
    if (currentStep === 2) return billAmount > 0 && requestedExposure > 0;
    if (currentStep === 3) return tranchesReconcile;
    if (currentStep === 4) return true;
    return true;
  };

  const expectedStage = () => {
    for (const rule of routingThresholds) {
      if (rule.context_rule?.exposure_min && requestedExposure >= rule.context_rule.exposure_min) {
        return rule.target_stage;
      }
    }
    return 1; // Default
  };

  if (loading) return <div className={styles.container}><p>Loading...</p></div>;

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
          {['Scenario & Parties', 'Commercial Terms', 'Tranche Builder', 'Context', 'Intake Questions'].map((label, i) => {
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
                  <select value={customerPartyId} onChange={e => setCustomerPartyId(e.target.value)} className={styles.input}>
                    <option value="">-- Select Customer --</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.customer_code ? `(${p.customer_code})` : ''}</option>)}
                  </select>
                </div>
              )}

              {needsContractor && (
                <div className={styles.inputGroup}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="mb-0">Contractor Party *</label>
                    <button
                      type="button"
                      onClick={() => { setPartyTypeForDialog('contractor'); setPartyDialogOpen(true); }}
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                    >
                      <UserPlus size={12} /> Add New
                    </button>
                  </div>
                  <select value={contractorPartyId} onChange={e => setContractorPartyId(e.target.value)} className={styles.input}>
                    <option value="">-- Select Contractor --</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.legal_name} {p.customer_code ? `(${p.customer_code})` : ''}</option>)}
                  </select>
                </div>
              )}

              <div className={styles.inputGroup}>
                <label>Branch / Region</label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className={styles.input}>
                  <option value="">-- Select Branch --</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className={styles.actions}>
                <button type="button" className="btn-primary" onClick={() => setStep(2)} disabled={!canGoNext(1)} style={{ opacity: canGoNext(1) ? 1 : 0.5 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 2: Commercial Terms */}
          {step === 2 && (
            <div className={styles.formSection}>
              <h2>Commercial Terms</h2>
              <p className={styles.helperText}>Bill amount and requested exposure are separate fields (Doc 04).</p>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Bill Amount (₹) *</label>
                  <input type="number" value={billAmount || ''} onChange={e => setBillAmount(parseFloat(e.target.value) || 0)} className={styles.input} placeholder="0" />
                </div>
                <div className={styles.inputGroup}>
                  <label>Requested Exposure (₹) *</label>
                  <input type="number" value={requestedExposure || ''} onChange={e => setRequestedExposure(parseFloat(e.target.value) || 0)} className={styles.input} placeholder="0" />
                </div>
              </div>

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                <button type="button" className="btn-primary" onClick={() => setStep(3)} disabled={!canGoNext(2)} style={{ opacity: canGoNext(2) ? 1 : 0.5 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Tranche Builder */}
          {step === 3 && (
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
                  <span className={styles.highlight}>{compositeDays()} days</span>
                </div>
                {!tranchesReconcile && billAmount > 0 && (
                  <p className={styles.trancheError}>⚠ Tranches do not reconcile to bill amount.</p>
                )}
              </div>

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setStep(2)}>Back</button>
                <button type="button" className="btn-primary" onClick={() => setStep(4)} disabled={!canGoNext(3)} style={{ opacity: canGoNext(3) ? 1 : 0.5 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 4: Context & Submit */}
          {step === 4 && (
            <div className={styles.formSection}>
              <h2>Context & Justification</h2>
              <p className={styles.helperText}>Provide category context and strategic justification.</p>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Product Category</label>
                  <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className={styles.input}>
                    <option value="">-- Select --</option>
                    {productCategories.map(c => <option key={c.id} value={c.value}>{c.value}</option>)}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Deal Size Bucket</label>
                  <select value={dealSizeBucket} onChange={e => setDealSizeBucket(e.target.value)} className={styles.input}>
                    <option value="">-- Select --</option>
                    {dealBuckets.map(d => <option key={d.id} value={d.value}>{d.value}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Commercial Notes</label>
                <textarea value={commercialNotes} onChange={e => setCommercialNotes(e.target.value)} rows={3} className={styles.input} placeholder="Any relevant commercial context..." />
              </div>

              <div className={styles.inputGroup}>
                <label>Strategic Justification *</label>
                <textarea value={justification} onChange={e => setJustification(e.target.value)} rows={4} className={styles.input} placeholder="Detail the business case for this credit request..." />
              </div>

              <div className="mt-6 p-4 bg-muted rounded-md text-sm border">
                <strong>Routing Preview:</strong> Based on the requested exposure (₹{requestedExposure.toLocaleString('en-IN')}), this case is expected to route up to <strong>Stage {expectedStage()}</strong>.
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setStep(3)}>Back</button>
                <button type="button" className="btn-primary" onClick={() => setStep(5)} disabled={!canGoNext(4)} style={{ opacity: canGoNext(4) ? 1 : 0.5 }}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 5: RM Intake Tasks */}
          {step === 5 && (
            <div className={styles.formSection}>
              <h2>Stage 1 Intake Questions</h2>
              <p className={styles.helperText}>Required stage 1 items for RM completion based on selected scenario and policy.</p>

              {rmTasks.length === 0 ? (
                <p className="text-sm text-gray-500 my-4">No specific intake questions required for this scenario.</p>
              ) : (
                <div className="flex flex-col gap-6 my-4">
                  {rmTasks.map((task) => (
                    <div key={task.id} className="p-4 border border-gray-200 rounded-md bg-white">
                      <label className="font-semibold block mb-1">
                        {task.name} {task.is_required && <span className="text-red-500">*</span>}
                      </label>
                      {task.description && <p className="text-xs text-gray-500 mb-3">{task.description}</p>}

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
                              <option value="1">Grade 1 (Best)</option>
                              <option value="2">Grade 2</option>
                              <option value="3">Grade 3</option>
                              <option value="4">Grade 4 (Worst)</option>
                            </>
                          )}
                        </select>
                      ) : task.input_type === 'dropdown' || task.input_type === 'yes_no' ? (
                         <select
                           className={styles.input}
                           value={rmTaskAnswers[task.id]?.raw_input_value ?? ''}
                           onChange={(e) => handleTaskAnswerChange(task.id, 'raw_input_value', e.target.value)}
                         >
                           <option value="">-- Select --</option>
                           {task.auto_band_config?.mappings?.map((m: any, i: number) => (
                             <option key={i} value={m.value}>{m.value}</option>
                           ))}
                           {(!task.auto_band_config?.mappings || task.auto_band_config.mappings.length === 0) && task.input_type === 'yes_no' && (
                              <>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </>
                           )}
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
                        className={styles.input + ' mt-2'}
                        placeholder="Reason or notes (optional)"
                        rows={2}
                        value={rmTaskAnswers[task.id]?.reason || ''}
                        onChange={(e) => handleTaskAnswerChange(task.id, 'reason', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {error && <p className={styles.errorMsg}>{error}</p>}

              <div className={styles.actions}>
                <button type="button" className="btn-secondary" onClick={() => setStep(4)}>Back</button>
                <button type="button" className="btn-secondary" onClick={() => handleSubmit('draft')} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save as Draft'}
                </button>
                <button type="button" className="btn-primary" onClick={() => handleSubmit('submit')} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
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
