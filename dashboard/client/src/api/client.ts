import type { SignalsFile } from "../types/signals";

const base = () => (import.meta.env.VITE_API_BASE as string | undefined) || "";

export type YahooChartRow = {
  ticker: string;
  dates: string[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
};

/** Daily history length from Yahoo; 2y ≈ 500 trading days (enough for 50d SMA + long charts). */
export const DEFAULT_CHART_RANGE = "2y";

export async function fetchChart(ticker: string, range = DEFAULT_CHART_RANGE): Promise<YahooChartRow> {
  const r = await fetch(`${base()}/api/chart/${encodeURIComponent(ticker)}?range=${range}`);
  if (!r.ok) throw new Error(`${ticker}: HTTP ${r.status}`);
  return r.json();
}

export async function fetchCloses(ticker: string): Promise<number[]> {
  const r = await fetch(`${base()}/api/closes/${encodeURIComponent(ticker)}?range=${DEFAULT_CHART_RANGE}`);
  if (!r.ok) throw new Error(`${ticker}: HTTP ${r.status}`);
  const j = await r.json();
  return j.closes as number[];
}

export async function fetchSignals(): Promise<SignalsFile> {
  const r = await fetch(`${base()}/api/signals`);
  if (!r.ok) throw new Error(`signals: HTTP ${r.status}`);
  return r.json();
}
