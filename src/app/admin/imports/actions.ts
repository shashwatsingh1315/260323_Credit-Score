"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser, logAuditEvent } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

export async function fetchImportJobs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('import_jobs')
    .select('*, imported_by:profiles(full_name)')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function processImportJob(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const supabase = await createClient();
  const importType = formData.get('import_type') as string;
  const payloadStr = formData.get('payload') as string;
  const payload = JSON.parse(payloadStr);
  const templateId = formData.get('template_id') as string | null;
  const ignoreMissing = formData.get('ignore_missing_parties') === 'true';

  let columnMapping: Record<string, string> = {};
  if (templateId) {
    const { data: tmpl } = await supabase
      .from('import_mapping_templates')
      .select('column_mapping')
      .eq('id', templateId)
      .single();
    if (tmpl?.column_mapping) {
      columnMapping = tmpl.column_mapping as Record<string, string>;
    }
  }

  const { data: job, error: jobErr } = await supabase.from('import_jobs').insert({
    imported_by: user.id,
    import_type: importType,
    status: 'processing',
    records_total: payload.length
  }).select().single();
  if (jobErr) throw jobErr;

  const partyIdResolutionMap = new Map<string, string>(); // input_value -> actual_uuid
  if (['historical_exposure', 'outstanding_exposure', 'parameter_bulk_values', 'grandfathered_cases'].includes(importType)) {
    const partyIdsInPayload = [...new Set(
      payload.map((r: any) => {
        const row = applyColumnMappingSync(r, columnMapping);
        return row.party_id || row.customer_id;
      }).filter(Boolean)
    )];
    
    if (partyIdsInPayload.length > 0) {
      // Fetch by UUID
      const uuids = (partyIdsInPayload as string[]).filter((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
      const codes = (partyIdsInPayload as string[]).filter((id: string) => !uuids.includes(id));

      const { data: byUuid } = uuids.length > 0 
        ? await supabase.from('parties').select('id, customer_code').in('id', uuids)
        : { data: [] };
      
      const { data: byCode } = codes.length > 0
        ? await supabase.from('parties').select('id, customer_code').in('customer_code', codes)
        : { data: [] };

      const allFound = [...(byUuid || []), ...(byCode || [])];
      allFound.forEach(p => {
        partyIdResolutionMap.set(p.id, p.id);
        if (p.customer_code) partyIdResolutionMap.set(p.customer_code, p.id);
      });
    }

    // NEW: Also resolve contractor_id for grandfathered cases
    if (importType === 'grandfathered_cases') {
      const contractorIds = [...new Set(payload.map((r: any) => r.contractor_id).filter((id: string) => id && id !== 'CONT-UNASSIGNED'))];
      if (contractorIds.length > 0) {
        const { data: contractors } = await supabase.from('parties').select('id, customer_code').in('customer_code', contractorIds as string[]);
        contractors?.forEach(p => {
          if (p.customer_code) partyIdResolutionMap.set(p.customer_code, p.id);
        });
      }
    }
  }

  // NEW: Fetch profiles to match RM names if RM ID is not a UUID
  const profileNameMap = new Map<string, string>(); // name -> id
  if (importType === 'grandfathered_cases') {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name');
    profiles?.forEach(p => {
      profileNameMap.set(p.full_name.toLowerCase(), p.id);
    });
  }

  let processed = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const rawRow of payload) {
    const row = Object.keys(columnMapping).length > 0
      ? await applyColumnMapping(rawRow, columnMapping)
      : rawRow;

    try {
      if (importType === 'party_master') {
        if (row.customer_code) {
          const { error: upsertErr } = await supabase.from('parties').upsert(
            {
              legal_name: row.legal_name,
              customer_code: row.customer_code || null,
              industry_category: row.industry_category || null,
              created_by: user.id,
              is_candidate: false,
              is_active: true,
            },
            { onConflict: 'customer_code', ignoreDuplicates: false }
          );
          if (upsertErr) throw upsertErr;
        } else {
          if (!row.legal_name) throw new Error('Missing legal_name for new party');
          const { data: existing, error: findErr } = await supabase
            .from('parties')
            .select('id')
            .ilike('legal_name', row.legal_name?.trim())
            .limit(1)
            .maybeSingle();
          if (findErr) throw findErr;
          if (existing) {
            throw new Error(`Party "${row.legal_name}" already exists (id: ${existing.id}). Provide a customer_code to update.`);
          }
          const { error: insertErr } = await supabase.from('parties').insert({
            legal_name: row.legal_name,
            customer_code: null,
            industry_category: row.industry_category || null,
            created_by: user.id,
            is_candidate: false,
            is_active: true,
          });
          if (insertErr) throw insertErr;
        }
      } else if (importType === 'historical_exposure') {
        const resolvedId = partyIdResolutionMap.get(row.party_id);
        if (!resolvedId) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID/Code "${row.party_id}" not found in system.`);
        }
        const { error: histErr } = await supabase.from('party_history').insert({
          party_id: resolvedId,
          import_job_id: job.id,
          order_count: parseInt(row.order_count) || 0,
          total_volume: parseFloat(row.total_volume) || 0,
          payment_recency_days: parseInt(row.payment_recency_days) || null,
          average_delay_days: parseFloat(row.average_delay_days) || 0,
          max_delay_days: parseInt(row.max_delay_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString(),
        });
        if (histErr) throw histErr;
      } else if (importType === 'outstanding_exposure') {
        const resolvedId = partyIdResolutionMap.get(row.party_id);
        if (!resolvedId) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID/Code "${row.party_id}" not found in system.`);
        }
        const { error: expErr } = await supabase.from('party_exposure').insert({
          party_id: resolvedId,
          import_job_id: job.id,
          outstanding_amount: parseFloat(row.outstanding_amount) || 0,
          overdue_amount: parseFloat(row.overdue_amount) || 0,
          overdue_days: parseInt(row.overdue_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString(),
        });
        if (expErr) throw expErr;
      } else if (importType === 'parameter_bulk_values') {
        const resolvedId = partyIdResolutionMap.get(row.party_id);
        if (!resolvedId) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID/Code "${row.party_id}" not found in system.`);
        }
        if (!row.parameter_id) throw new Error('Missing parameter_id');
        const { error: valErr } = await supabase.from('party_parameter_values').upsert({
          party_id: resolvedId,
          parameter_id: row.parameter_id,
          grade_value: row.grade_value != null ? parseFloat(row.grade_value) : null,
          raw_input_value: row.raw_input_value || null,
          captured_at: row.captured_at || new Date().toISOString(),
        }, { onConflict: 'party_id,parameter_id' });
        if (valErr) throw valErr;
      } else if (importType === 'grandfathered_cases') {
        const rawPartyId = row.party_id || row.customer_id;
        const resolvedId = partyIdResolutionMap.get(rawPartyId);
        if (!resolvedId) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID/Code "${rawPartyId}" not found in system.`);
        }

        // Resolve Contractor
        const contractorId = row.contractor_id ? partyIdResolutionMap.get(row.contractor_id) : null;

        // Resolve RM — try to match by full name, preserve original name regardless
        const originalRmName = row.rm_name || row.rm_id || null;
        let rmId = row.rm_id || row.rm_user_id;
        if (rmId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rmId)) {
          // It's a custom code/name — try to match by rm_name column
          rmId = profileNameMap.get(row.rm_name?.toLowerCase()) || user.id;
        } else if (!rmId) {
          rmId = user.id;
        }

        // Handle Overdue Days (numeric) vs Date
        let billingDate = row.overdue_date || row.due_date;
        if (billingDate && !isNaN(parseInt(billingDate)) && !billingDate.includes('-')) {
          // It's a number of days, e.g. 165
          const daysAgo = parseInt(billingDate);
          const date = new Date();
          date.setDate(date.getDate() - daysAgo);
          billingDate = date.toISOString();
        } else if (!billingDate) {
          billingDate = new Date().toISOString();
        }
        
        // Create the grandfathered credit case
        // case_attributes stores the original RM name from CSV so it's never lost,
        // even when the RM user account doesn't exist in the system yet.
        const rowIndex = processed + failed; // stable unique index per import job
        const { data: newCase, error: caseErr } = await supabase.from('credit_cases').insert({
          customer_party_id: resolvedId,
          contractor_party_id: contractorId,
          case_scenario: contractorId ? 'customer_name_contractor_pays' : 'customer_name_customer_pays',
          rm_user_id: rmId,
          status: 'Billing Active',
          billing_date: billingDate,
          decided_bill_amount: parseFloat(row.bill_amount || row.outstanding_amount) || 0,
          actual_bill_amount: 0,
          proposed_tranches: [{"type": "percentage", "value": 100, "days_after_billing": 0}],
          // Use job.id prefix + zero-padded index — guaranteed unique, no timestamp collision
          case_number: row.case_number || `GF-${job.id.split('-')[0]}-${String(rowIndex).padStart(4, '0')}`,
          case_attributes: {
            imported: true,
            import_job_id: job.id,
            // Preserve original RM name from CSV for display and future reassignment
            original_rm_name: originalRmName,
            rm_matched: profileNameMap.has(row.rm_name?.toLowerCase()),
          },
        }).select('id').single();
        
        if (caseErr) throw caseErr;
        
        // If remarks are provided, log them as an HQ interaction
        if (row.remarks && newCase) {
           await supabase.from('hq_collection_logs').insert({
             case_id: newCase.id,
             logged_by: user.id,
             message: `Import Remark: ${row.remarks}`
           });
        }
      }

      processed++;
    } catch (e: any) {
      failed++;
      errors.push({ row: rawRow, error: e.message });
    }
  }

  await supabase.from('import_jobs').update({
    status: failed === payload.length ? 'failed' : 'completed',
    records_processed: processed,
    records_failed: failed,
    error_details: errors.length > 0 ? errors : null,
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  await logAuditEvent({
    event_type: 'data_import',
    actor_id: user.id,
    description: `Imported ${processed} records for ${importType}. Failed: ${failed}.`,
  });

  revalidatePath('/admin/imports');
  revalidatePath('/admin');
}

async function applyColumnMapping(
  row: Record<string, any>,
  columnMapping: Record<string, string>
): Promise<Record<string, any>> {
  const mapped: Record<string, any> = {};
  for (const [csvCol, dbField] of Object.entries(columnMapping)) {
    if (row[csvCol] !== undefined) {
      mapped[dbField] = row[csvCol];
    }
  }
  for (const [key, val] of Object.entries(row)) {
    if (mapped[key] === undefined) mapped[key] = val;
  }
  return mapped;
}

function applyColumnMappingSync(
  row: Record<string, any>,
  columnMapping: Record<string, string>
): Record<string, any> {
  const mapped: Record<string, any> = { ...row };
  for (const [csvCol, dbField] of Object.entries(columnMapping)) {
    if (row[csvCol] !== undefined) mapped[dbField] = row[csvCol];
  }
  return mapped;
}
