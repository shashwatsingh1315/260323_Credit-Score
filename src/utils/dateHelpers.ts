export function adjustedOverdueDays(storedOverdueDays: number, dataAsOf: string | null): number {
  if (!dataAsOf) return storedOverdueDays;
  const daysSinceImport = Math.floor(
    (Date.now() - new Date(dataAsOf).getTime()) / (1000 * 3600 * 24)
  );
  return storedOverdueDays + Math.max(0, daysSinceImport);
}

export function formatDataFreshness(dataAsOf: string | null): string {
  if (!dataAsOf) return 'Unknown';
  const days = Math.floor((Date.now() - new Date(dataAsOf).getTime()) / (1000 * 3600 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
