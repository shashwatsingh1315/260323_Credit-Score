import { fetchPersonas } from '../actions';
import PersonasClient from './PersonasClient';

export default async function PersonasPage() {
  const personas = await fetchPersonas();
  return <PersonasClient initialPersonas={personas as any[]} />;
}
