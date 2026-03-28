"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin, hasAnyRole, logAuditEvent } from '@/utils/auth';
import { createCaseDraft, submitCase, calculateCompositeDays, validateTranches } from '@/utils/engine';
import { redirect } from 'next/navigation';

/**
 * Server action: Create a new case draft / submit case.
 */
export async function handleNewCase(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!hasAnyRole(user, ['rm', 'founder_admin'])) {
    throw new Error('Only RM or Admin can create cases');
  }

  const caseScenario = formData.get('caseScenario') as string;
  const customerPartyId = formData.get('customerPartyId') as string || undefined;
  const contractorPartyId = formData.get('contractorPartyId') as string || undefined;
  const billAmount = parseFloat(formData.get('billAmount') as string) || 0;
  const requestedExposure = parseFloat(formData.get('requestedExposure') as string) || 0;
  const tranchesRaw = formData.get('tranches') as string;
  const branchId = formData.get('branchId') as string || undefined;
  const commercialNotes = formData.get('commercialNotes') as string || '';
  const productCategory = formData.get('productCategory') as string || '';
  const dealSizeBucket = formData.get('dealSizeBucket') as string || '';
  const justification = formData.get('justification') as string || '';
  const action = formData.get('action') as string; // 'draft' or 'submit'

  let tranches: any[] = [];
  try {
    tranches = JSON.parse(tranchesRaw || '[]');
  } catch {
    throw new Error('Invalid tranche data.');
  }

  const rmTaskAnswersRaw = formData.get('rmTaskAnswers') as string;
  let rmTaskAnswers = {};
  if (rmTaskAnswersRaw) {
    try {
      rmTaskAnswers = JSON.parse(rmTaskAnswersRaw);
    } catch {}
  }

  // Validate tranches if submitting
  if (action === 'submit' && billAmount > 0) {
    const validation = validateTranches(tranches, billAmount);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Create draft
  const newCase = await createCaseDraft({
    case_scenario: caseScenario,
    customer_party_id: customerPartyId || undefined,
    contractor_party_id: contractorPartyId || undefined,
    bill_amount: billAmount,
    requested_exposure_amount: requestedExposure,
    proposed_tranches: tranches,
    branch_id: branchId || undefined,
    case_attributes: {
      product_category: productCategory,
      deal_size_bucket: dealSizeBucket,
      draft_rm_answers: rmTaskAnswers
    },
    commercial_notes: `${commercialNotes}\n\nJustification: ${justification}`,
    rm_user_id: user.id,
  });

  // If submitting, also trigger submission
  if (action === 'submit') {
    await submitCase(newCase.id, user.id);
  }

  redirect(`/cases/${newCase.id}`);
}

/**
 * Server action: Fetch parties for the select dropdown.
 */
export async function fetchParties() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('parties')
    .select('id, legal_name, customer_code, industry_category')
    .eq('is_active', true)
    .order('legal_name')
    .limit(200);
  return data || [];
}

/**
 * Server action: Fetch branches.
 */
export async function fetchBranches() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  return data || [];
}

/**
 * Server action: Fetch admin enumerations by category.
 */
export async function fetchEnumerations(category: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('admin_enumerations')
    .select('id, value')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order');
  return data || [];
}

/**
 * Server action: Fetch RM specific Stage 1 parameters based on case scenario.
 */
export async function fetchRmIntakeTasks(scenario: string) {
  const supabase = await createClient();

  // Get active policy
  const { data: activePolicy } = await supabase
    .from('policy_versions')
    .select('id')
    .eq('is_active', true)
    .single();

  if (!activePolicy) return [];

  const allowedSubjects = ['case'];
  if (scenario === 'customer_name_customer_pays') {
    allowedSubjects.push('customer');
  } else if (scenario === 'contractor_name_contractor_pays') {
    allowedSubjects.push('contractor');
  } else if (scenario === 'customer_name_contractor_pays') {
    allowedSubjects.push('customer', 'contractor');
  }

  const { data: params } = await supabase
    .from('parameter_definitions')
    .select('id, name, input_type, is_required, conditional_rules, description')
    .eq('policy_version_id', activePolicy.id)
    .eq('stage', 1)
    .eq('default_owning_role', 'rm')
    .eq('is_active', true)
    .in('subject_type', allowedSubjects);

  if (!params) return [];

  const applicableParams = params.filter(p => {
    if (p.conditional_rules?.scenarios && Array.isArray(p.conditional_rules.scenarios)) {
      if (!p.conditional_rules.scenarios.includes(scenario)) {
        return false;
      }
    }
    return true;
  });

  return applicableParams;
}
