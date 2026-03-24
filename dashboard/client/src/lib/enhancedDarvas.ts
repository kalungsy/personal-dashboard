import type { YahooChartRow } from "../api/client";

function sma(arr: number[], period: number): (number | null)[] {
  return arr.map((_, i) => {
    if (i < period - 1) return null;
    const slice = arr.slice(i - period + 1, i + 1).filter((v) => v != null);
    if (slice.length < period) return null;
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function rollingAvg(arr: number[], period: number): (number | null)[] {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - period + 1), i + 1).filter((v) => v != null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

export type EnhancedSignal = {
  date: string;
  signal: "BUY" | "SELL" | "HOLD";
  close: number;
  box_top: number;
  box_bottom: number;
  confidence?: number;
  reason: string;
  vol_ratio: number | null;
};

export type EnhancedResult = {
  ticker: string;
  dates: string[];
  closes: number[];
  volumes: number[];
  sma50: (number | null)[];
  sma20: (number | null)[];
  avgVol20: (number | null)[];
  chartBoxTop: (number | null)[];
  chartBoxBot: (number | null)[];
  currentBoxTop: number | null;
  currentBoxBot: number | null;
  signals: EnhancedSignal[];
  latest: EnhancedSignal | null;
  cooldownLeft: number;
};

function fmtLocal(n: number | null | undefined): string {
  return n != null ? `$${Number(n).toFixed(2)}` : "N/A";
}

export function computeEnhancedDarvas(data: YahooChartRow): EnhancedResult | null {
  const { dates, highs, lows, closes, volumes, ticker } = data;
  const n = closes.length;
  if (n < 55) return null;

  const sma50 = sma(closes, 50);
  const sma20 = sma(closes, 20);
  const avgVol20 = rollingAvg(volumes, 20);

  const dailyBoxTop: (number | null)[] = new Array(n).fill(null);
  const dailyBoxBot: (number | null)[] = new Array(n).fill(null);
  const signals: EnhancedSignal[] = [];

  let boxCeiling: number | null = null;
  let boxFloor: number | null = null;
  let candidateCeiling: number | null = null;
  let candidateDays = 0;
  const BOX_CONFIRM = 3;
  const COOLDOWN = 10;
  let cooldownLeft = 0;
  let inBox = false;

  for (let i = 1; i < n; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i];
    const av = avgVol20[i];
    const trendOk = sma50[i] != null && c > (sma50[i] as number);
    const volOk = av != null && v > 1.2 * (av as number);
    const volRatio = av ? v / av : null;

    if (cooldownLeft > 0) cooldownLeft--;

    if (candidateCeiling === null) {
      candidateCeiling = h;
      candidateDays = 1;
    } else {
      if (h > candidateCeiling * 1.01) {
        candidateCeiling = h;
        candidateDays = 1;
      } else if (Math.abs(h - candidateCeiling) / candidateCeiling <= 0.01) {
        candidateDays++;
        candidateCeiling = Math.max(candidateCeiling, h);
      } else {
        candidateDays++;
      }
    }

    const ceilingReady = candidateDays >= BOX_CONFIRM;

    if (ceilingReady && boxCeiling === null) {
      boxCeiling = candidateCeiling;
      const lookback = Math.max(0, i - 20);
      let floor = lows[i];
      for (let k = lookback; k <= i; k++) {
        if (lows[k] < floor && highs[k] <= (boxCeiling as number) * 1.01) floor = lows[k];
      }
      boxFloor = floor;
      inBox = true;
    }

    if (inBox && boxCeiling !== null && boxFloor !== null) {
      if (l < boxFloor) boxFloor = l;
    }

    if (inBox && boxCeiling !== null && boxFloor !== null) {
      if (c > boxCeiling) {
        if (trendOk && volOk && cooldownLeft === 0) {
          const spread = (boxCeiling - boxFloor) / boxFloor;
          let conf = 0;
          if (spread <= 0.03) conf += 2;
          else if (spread <= 0.05) conf += 1;
          if (volRatio && volRatio >= 1.5) conf += 2;
          else if (volRatio && volRatio >= 1.2) conf += 1;
          if (trendOk) conf += 1;
          conf = Math.max(1, Math.min(5, conf));

          const reason = `Price (${fmtLocal(c)}) broke ABOVE box ceiling (${fmtLocal(boxCeiling)}). Volume ${(volRatio ?? 0).toFixed(2)}x avg. Above 50d SMA.`;
          signals.push({
            date: dates[i],
            signal: "BUY",
            close: c,
            box_top: boxCeiling,
            box_bottom: boxFloor,
            confidence: conf,
            reason,
            vol_ratio: volRatio,
          });
          dailyBoxTop[i] = boxCeiling;
          dailyBoxBot[i] = boxFloor;
          boxCeiling = null;
          boxFloor = null;
          inBox = false;
          candidateCeiling = h;
          candidateDays = 1;
        } else {
          let reason = `Price (${fmtLocal(c)}) above ceiling (${fmtLocal(boxCeiling)}) but`;
          const suppress: string[] = [];
          if (!trendOk) suppress.push("below 50d SMA");
          if (!volOk) suppress.push(`low volume (${volRatio ? volRatio.toFixed(2) + "x" : "N/A"})`);
          if (cooldownLeft > 0) suppress.push(`cooldown (${cooldownLeft} days left)`);
          reason += " " + suppress.join(", ") + ".";
          signals.push({
            date: dates[i],
            signal: "HOLD",
            close: c,
            box_top: boxCeiling,
            box_bottom: boxFloor,
            confidence: 1,
            reason,
            vol_ratio: volRatio,
          });
          dailyBoxTop[i] = boxCeiling;
          dailyBoxBot[i] = boxFloor;
        }
      } else if (c < boxFloor) {
        const reason = `Price (${fmtLocal(c)}) broke BELOW box floor (${fmtLocal(boxFloor)}). Exiting position.`;
        signals.push({
          date: dates[i],
          signal: "SELL",
          close: c,
          box_top: boxCeiling,
          box_bottom: boxFloor,
          confidence: 3,
          reason,
          vol_ratio: volRatio,
        });
        dailyBoxTop[i] = boxCeiling;
        dailyBoxBot[i] = boxFloor;
        cooldownLeft = COOLDOWN;
        boxCeiling = null;
        boxFloor = null;
        inBox = false;
        candidateCeiling = h;
        candidateDays = 1;
      } else {
        dailyBoxTop[i] = boxCeiling;
        dailyBoxBot[i] = boxFloor;
      }
    }
  }

  const latest = signals.length > 0 ? signals[signals.length - 1] : null;

  let runTop: number | null = null;
  let runBot: number | null = null;
  const chartBoxTop: (number | null)[] = new Array(n).fill(null);
  const chartBoxBot: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (dailyBoxTop[i] !== null) {
      runTop = dailyBoxTop[i];
      runBot = dailyBoxBot[i];
    }
    chartBoxTop[i] = runTop;
    chartBoxBot[i] = runBot;
  }

  let currentBoxTop: number | null = null;
  let currentBoxBot: number | null = null;
  for (let i = n - 1; i >= 0; i--) {
    if (chartBoxTop[i] !== null) {
      currentBoxTop = chartBoxTop[i];
      currentBoxBot = chartBoxBot[i];
      break;
    }
  }

  return {
    ticker,
    dates,
    closes,
    volumes,
    sma50,
    sma20,
    avgVol20,
    chartBoxTop,
    chartBoxBot,
    currentBoxTop,
    currentBoxBot,
    signals,
    latest,
    cooldownLeft,
  };
}
