import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  const filePath = 'grandfathered_cases_template (1).csv';
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const payload = parse(fileContent, { columns: true, skip_empty_lines: true });

  let partyIdResolutionMap = new Map();
  let profileNameMap = new Map();

  const partyIdsInPayload = [...new Set(payload.map(r => r.party_id || r.customer_id).filter(Boolean))];
  if (partyIdsInPayload.length > 0) {
    const uuids = partyIdsInPayload.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    const codes = partyIdsInPayload.filter(id => !uuids.includes(id));
    let allFound = [];
    if (uuids.length > 0) {
      const { data } = await supabase.from('parties').select('id, customer_code').in('id', uuids);
      if (data) allFound.push(...data);
    }
    if (codes.length > 0) {
      const { data } = await supabase.from('parties').select('id, customer_code').in('customer_code', codes);
      if (data) allFound.push(...data);
    }
    allFound.forEach(p => {
      partyIdResolutionMap.set(p.id, p.id);
      if (p.customer_code) partyIdResolutionMap.set(p.customer_code, p.id);
    });
  }

  const contractorIds = [...new Set(payload.map(r => r.contractor_id).filter(id => id && id !== 'CONT-UNASSIGNED'))];
  if (contractorIds.length > 0) {
    const { data: contractors } = await supabase.from('parties').select('id, customer_code').in('customer_code', contractorIds);
    contractors?.forEach(p => {
      if (p.customer_code) partyIdResolutionMap.set(p.customer_code, p.id);
    });
  }

  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  profiles?.forEach(p => {
    profileNameMap.set(p.full_name.toLowerCase(), p.id);
  });

  let errorCategories = {
    missingParties: 0,
    missingContractors: 0,
    missingRMs: 0,
    invalidDates: 0
  };

  for (let i = 0; i < payload.length; i++) {
    const row = payload[i];
    const rawPartyId = row.party_id || row.customer_id;
    if (!partyIdResolutionMap.has(rawPartyId)) errorCategories.missingParties++;

    if (row.contractor_id && row.contractor_id !== 'CONT-UNASSIGNED') {
      if (!partyIdResolutionMap.has(row.contractor_id)) errorCategories.missingContractors++;
    }

    let rmId = row.rm_id || row.rm_user_id;
    if (rmId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rmId)) {
      if (!profileNameMap.has(row.rm_name?.toLowerCase())) errorCategories.missingRMs++;
    }

    let billingDate = row.overdue_date || row.due_date;
    if (billingDate && !isNaN(parseInt(billingDate)) && !billingDate.includes('-')) {
    } else if (!billingDate) {
    } else if (isNaN(Date.parse(billingDate))) {
      errorCategories.invalidDates++;
    }
  }

  console.log('--- ERROR CATEGORY SUMMARY ---');
  console.log(`Total Rows: ${payload.length}`);
  console.log(`Missing Parties (CRITICAL - will fail row): ${errorCategories.missingParties}`);
  console.log(`Missing Contractors (Ignored/null): ${errorCategories.missingContractors}`);
  console.log(`Unmatched RM Names (Defaults to uploader): ${errorCategories.missingRMs}`);
  console.log(`Invalid Dates (Defaults to today): ${errorCategories.invalidDates}`);
}

runTest().catch(console.error);
