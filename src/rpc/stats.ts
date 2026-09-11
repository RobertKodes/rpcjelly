export type Sample = {
  t: number;
  rtt: number;
  slot: number | null;
  status: string;
};

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

export function rolling(samples: Sample[]): { p50: number | null; p90: number | null } {
  const rtts = samples.map((s) => s.rtt);
  return { p50: percentile(rtts, 0.5), p90: percentile(rtts, 0.9) };
}
