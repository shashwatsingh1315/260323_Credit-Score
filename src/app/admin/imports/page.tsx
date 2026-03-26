import { fetchImportJobs } from './actions';
import ImportsClient from './ImportsClient';

export default async function ImportsPage() {
  const jobs = await fetchImportJobs();
  return <ImportsClient jobs={jobs} />;
}