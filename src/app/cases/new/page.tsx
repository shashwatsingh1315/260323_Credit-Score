import { fetchParties, fetchKams, fetchEnumerations, fetchActiveRoutingThresholds, fetchCityCodes } from './actions';
import NewCaseForm from './NewCaseForm';

export default async function NewCasePage() {
  const [parties, kams, dealBuckets, routingThresholds, creditReasons, cityCodes] = await Promise.all([
    fetchParties(),
    fetchKams(),
    fetchEnumerations('deal_size_bucket'),
    fetchActiveRoutingThresholds(),
    fetchEnumerations('reason_for_credit'),
    fetchCityCodes(),
  ]);

  const initialSiteDate = new Date().toISOString();

  return (
    <NewCaseForm 
      initialParties={parties} 
      kams={kams} 
      dealBuckets={dealBuckets} 
      routingThresholds={routingThresholds} 
      creditReasons={creditReasons} 
      cityCodes={cityCodes} 
      initialSiteDate={initialSiteDate}
    />
  );
}