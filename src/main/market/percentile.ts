export function percentile(values: number[], current: number, options: { positiveOnly?: boolean } = {}): number | null {
  const usable = values.filter((value) => Number.isFinite(value) && (!options.positiveOnly || value > 0));
  if (usable.length === 0 || !Number.isFinite(current) || (options.positiveOnly && current <= 0)) return null;
  return usable.filter((value) => value <= current).length / usable.length * 100;
}
