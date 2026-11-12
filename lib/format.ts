export const num = (n: number) => Math.round(n).toLocaleString("en-US");
export const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function untilLabel(ms: number): string {
  if (ms <= 0) return "any minute now";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
