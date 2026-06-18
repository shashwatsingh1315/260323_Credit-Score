import { fetchGradeScales } from '../actions';
import GradesClient from './GradesClient';

export default async function GradesPage() {
  const scales = await fetchGradeScales();
  return <GradesClient initialGrades={scales as any[]} />;  // eslint-disable-line @typescript-eslint/no-explicit-any
}
