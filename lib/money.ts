export function formatCents(
  cents: number | null | undefined,
  { decimals = 2 }: { decimals?: number } = {},
): string {
  if (cents === null || cents === undefined) return "—";
  const value = cents / 100;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatCentsCompact(
  cents: number | null | undefined,
): string {
  if (cents === null || cents === undefined) return "—";
  const value = Math.round(cents / 100);
  return `$${value.toLocaleString()}`;
}

export function formatPercentRate(
  rate: number | null | undefined,
): string {
  if (rate === null || rate === undefined) return "—";
  return `${(rate * 100).toFixed(2).replace(/\.00$/, "")}%`;
}
