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

  // 1. Create Job Record
  const { data: job, error: jobErr } = await supabase.from('import_jobs').insert({
    imported_by: user.id,
    import_type: importType,
    status: 'processing',
    records_total: payload.length
  }).select().single();

  if (jobErr) throw jobErr;

  let processed = 0;
  let failed = 0;
  const errors: any[] = [];

  // 2. Process records (Simulated batch insert for V1)
  // In a real production system, this would queue to a background worker.
  for (const row of payload) {
    try {
      if (importType === 'party_master') {
        await supabase.from('parties').insert({
          legal_name: row.legal_name,
          customer_code: row.customer_code || null,
          industry_category: row.industry_category || null,
          created_by: user.id,
          is_candidate: false
        });
      } else if (importType === 'historical_exposure') {
        if (!row.party_id) throw new Error('Missing party_id');
        await supabase.from('party_history').insert({
          party_id: row.party_id,
          import_job_id: job.id,
          order_count: parseInt(row.order_count) || 0,
          total_volume: parseFloat(row.total_volume) || 0,
          payment_recency_days: parseInt(row.payment_recency_days) || null,
          average_delay_days: parseFloat(row.average_delay_days) || 0,
          max_delay_days: parseInt(row.max_delay_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString()
        });
      } else if (importType === 'outstanding_exposure') {
        if (!row.party_id) throw new Error('Missing party_id');
        await supabase.from('party_exposure').insert({
          party_id: row.party_id,
          import_job_id: job.id,
          outstanding_amount: parseFloat(row.outstanding_amount) || 0,
          overdue_amount: parseFloat(row.overdue_amount) || 0,
          overdue_days: parseInt(row.overdue_days) || 0,
          data_as_of: row.data_as_of || new Date().toISOString()
        });
      }
      processed++;
    } catch (e: any) {
      failed++;
      errors.push({ row, error: e.message });
    }
  }

  // 3. Finalize Job
  await supabase.from('import_jobs').update({
    status: failed === payload.length ? 'failed' : 'completed',
    records_processed: processed,
    records_failed: failed,
    error_details: errors.length > 0 ? errors : null,
    completed_at: new Date().toISOString()
  }).eq('id', job.id);

  await logAuditEvent({
    event_type: 'data_import',
    actor_id: user.id,
    description: `Imported ${processed} records for ${importType}. Failed: ${failed}.`
  });

  revalidatePath('/admin/imports');
}
