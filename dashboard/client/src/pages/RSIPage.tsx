import { useCallback, useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { TICKERS } from "../constants";
import { fetchChart } from "../api/client";
import { rsiShadingPlugin } from "../lib/rsiChartPlugin";
import {
  CHART_DAYS,
  SMA_PERIOD,
  buildSignalHistory,
  calcRSI,
  calcSMA,
  daysSinceSignal,
  detectSignals,
  gainFromLastBuy,
  getCurrentSignal,
  getRSIZone,
  maxDrawdownFromBuy,
  type RSISignalPoint,
} from "../lib/rsi";
import { fmt } from "../lib/format";

type Panel = {
  ticker: string;
  rsi: (number | null)[];
  sma: (number | null)[];
  closes: number[];
  dates: Date[];
  signals: RSISignalPoint[];
  currentSignal: string;
  lastRSI: number | null;
  zone: { label: string; cls: string };
  daysSince: number | null;
  drawdown: number | null;
  gain: number | null;
  history: ReturnType<typeof buildSignalHistory>;
};

function analyzeTicker(
  ticker: string,
  rows: { date: string; close: number; high: number; low: number; open: number; volume: number }[],
): Panel | null {
  const closes = rows.map((d) => d.close);
  const dates = rows.map((d) => new Date(d.date + "T12:00:00"));
  const rsi = calcRSI(closes);
  const sma = calcSMA(closes, SMA_PERIOD);
  const signals = detectSignals(rsi, sma, closes);
  const currentSignal = getCurrentSignal(rsi, sma, closes, signals);
  const lastRSI = rsi.length > 0 ? rsi[rsi.length - 1] : null;
  const zone = getRSIZone(lastRSI);
  const lastBuySignal = [...signals].reverse().find((s) => s.type === "BUY");
  const daysSince = daysSinceSignal(lastBuySignal, dates);
  const drawdown = maxDrawdownFromBuy(signals, closes);
  const gain = gainFromLastBuy(signals, closes);
  const history = buildSignalHistory(signals, dates, closes);
  return {
    ticker,
    rsi,
    sma,
    closes,
    dates,
    signals,
    currentSignal,
    lastRSI,
    zone,
    daysSince,
    drawdown,
    gain,
    history,
  };
}

function RSICharts({ p }: { p: Panel }) {
  const n = Math.min(CHART_DAYS, p.dates.length);
  const slicedDates = p.dates.slice(-n);
  const slicedRSI = p.rsi.slice(-n);
  const slicedCloses = p.closes.slice(-n);
  const slicedSMA = p.sma.slice(-n);
  const startIdx = p.dates.length - n;

  const labels = slicedDates.map((d) => `${d.getMonth() + 1}/${d.getDate()}`);

  const buyPoints = slicedRSI.map((_, i) => {
    const g = startIdx + i;
    const sig = p.signals.find((s) => s.idx === g && s.type === "BUY");
    return sig ? sig.rsi : null;
  });
  const sellPoints = slicedRSI.map((_, i) => {
    const g = startIdx + i;
    const sig = p.signals.find((s) => s.idx === g && s.type === "SELL");
    return sig ? sig.rsi : null;
  });

  const buyPrice = slicedCloses.map((_, i) => {
    const g = startIdx + i;
    const sig = p.signals.find((s) => s.idx === g && s.type === "BUY");
    return sig ? sig.price : null;
  });
  const sellPrice = slicedCloses.map((_, i) => {
    const g = startIdx + i;
    const sig = p.signals.find((s) => s.idx === g && s.type === "SELL");
    return sig ? sig.price : null;
  });

  const rsiData = {
    labels,
    datasets: [
      {
        label: "RSI",
        data: slicedRSI,
        borderColor: "#a78bfa",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        order: 1,
      },
      {
        label: "BUY",
        data: buyPoints,
        borderColor: "#0d3d22",
        backgroundColor: "#26c96c",
        pointRadius: 7,
        pointHoverRadius: 9,
        pointBorderWidth: 1.5,
        pointBorderColor: "rgba(15,23,42,0.9)",
        pointStyle: "triangle" as const,
        fill: false,
        showLine: false,
        order: 10,
      },
      {
        label: "SELL",
        data: sellPoints,
        borderColor: "#5c1614",
        backgroundColor: "#ef5350",
        pointRadius: 7,
        pointHoverRadius: 9,
        pointBorderWidth: 1.5,
        pointBorderColor: "rgba(15,23,42,0.9)",
        pointStyle: "rectRot" as const,
        fill: false,
        showLine: false,
        order: 11,
      },
    ],
  };

  const priceData = {
    labels,
    datasets: [
      {
        label: "Price",
        data: slicedCloses,
        borderColor: "#60a5fa",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        order: 1,
      },
      {
        label: "20d SMA",
        data: slicedSMA,
        borderColor: "#fbbf24",
        borderWidth: 1.5,
        borderDash: [4, 3] as number[],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        order: 2,
      },
      {
        label: "BUY",
        data: buyPrice,
        borderColor: "#0d3d22",
        backgroundColor: "#26c96c",
        pointRadius: 7,
        pointHoverRadius: 9,
        pointBorderWidth: 1.5,
        pointBorderColor: "rgba(15,23,42,0.9)",
        pointStyle: "triangle" as const,
        fill: false,
        showLine: false,
        order: 10,
      },
      {
        label: "SELL",
        data: sellPrice,
        borderColor: "#5c1614",
        backgroundColor: "#ef5350",
        pointRadius: 7,
        pointHoverRadius: 9,
        pointBorderWidth: 1.5,
        pointBorderColor: "rgba(15,23,42,0.9)",
        pointStyle: "rectRot" as const,
        fill: false,
        showLine: false,
        order: 11,
      },
    ],
  };

  const common = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    scales: {
      x: {
        ticks: { color: "#94a3b8", maxTicksLimit: 8, font: { size: 10 } },
        grid: { color: "rgba(45,63,94,0.4)" },
      },
    },
  };

  return (
    <div className="charts-row">
      <div className="chart-card">
        <div className="chart-header">
          <div className="chart-title">RSI (14) — Last 60 Days</div>
        </div>
        <div className="chart-canvas-wrap">
          <Line
            key={`rsi-${p.ticker}`}
            plugins={[rsiShadingPlugin]}
            data={rsiData}
            options={{
              ...common,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: "#1e293b",
                  borderColor: "#2d3f5e",
                  borderWidth: 1,
                  callbacks: {
                    label: (ctx: { datasetIndex: number; raw: unknown }) => {
                      if (ctx.datasetIndex !== 0) return "";
                      return ` RSI: ${ctx.raw !== null && ctx.raw !== undefined ? Number(ctx.raw).toFixed(1) : "—"}`;
                    },
                  },
                },
              },
              scales: {
                ...common.scales,
                y: {
                  min: 0,
                  max: 100,
                  ticks: { color: "#94a3b8", font: { size: 10 } },
                  grid: { color: "rgba(45,63,94,0.4)" },
                },
              },
            }}
          />
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-header">
          <div className="chart-title">Price + 20d SMA — Last 60 Days</div>
        </div>
        <div className="chart-canvas-wrap">
          <Line
            key={`px-${p.ticker}`}
            data={priceData}
            options={{
              ...common,
              plugins: {
                legend: {
                  display: true,
                  position: "top" as const,
                  labels: { color: "#94a3b8", font: { size: 10 }, boxWidth: 12, padding: 8 },
                },
                tooltip: {
                  backgroundColor: "#1e293b",
                  borderColor: "#2d3f5e",
                  borderWidth: 1,
                  callbacks: {
                    label: (ctx: { datasetIndex: number; raw: unknown }) => {
                      if (ctx.datasetIndex === 0)
                        return ` Price: $${ctx.raw != null ? Number(ctx.raw).toFixed(2) : "—"}`;
                      if (ctx.datasetIndex === 1)
                        return ` SMA20: $${ctx.raw != null ? Number(ctx.raw).toFixed(2) : "—"}`;
                      return "";
                    },
                  },
                },
              },
              scales: {
                ...common.scales,
                y: {
                  ticks: {
                    color: "#94a3b8",
                    font: { size: 10 },
                    callback: (v: string | number) => "$" + Number(v).toFixed(0),
                  },
                  grid: { color: "rgba(45,63,94,0.4)" },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function RSIPage() {
  const [panels, setPanels] = useState<Record<string, Panel | "err" | null>>({});
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>(TICKERS[0]);

  const load = useCallback(async () => {
    setLoading(true);
    const next: Record<string, Panel | "err" | null> = {};
    await Promise.all(
      TICKERS.map(async (t) => {
        try {
          const chart = await fetchChart(t);
          const rows = chart.dates.map((date, i) => ({
            date,
            close: chart.closes[i],
            high: chart.highs[i],
            low: chart.lows[i],
            open: chart.opens[i],
            volume: chart.volumes[i],
          }));
          const panel = analyzeTicker(t, rows);
          next[t] = panel;
        } catch {
          next[t] = "err";
        }
      }),
    );
    setPanels(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    let oversold = 0;
    let overbought = 0;
    const activeBuys: string[] = [];
    for (const t of TICKERS) {
      const p = panels[t];
      if (!p || p === "err") continue;
      if (p.lastRSI != null && p.lastRSI < 30) oversold++;
      if (p.lastRSI != null && p.lastRSI > 70) overbought++;
      if (p.currentSignal === "BUY") activeBuys.push(t);
    }
    return { oversold, overbought, activeBuys };
  }, [panels]);

  return (
    <div className="rsi-page">
      <div className="page-header">
        <div className="header-row">
          <h1>RSI Mean Reversion Dashboard</h1>
          <button type="button" className="refresh-btn" disabled={loading} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="summary-section">
        <h2 className="chart-title" style={{ marginBottom: 16, color: "var(--text)" }}>
          Market summary
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div className="stat-card">
            <div className="count-num neg">{summary.oversold}</div>
            <div className="count-lbl">Oversold (RSI &lt; 30)</div>
          </div>
          <div className="stat-card">
            <div className="count-num" style={{ color: "#ff7043" }}>
              {summary.overbought}
            </div>
            <div className="count-lbl">Overbought (RSI &gt; 70)</div>
          </div>
          <div className="stat-card">
            <div className="count-num pos">{summary.activeBuys.length}</div>
            <div className="count-lbl">Active BUY signals</div>
          </div>
          <div className="stat-card">
            <div className="count-num">{TICKERS.length - summary.oversold - summary.overbought}</div>
            <div className="count-lbl">In neutral zone</div>
          </div>
        </div>
        <div className="subtitle" style={{ marginBottom: 8 }}>
          Tickers with active BUY signal
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {summary.activeBuys.length ? (
            summary.activeBuys.map((t) => (
              <span
                key={t}
                style={{
                  background: "rgba(38,201,108,0.15)",
                  border: "1px solid rgba(38,201,108,0.3)",
                  color: "var(--buy)",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: "0.85rem",
                }}
              >
                {t}
              </span>
            ))
          ) : (
            <span className="subtitle">No active BUY signals right now</span>
          )}
        </div>
      </div>

      <div className="tab-bar-wrap">
        <div className="tab-bar">
          {TICKERS.map((t) => {
            const p = panels[t];
            const sig =
              p && p !== "err" ? p.currentSignal : loading ? "…" : "HOLD";
            return (
              <button
                key={t}
                type="button"
                className={`tab-btn${active === t ? " active" : ""}`}
                onClick={() => setActive(t)}
              >
                <span className="tab-ticker">{t}</span>
                <span className={`tab-signal tab-signal-${sig}`}>{sig}</span>
              </button>
            );
          })}
        </div>
      </div>

      {TICKERS.map((t) => {
        const p = panels[t];
        return (
          <div
            key={t}
            className="rsi-ticker-panel"
            style={{ display: active === t ? "block" : "none" }}
          >
            {p === "err" ? (
              <div className="error-msg">Failed to load {t}</div>
            ) : p ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div className="signal-card">
                    <div className={`signal-badge badge-${p.currentSignal}`}>
                      {p.currentSignal}
                    </div>
                    <div className={`stat-value ${p.zone.cls}`} style={{ fontSize: 28, marginTop: 8 }}>
                      {p.lastRSI != null ? p.lastRSI.toFixed(1) : "—"}
                    </div>
                    <div className={`subtitle ${p.zone.cls}`}>{p.zone.label}</div>
                    <div className="subtitle" style={{ marginTop: 6 }}>
                      Current RSI (14)
                    </div>
                  </div>
                  <div className="signal-card">
                    <div className="chart-title" style={{ marginBottom: 8 }}>
                      Stats from last BUY signal
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <div className="stat-value">{p.daysSince != null ? `${p.daysSince}d` : "N/A"}</div>
                        <div className="stat-label">Days since BUY</div>
                      </div>
                      <div>
                        <div className={`stat-value ${p.drawdown != null && p.drawdown >= 0 ? "up" : "down"}`}>
                          {p.drawdown != null ? `${p.drawdown.toFixed(1)}%` : "N/A"}
                        </div>
                        <div className="stat-label">Max drawdown</div>
                      </div>
                      <div>
                        <div
                          className={`stat-value ${p.gain != null ? (p.gain >= 0 ? "up" : "down") : ""}`}
                        >
                          {p.gain != null ? `${p.gain >= 0 ? "+" : ""}${p.gain.toFixed(2)}%` : "N/A"}
                        </div>
                        <div className="stat-label">Current P&amp;L</div>
                      </div>
                    </div>
                  </div>
                </div>
                <RSICharts p={p} />
                  <div className="history-card" style={{ marginTop: 12 }}>
                  <div className="chart-title" style={{ marginBottom: 10 }}>
                    Signal history (RSI 30 / 70 crossovers, loaded range)
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Signal</th>
                        <th>RSI</th>
                        <th>Price</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="subtitle" style={{ textAlign: "center" }}>
                            No RSI 30/70 crossovers in this range
                          </td>
                        </tr>
                      ) : (
                        p.history.slice(0, 10).map((h, idx) => {
                          const dateStr = `${h.date.getMonth() + 1}/${h.date.getDate()}/${h.date.getFullYear().toString().slice(-2)}`;
                          const pct =
                            h.outcomePct !== null ? h.outcomePct.toFixed(2) : "—";
                          return (
                            <tr key={idx}>
                              <td>{dateStr}</td>
                              <td>
                                <span className={`sig-pill sig-${h.type}`}>{h.type}</span>
                              </td>
                              <td>{h.rsiAtSignal.toFixed(1)}</td>
                              <td>{fmt(h.price)}</td>
                              <td>
                                {h.outcome === "open" ? (
                                  <span className="subtitle">{pct}% (open)</span>
                                ) : (
                                  <span className={h.outcomePct && h.outcomePct > 0 ? "pos" : "neg"}>
                                    {pct}%
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="loading">Loading {t}…</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
