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

  let validPartyIds = new Set<string>();
  if (['historical_exposure', 'outstanding_exposure', 'parameter_bulk_values', 'grandfathered_cases'].includes(importType)) {
    const partyIdsInPayload = [...new Set(
      payload.map((r: any) => applyColumnMappingSync(r, columnMapping)['party_id']).filter(Boolean)
    )];
    if (partyIdsInPayload.length > 0) {
      const { data: existingParties } = await supabase
        .from('parties')
        .select('id')
        .in('id', partyIdsInPayload as string[]);
      validPartyIds = new Set((existingParties || []).map((p: any) => p.id));
    }
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
          await supabase.from('parties').upsert(
            {
              legal_name: row.legal_name,
              customer_code: row.customer_code || null,
              industry_category: row.industry_category || null,
              created_by: user.id,
              is_candidate: false,
            },
            { onConflict: 'customer_code', ignoreDuplicates: false }
          );
        } else {
          const { data: existing } = await supabase
            .from('parties')
            .select('id')
            .ilike('legal_name', row.legal_name?.trim())
            .limit(1)
            .maybeSingle();
          if (existing) {
            throw new Error(`Party "${row.legal_name}" already exists (id: ${existing.id}). Provide a customer_code to update.`);
          }
          await supabase.from('parties').insert({
            legal_name: row.legal_name,
            customer_code: null,
            industry_category: row.industry_category || null,
            created_by: user.id,
            is_candidate: false,
          });
        }
      } else if (importType === 'historical_exposure') {
        if (!row.party_id) {
          if (ignoreMissing) continue;
          throw new Error('Missing party_id');
        }
        if (!validPartyIds.has(row.party_id)) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID "${row.party_id}" not found in system. Please use a valid UUID from Party Master.`);
        }
        await supabase.from('party_history').insert({
          party_id: row.party_id,
          import_job_id: job.id,
          order_count: parseInt(row.order_count) || 0,
          total_volume: parseFloat(row.total_volume) || 0,
          payment_recency_days: parseInt(row.payment_recency_days) || null,
          average_delay_days: parseFloat(row.average_delay_days) || 0,
          max_delay_days: parseInt(row.max_delay_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString(),
        });
      } else if (importType === 'outstanding_exposure') {
        if (!row.party_id) {
          if (ignoreMissing) continue;
          throw new Error('Missing party_id');
        }
        if (!validPartyIds.has(row.party_id)) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID "${row.party_id}" not found in system. Please use a valid UUID from Party Master.`);
        }
        await supabase.from('party_exposure').insert({
          party_id: row.party_id,
          import_job_id: job.id,
          outstanding_amount: parseFloat(row.outstanding_amount) || 0,
          overdue_amount: parseFloat(row.overdue_amount) || 0,
          overdue_days: parseInt(row.overdue_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString(),
        });
      } else if (importType === 'parameter_bulk_values') {
        if (!row.party_id) {
          if (ignoreMissing) continue;
          throw new Error('Missing party_id');
        }
        if (!row.parameter_id) throw new Error('Missing parameter_id');
        if (!validPartyIds.has(row.party_id)) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID "${row.party_id}" not found in system. Please use a valid UUID from Party Master.`);
        }
        await supabase.from('party_parameter_values').upsert({
          party_id: row.party_id,
          parameter_id: row.parameter_id,
          grade_value: row.grade_value != null ? parseFloat(row.grade_value) : null,
          raw_input_value: row.raw_input_value || null,
          captured_at: row.captured_at || new Date().toISOString(),
        }, { onConflict: 'party_id,parameter_id' });
      } else if (importType === 'grandfathered_cases') {
        const partyId = row.party_id || row.customer_id;
        if (!partyId) {
          if (ignoreMissing) continue;
          throw new Error('Missing party_id or customer_id');
        }
        if (!validPartyIds.has(partyId)) {
          if (ignoreMissing) continue;
          throw new Error(`Party ID "${partyId}" not found in parties table`);
        }
        
        // Create the grandfathered credit case
        const { data: newCase, error: caseErr } = await supabase.from('credit_cases').insert({
          customer_party_id: partyId,
          rm_user_id: row.rm_user_id || null,
          status: 'Billing Active',
          billing_date: row.overdue_date || row.due_date || new Date().toISOString(),
          decided_bill_amount: parseFloat(row.bill_amount || row.outstanding_amount) || 0,
          actual_bill_amount: 0,
          proposed_tranches: [{"type": "percentage", "value": 100, "days_after_billing": 0}],
          case_number: row.case_number || `GF-${Date.now()}`
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
