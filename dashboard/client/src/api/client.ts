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

export async function fetchChart(ticker: string, range = "6mo"): Promise<YahooChartRow> {
  const r = await fetch(`${base()}/api/chart/${encodeURIComponent(ticker)}?range=${range}`);
  if (!r.ok) throw new Error(`${ticker}: HTTP ${r.status}`);
  return r.json();
}

export async function fetchCloses(ticker: string): Promise<number[]> {
  const r = await fetch(`${base()}/api/closes/${encodeURIComponent(ticker)}?range=6mo`);
  if (!r.ok) throw new Error(`${ticker}: HTTP ${r.status}`);
  const j = await r.json();
  return j.closes as number[];
}

export async function fetchSignals(): Promise<SignalsFile> {
  const r = await fetch(`${base()}/api/signals`);
  if (!r.ok) throw new Error(`signals: HTTP ${r.status}`);
  return r.json();
}
