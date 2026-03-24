const W = { w1: 0.1, m1: 0.4, m3: 0.3, m6: 0.2 };

export function pct(closes: number[], nDays: number): number | null {
  if (!closes || closes.length < 2) return null;
  const n = Math.min(nDays, closes.length - 1);
  const end = closes[closes.length - 1];
  const start = closes[closes.length - 1 - n];
  if (!start || start === 0) return null;
  return ((end - start) / start) * 100;
}

export type RSBreakdown = {
  score: number;
  rs1w: number;
  rs1m: number;
  rs3m: number;
  rs6m: number;
  r1w: number | null;
  r1m: number | null;
  r3m: number | null;
  r6m: number | null;
  s1w: number | null;
  s1m: number | null;
  s3m: number | null;
  s6m: number | null;
};

export function computeRS(tickerCloses: number[], spyCloses: number[]): RSBreakdown {
  const r1w = pct(tickerCloses, 5);
  const r1m = pct(tickerCloses, 21);
  const r3m = pct(tickerCloses, 63);
  const r6m = pct(tickerCloses, 126);
  const s1w = pct(spyCloses, 5);
  const s1m = pct(spyCloses, 21);
  const s3m = pct(spyCloses, 63);
  const s6m = pct(spyCloses, 126);

  const rs1w = r1w != null && s1w != null ? r1w - s1w : 0;
  const rs1m = r1m != null && s1m != null ? r1m - s1m : 0;
  const rs3m = r3m != null && s3m != null ? r3m - s3m : 0;
  const rs6m = r6m != null && s6m != null ? r6m - s6m : 0;

  const score = W.w1 * rs1w + W.m1 * rs1m + W.m3 * rs3m + W.m6 * rs6m;

  return {
    score,
    rs1w,
    rs1m,
    rs3m,
    rs6m,
    r1w,
    r1m,
    r3m,
    r6m,
    s1w,
    s1m,
    s3m,
    s6m,
  };
}

export function rollingRS(tickerCloses: number[], spyCloses: number[], days = 20): number[] {
  const result: number[] = [];
  for (let offset = days; offset >= 0; offset--) {
    const tSlice = tickerCloses.slice(0, tickerCloses.length - offset || undefined);
    const sSlice = spyCloses.slice(0, spyCloses.length - offset || undefined);
    const rs = computeRS(tSlice, sSlice);
    result.push(rs.score);
  }
  return result;
}

export function getSignal(score: number, rolling: number[]): "BUY" | "SELL" | "HOLD" {
  const trending = rolling.length >= 6 ? rolling[rolling.length - 1] > rolling[rolling.length - 6] : true;
  const trendingDown =
    rolling.length >= 6 ? rolling[rolling.length - 1] < rolling[rolling.length - 6] : false;
  if (score > 5 && trending) return "BUY";
  if (score < -5 && trendingDown) return "SELL";
  return "HOLD";
}

export type RankedTicker = {
  ticker: string;
  closes: number[];
  rs: RSBreakdown;
  signal: "BUY" | "SELL" | "HOLD";
  rolling: number[];
  trending: boolean;
  trendingDown: boolean;
};
