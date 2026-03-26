import { fetchPartiesWithAliases } from './actions';
import AliasesClient from './AliasesClient';

export default async function AliasesPage() {
  const parties = await fetchPartiesWithAliases();
  return <AliasesClient parties={parties} />;
}