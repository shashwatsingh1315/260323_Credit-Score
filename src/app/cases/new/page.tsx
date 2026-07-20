import { fetchParties, fetchKams, fetchEnumerations, fetchActiveRoutingThresholds, fetchCityCodes, fetchGradeScale } from './actions';
import NewCaseForm from './NewCaseForm';

export default async function NewCasePage() {
  const [parties, kams, routingThresholds, creditReasons, cityCodes, gradeScale] = await Promise.all([
    fetchParties(),
    fetchKams(),
    fetchActiveRoutingThresholds(),
    fetchEnumerations('reason_for_credit'),
    fetchCityCodes(),
    fetchGradeScale(),
  ]);

  const initialSiteDate = new Date().toISOString();

  return (
    <NewCaseForm
      initialParties={parties}
      kams={kams}
      routingThresholds={routingThresholds}
      creditReasons={creditReasons}
      cityCodes={cityCodes}
      initialSiteDate={initialSiteDate}
      gradeScale={gradeScale}
    />
  );
}
