export const RSI_PERIOD = 14;
export const SMA_PERIOD = 20;
export const CHART_DAYS = 60;

export function calcRSI(closes: number[]): (number | null)[] {
  if (closes.length < RSI_PERIOD + 1) return new Array(closes.length).fill(null);
  const rsi: (number | null)[] = new Array(closes.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= RSI_PERIOD; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= RSI_PERIOD;
  avgLoss /= RSI_PERIOD;
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[RSI_PERIOD] = 100 - 100 / (1 + rs0);

  for (let i = RSI_PERIOD + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d >= 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (RSI_PERIOD - 1) + gain) / RSI_PERIOD;
    avgLoss = (avgLoss * (RSI_PERIOD - 1) + loss) / RSI_PERIOD;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
}

export function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export type RSISignalPoint = { idx: number; type: "BUY" | "SELL"; rsi: number; price: number };

export function detectSignals(
  rsi: (number | null)[],
  sma: (number | null)[],
  closes: number[],
): RSISignalPoint[] {
  const signals: RSISignalPoint[] = [];
  for (let i = 1; i < rsi.length; i++) {
    if (rsi[i] === null || rsi[i - 1] === null || sma[i] === null) continue;
    const ri = rsi[i] as number;
    const rim1 = rsi[i - 1] as number;
    const sm = sma[i] as number;
    if (rim1 < 30 && ri >= 30 && closes[i] > sm) {
      signals.push({ idx: i, type: "BUY", rsi: ri, price: closes[i] });
    } else if (rim1 >= 70 && ri < 70 && closes[i] < sm) {
      signals.push({ idx: i, type: "SELL", rsi: ri, price: closes[i] });
    }
  }
  return signals;
}

export function getCurrentSignal(
  rsi: (number | null)[],
  sma: (number | null)[],
  closes: number[],
  signals: RSISignalPoint[],
): "BUY" | "SELL" | "HOLD" {
  const lastRSI = rsi.length > 0 ? rsi[rsi.length - 1] : null;
  const lastSMA = sma.length > 0 ? sma[sma.length - 1] : null;
  const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
  const lastSignal = signals.length > 0 ? signals[signals.length - 1] : null;

  if (lastRSI == null || lastSMA == null || lastClose == null) return "HOLD";
  if (lastRSI < 30) return "BUY";
  if (lastRSI > 70) return "SELL";
  if (lastSignal && lastSignal.type === "BUY" && lastRSI < 50) return "BUY";
  return "HOLD";
}

export function getRSIZone(rsiVal: number | null): { label: string; cls: string } {
  if (rsiVal == null) return { label: "No Data", cls: "zone-neutral" };
  if (rsiVal < 30) return { label: "Oversold", cls: "zone-oversold" };
  if (rsiVal < 50) return { label: "Recovering", cls: "zone-recovering" };
  if (rsiVal <= 70) return { label: "Neutral / Bullish", cls: "zone-neutral" };
  return { label: "Overbought", cls: "zone-overbought" };
}

export type HistoryRow = {
  date: Date;
  type: "BUY" | "SELL";
  rsiAtSignal: number;
  price: number;
  outcomePct: number | null;
  outcome: "open" | "closed";
};

export function buildSignalHistory(
  signals: RSISignalPoint[],
  dates: Date[],
  closes: number[],
): HistoryRow[] {
  return signals
    .map((sig) => {
      const entryDate = dates[sig.idx];
      const entryPrice = sig.price;
      let outcome: "open" | "closed" = "open";
      let outcomePct: number | null = null;

      if (sig.type === "BUY") {
        const nextSell = signals.find((s) => s.type === "SELL" && s.idx > sig.idx);
        if (nextSell) {
          outcomePct = ((nextSell.price - entryPrice) / entryPrice) * 100;
          outcome = "closed";
        } else {
          const currentPrice = closes[closes.length - 1];
          outcomePct = ((currentPrice - entryPrice) / entryPrice) * 100;
          outcome = "open";
        }
      } else {
        const nextBuy = signals.find((s) => s.type === "BUY" && s.idx > sig.idx);
        if (nextBuy) {
          outcomePct = ((entryPrice - nextBuy.price) / entryPrice) * 100;
          outcome = "closed";
        } else {
          const currentPrice = closes[closes.length - 1];
          outcomePct = ((entryPrice - currentPrice) / entryPrice) * 100;
          outcome = "open";
        }
      }

      return {
        date: entryDate,
        type: sig.type,
        rsiAtSignal: sig.rsi,
        price: entryPrice,
        outcomePct,
        outcome,
      };
    })
    .reverse();
}

export function daysSinceSignal(signal: RSISignalPoint | undefined, dates: Date[]): number | null {
  if (!signal) return null;
  const signalDate = dates[signal.idx];
  const today = new Date();
  return Math.floor((today.getTime() - signalDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function maxDrawdownFromBuy(signals: RSISignalPoint[], closes: number[]): number | null {
  const lastBuy = [...signals].reverse().find((s) => s.type === "BUY");
  if (!lastBuy) return null;
  const subset = closes.slice(lastBuy.idx);
  const peak = Math.max(...subset);
  const trough = Math.min(...subset);
  return ((trough - peak) / peak) * 100;
}

export function gainFromLastBuy(signals: RSISignalPoint[], closes: number[]): number | null {
  const lastBuy = [...signals].reverse().find((s) => s.type === "BUY");
  if (!lastBuy) return null;
  const currentPrice = closes[closes.length - 1];
  return ((currentPrice - lastBuy.price) / lastBuy.price) * 100;
}
