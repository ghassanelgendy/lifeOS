import { startOfWeek, parseISO, format } from 'date-fns';

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function sum(nums?: Array<number | null | undefined>): number {
  return (nums ?? []).map((v) => Number(v) || 0).reduce((acc, v) => acc + v, 0);
}

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 10) return `${Math.round(s / 3600)}h`;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.floor(min || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h >= 10) return `${Math.round(m / 60)}h`;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

export function regressionSlope(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  return num / den;
}

export function regressionIntercept(xs: number[], ys: number[], slope: number): number {
  const mx = mean(xs);
  const my = mean(ys);
  return my - slope * mx;
}

export function addDaysYmd(ymd: string, days: number): string | null {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(endD.getTime())) return out;
  while (d <= endD) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function quantile(xs: number[], q: number): number | null {
  if (xs.length === 0) return null;
  const sorted = xs.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * clamp(q, 0, 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base] == null) return null;
  if (sorted[base + 1] == null) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

/** Group data into weeks and calculate averages per week */
export function aggregateWeekly<T extends { date: string }>(
  data: T[],
  extractFn: (item: T) => number | null
): { weekLabel: string; average: number; total: number }[] {
  if (!data || data.length === 0) return [];
  
  const byWeek = new Map<string, number[]>();
  
  for (const item of data) {
    const val = extractFn(item);
    if (val == null || !Number.isFinite(val)) continue;
    
    // We group by week starting on Monday
    const d = parseISO(item.date);
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const label = format(start, 'MMM d');
    
    const arr = byWeek.get(label) ?? [];
    arr.push(val);
    byWeek.set(label, arr);
  }
  
  return Array.from(byWeek.entries()).map(([weekLabel, values]) => ({
    weekLabel,
    average: mean(values),
    total: sum(values)
  }));
}
