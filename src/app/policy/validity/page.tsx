import { fetchValidityRules, fetchActivePolicy } from '../actions';
import ValidityClient from './ValidityClient';

export default async function ValidityPage() {
  const rules = await fetchValidityRules();
  const activePolicy = await fetchActivePolicy();

  return <ValidityClient rules={rules} activePolicyId={activePolicy?.id} />;
}