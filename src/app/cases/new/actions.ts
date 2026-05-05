"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, isAdmin, hasAnyRole, logAuditEvent } from '@/utils/auth';
import { createCaseDraft, submitCase, calculateCompositeDays, validateTranches } from '@/utils/engine';
import { redirect } from 'next/navigation';
import { idEngine, IdGenerationParams } from '@/utils/idEngine';
import { validateCreditLine } from '@/utils/creditLine';

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
  const dealSizeBucket = formData.get('dealSizeBucket') as string || '';
  const justification = formData.get('justification') as string || '';
  const action = formData.get('action') as string;
  const kamUserId = formData.get('kamUserId') as string || undefined; // 'draft' or 'submit'

  if (!kamUserId) {
    throw new Error('KAM Assignee is required.');
  }

  let tranches: any[] = [];
  try {
    tranches = JSON.parse(tranchesRaw || '[]');
  } catch {
    throw new Error('Invalid tranche data.');
  }

  const rmTaskAnswersRaw = formData.get('rmTaskAnswers') as string;
  let rmTaskAnswers: Record<string, any> = {};
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

  // Validate Credit Line
  const partyToValidate = caseScenario.startsWith('customer') ? customerPartyId : contractorPartyId;
  if (partyToValidate && action === 'submit') {
    const clValidation = await validateCreditLine(partyToValidate, requestedExposure, billAmount);
    if (!clValidation.valid) {
      throw new Error(clValidation.message || 'Credit line validation failed');
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
    case_attributes: {
      deal_size_bucket: dealSizeBucket,
      draft_rm_answers: rmTaskAnswers,
      site_address: formData.get('siteAddress'),
      city_code: formData.get('cityCode'),
      site_id: formData.get('generatedSiteId'),
    },
    commercial_notes: justification ? `Strategic Justification: ${justification}` : '',
    rm_user_id: user.id,
    kam_user_id: kamUserId,
  });

  // Save persistent parameters
  const answeredParamIds = Object.keys(rmTaskAnswers);
  if (answeredParamIds.length > 0) {
    const supabase = await createClient();
    const { data: paramDefs } = await supabase
      .from('parameter_definitions')
      .select('id, persistence_scope, subject_type')
      .in('id', answeredParamIds);
      
    const partyParamsToSave = [];
    if (paramDefs) {
      for (const p of paramDefs) {
        if (p.persistence_scope === 'party') {
          const partyId = p.subject_type === 'contractor' ? contractorPartyId : customerPartyId;
          if (partyId) {
            partyParamsToSave.push({
              party_id: partyId,
              parameter_id: p.id,
              grade_value: rmTaskAnswers[p.id].grade_value,
              raw_input_value: rmTaskAnswers[p.id].raw_input_value,
              captured_from_case: newCase.id,
              captured_at: new Date().toISOString()
            });
          }
        }
      }
    }
    
    if (partyParamsToSave.length > 0) {
      for (const pp of partyParamsToSave) {
        await supabase.from('party_parameter_values').upsert(pp, { onConflict: 'party_id,parameter_id' });
      }
    }
  }

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
    .select('id, legal_name, customer_code, industry_category, party_type, influencer_subtype')
    .eq('is_active', true)
    .order('legal_name')
    .limit(200);
  return data || [];
}

export async function fetchCityCodes() {
  const supabase = await createClient();
  const { data } = await supabase.from('city_codes').select('*').order('name');
  return data || [];
}

/**
 * Fetch a single party with historical case data for auto-fill.
 */
export async function fetchPartyDetails(partyId: string) {
  if (!partyId) return null;
  const supabase = await createClient();
  const { data: party } = await supabase
    .from('parties')
    .select('id, legal_name, customer_code, industry_category, party_type, influencer_subtype, gst_number, pan_number, address, display_name, contact_phone, credit_line_amount')
    .eq('id', partyId)
    .single();

  if (!party) return null;

  // Fetch last case for this party (as customer or contractor) to pre-fill bill amounts
  const { data: lastCase } = await supabase
    .from('credit_cases')
    .select('bill_amount, requested_exposure_amount, composite_credit_days, deal_size_bucket')
    .or(`customer_party_id.eq.${partyId},contractor_party_id.eq.${partyId}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch saved parameters for this party
  const { data: savedParams } = await supabase
    .from('party_parameter_values')
    .select('parameter_id, grade_value, raw_input_value')
    .eq('party_id', partyId);

  return { ...party, lastCase, savedParams: savedParams || [] };
}


/**
 * Server action: Fetch branches.
 */
/**
 * Server action: Fetch KAM users.
 */
export async function fetchKams() {
  const supabase = await createClient();
  // Fetch all users with roles and filter for KAMs
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, roles:user_roles(role)')
    .order('full_name');
  
  return allUsers?.filter(u => u.roles?.some((r: any) => r.role === 'kam')) || [];
}


/**
 * Server action: Fetch active routing thresholds for preview.
 */
export async function fetchActiveRoutingThresholds() {
  const supabase = await createClient();
  const { data: activePolicy } = await supabase
    .from('policy_versions')
    .select('id')
    .eq('is_active', true)
    .single();

  if (!activePolicy) return [];

  const { data } = await supabase
    .from('routing_thresholds')
    .select('*')
    .eq('policy_version_id', activePolicy.id)
    .order('target_stage', { ascending: false }); // Highest stage first

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
    .select('id, name, input_type, is_required, conditional_rules, rubric_guidance, auto_band_config, default_owning_role')
    .eq('policy_version_id', activePolicy.id)
    .eq('stage', 1)
    .eq('is_active', true)
    .in('subject_type', allowedSubjects);

  if (!params) return [];

  const applicableParams = params.filter(p => {
    if (p.default_owning_role?.toLowerCase() !== 'rm') return false;

    if (p.conditional_rules?.scenarios && Array.isArray(p.conditional_rules.scenarios)) {
      if (!p.conditional_rules.scenarios.includes(scenario)) {
        return false;
      }
    }
    return true;
  });

  return applicableParams;
}

/**
 * Auto-generate a Site ID (Lead) for the preview / formulation.
 */
export async function generateSiteIdPreview(cityCode: string, siteDateIso: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const siteDate = new Date(siteDateIso);
  
  // Calculate sequence number for RM in current month
  const supabase = await createClient();
  const startOfMonth = new Date(siteDate.getFullYear(), siteDate.getMonth(), 1).toISOString();
  const endOfMonth = new Date(siteDate.getFullYear(), siteDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { count } = await supabase
    .from('credit_cases')
    .select('id', { count: 'exact' })
    .eq('rm_user_id', user.id)
    .eq('case_attributes->>city_code', cityCode)
    .gte('created_at', startOfMonth)
    .lte('created_at', endOfMonth);

  const sequence = (count ?? 0) + 1;

  // Attempt to split user full name.
  const parts = user.full_name.split(' ');
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;

  const id = await idEngine.generateLeadSiteId({
    cityCode,
    siteDate,
    rmFirstName: first,
    rmLastName: last,
    siteSequenceNumber: sequence
  });
  return id;
}

export async function generatePartyIdPreview(params: IdGenerationParams & { type: 'contractor' | 'interior' }) {
  if (params.type === 'contractor') {
    return await idEngine.generateContractorId(params);
  } else {
    return await idEngine.generateInteriorId(params);
  }
}
