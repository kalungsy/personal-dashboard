import { useCallback, useEffect, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import { COLORS, RANGES, TICKERS } from "../constants";
import { fetchChart } from "../api/client";
import { computeEnhancedDarvas, type EnhancedResult } from "../lib/enhancedDarvas";
import { fmt, sliceStartByRange, stars } from "../lib/format";

function EnhancedCharts({
  ticker,
  result,
  rangeLabel,
  onRangeChange,
}: {
  ticker: string;
  result: EnhancedResult;
  rangeLabel: string;
  onRangeChange: (label: string) => void;
}) {
  const { dates, closes, sma50, chartBoxTop, chartBoxBot, signals, volumes, avgVol20 } = result;
  const start = sliceStartByRange(dates.length, rangeLabel);
  const labels = dates.slice(start);
  const closeSlice = closes.slice(start);
  const smaSlice = sma50.slice(start);
  const topSlice = chartBoxTop.slice(start);
  const botSlice = chartBoxBot.slice(start);

  const sigMap: Record<string, (typeof signals)[0]> = {};
  signals.forEach((s) => {
    sigMap[s.date] = s;
  });
  const dotData = labels.map((d) => (sigMap[d] ? sigMap[d].close : null));
  const dotColors = labels.map((d) =>
    sigMap[d] ? COLORS[sigMap[d].signal] : "transparent",
  );
  const maxTicks = labels.length <= 5 ? labels.length : 8;

  const vols = volumes.slice(start).map((v) => v / 1e6);
  const avgLine = avgVol20.slice(start).map((v) => (v ? v / 1e6 : null));
  const sigMapVol: Record<string, string> = {};
  signals.forEach((s) => {
    sigMapVol[s.date] = s.signal;
  });
  const barColors = labels.map((d) =>
    sigMapVol[d] ? COLORS[sigMapVol[d] as keyof typeof COLORS] + "99" : "#5c6bc099",
  );

  const priceData = {
    labels,
    datasets: [
      {
        label: "Box Ceiling",
        data: topSlice,
        borderColor: COLORS.boxTop,
        borderWidth: 1.5,
        borderDash: [6, 4] as number[],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 5,
      },
      {
        label: "Box Floor",
        data: botSlice,
        borderColor: COLORS.boxBottom,
        borderWidth: 1.5,
        borderDash: [6, 4] as number[],
        pointRadius: 0,
        backgroundColor: "rgba(38,201,108,0.06)",
        fill: "-1" as const,
        tension: 0,
        order: 6,
      },
      {
        label: "50d SMA",
        data: smaSlice,
        borderColor: COLORS.sma50,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        order: 3,
      },
      {
        label: "Close Price",
        data: closeSlice,
        borderColor: COLORS.price,
        borderWidth: 2,
        pointRadius: labels.length <= 5 ? 4 : 0,
        fill: false,
        tension: 0.3,
        order: 2,
      },
      {
        label: "Signal",
        data: dotData,
        borderColor: "transparent",
        backgroundColor: dotColors,
        pointRadius: labels.map((d) => (sigMap[d] ? 7 : 0)),
        pointBorderColor: dotColors,
        pointBorderWidth: 2,
        showLine: false,
        fill: false,
        order: 1,
      },
    ],
  };

  const volData = {
    labels,
    datasets: [
      { label: "Volume (M)", data: vols, backgroundColor: barColors, order: 2 },
      {
        label: "20d Avg (M)",
        data: avgLine,
        borderColor: COLORS.avgVol,
        borderWidth: 2,
        pointRadius: 0,
        type: "line" as const,
        fill: false,
        tension: 0.3,
        order: 1,
      },
    ],
  };

  const scales = {
    x: {
      ticks: { color: "#9197c0", maxTicksLimit: maxTicks, font: { size: 11 } },
      grid: { color: "rgba(150,150,200,0.1)" },
    },
    y: {
      ticks: { color: "#9197c0", font: { size: 11 } },
      grid: { color: "rgba(150,150,200,0.1)" },
    },
  };

  return (
    <>
      <div className="chart-card">
        <div className="chart-header">
          <div className="chart-title">Price &amp; Darvas Box + 50d SMA</div>
          <div className="range-btns">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                className={`range-btn${rangeLabel === r.label ? " active" : ""}`}
                onClick={() => onRangeChange(r.label)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-wrap">
          <Line
            key={`ep-${ticker}-${rangeLabel}`}
            data={priceData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index" as const, intersect: false },
              plugins: {
                legend: {
                  labels: {
                    color: "#9197c0",
                    font: { size: 12 },
                    boxWidth: 20,
                    padding: 10,
                    filter: (item: { text?: string }) => item.text !== "Signal",
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx: { dataset: { label?: string }; raw: unknown }) => {
                      if (ctx.dataset.label === "Signal" && ctx.raw === null) return "";
                      const v = ctx.raw;
                      return `${ctx.dataset.label}: ${v != null ? "$" + Number(v).toFixed(2) : "N/A"}`;
                    },
                  },
                },
              },
              scales: {
                ...scales,
                y: {
                  ...scales.y,
                  ticks: {
                    ...scales.y.ticks,
                    callback: (v: string | number) => "$" + v,
                  },
                },
              },
            }}
          />
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-title">Volume</div>
        <div className="chart-wrap">
          <Bar
            key={`ev-${ticker}-${rangeLabel}`}
            data={volData as never}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: { color: "#9197c0", font: { size: 12 }, boxWidth: 20, padding: 10 } },
                tooltip: {
                  callbacks: {
                    label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
                      `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}M`,
                  },
                },
              },
              scales: {
                ...scales,
                y: {
                  ...scales.y,
                  ticks: {
                    ...scales.y.ticks,
                    callback: (v: string | number) => v + "M",
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </>
  );
}

export function EnhancedPage() {
  const [active, setActive] = useState<string>(TICKERS[0]);
  const [ranges, setRanges] = useState<Record<string, string>>(() =>
    Object.fromEntries(TICKERS.map((t) => [t, "3M"])),
  );
  const [data, setData] = useState<Record<string, EnhancedResult | "err" | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState("");

  const loadTicker = useCallback(async (t: string) => {
    try {
      const raw = await fetchChart(t);
      const r = computeEnhancedDarvas(raw);
      if (!r) {
        setData((prev) => ({ ...prev, [t]: null }));
        return;
      }
      setData((prev) => ({ ...prev, [t]: r }));
    } catch {
      setData((prev) => ({ ...prev, [t]: "err" }));
    }
  }, []);

  const loadAll = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setRefreshing(true);
        setData({});
      } else setLoading(true);
      await Promise.all(TICKERS.map((t) => loadTicker(t)));
      setUpdated(new Date().toLocaleString());
      setLoading(false);
      setRefreshing(false);
    },
    [loadTicker],
  );

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  return (
    <>
      <div className="page-header">
        <div className="header-row">
          <h1>Enhanced Darvas Box Dashboard</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="header-meta">{updated ? `Last updated: ${updated}` : "Loading…"}</span>
            <button
              type="button"
              className="refresh-btn"
              disabled={loading || refreshing}
              onClick={() => void loadAll(true)}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>
      <div className="tab-bar-wrap">
        <div className="tab-bar">
          {TICKERS.map((t) => {
            const row = data[t];
            const latest = row && row !== "err" && row !== null ? row.latest : null;
            const sig = latest?.signal || "HOLD";
            return (
              <button
                key={t}
                type="button"
                className={`tab-btn${active === t ? " active" : ""}`}
                onClick={() => setActive(t)}
              >
                <span className="tab-ticker">{t}</span>
                <span className={`tab-signal tab-signal-${sig}`}>{loading ? "…" : sig}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="panels-container">
        {loading && Object.keys(data).length === 0 ? (
          <div className="loading">Fetching live market data…</div>
        ) : null}
        {TICKERS.map((t) => {
          const row = data[t];
          const rangeLabel = ranges[t] || "3M";
          return (
            <div key={t} className={`panel${active === t ? " active" : ""}`}>
              {row === "err" ? (
                <div className="error-msg">Failed to load {t}.</div>
              ) : row === null ? (
                <div className="error-msg">Insufficient data for {t} (need 55+ trading days).</div>
              ) : row ? (
                <EnhancedPanelInner
                  t={t}
                  result={row}
                  rangeLabel={rangeLabel}
                  setRange={(lb) => setRanges((prev) => ({ ...prev, [t]: lb }))}
                />
              ) : (
                <div className="loading">Loading {t}…</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function EnhancedPanelInner({
  t,
  result,
  rangeLabel,
  setRange,
}: {
  t: string;
  result: EnhancedResult;
  rangeLabel: string;
  setRange: (lb: string) => void;
}) {
  const {
    closes,
    volumes,
    sma50,
    avgVol20,
    currentBoxTop,
    currentBoxBot,
    signals,
    latest,
    cooldownLeft,
    dates,
  } = result;
  const n = closes.length;
  const counts = { BUY: 0, SELL: 0, HOLD: 0 };
  signals.forEach((s) => {
    if (s.signal in counts) counts[s.signal as keyof typeof counts]++;
  });
  const latestVol = volumes[n - 1];
  const latestAvgVol = avgVol20[n - 1];
  const volRatio = latestAvgVol ? latestVol / latestAvgVol : null;
  const latestSma = sma50[n - 1];
  const latestClose = closes[n - 1];
  const trendOk = latestSma != null && latestClose > latestSma;
  const volOk = volRatio != null && volRatio > 1.2;
  const tightness =
    currentBoxTop && currentBoxBot
      ? (((currentBoxTop - currentBoxBot) / currentBoxBot) * 100).toFixed(1) + "%"
      : "N/A";

  return (
    <>
      <div className="signal-card">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          {latest ? (
            <>
              <div className={`signal-badge badge-${latest.signal}`}>{latest.signal}</div>
              <div style={{ flex: 1 }}>
                <p className="signal-reason">{latest.reason}</p>
                <p className="subtitle">
                  {latest.date} &nbsp;|&nbsp; Close: {fmt(latest.close)}
                </p>
                <div className="confidence-row">
                  <span title={`Confidence: ${latest.confidence ?? 1}/5`}>
                    {stars(latest.confidence ?? 1)}
                  </span>
                  <span className="confidence-label">
                    Signal Confidence {latest.confidence ?? 1}/5
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="subtitle">No signals generated yet (insufficient data or no breakout).</p>
          )}
        </div>
        <div className="status-row">
          <span className={`status-pill ${trendOk ? "pill-ok" : "pill-warn"}`}>
            {trendOk ? "Above 50d SMA" : "Below 50d SMA"}
          </span>
          <span className={`status-pill ${volOk ? "pill-ok" : "pill-warn"}`}>
            {volOk
              ? `Volume confirmed (${volRatio?.toFixed(2)}x)`
              : `Low volume (${volRatio?.toFixed(2) ?? "N/A"}x)`}
          </span>
          {cooldownLeft > 0 ? (
            <span className="status-pill pill-bad">Re-entry cooldown: {cooldownLeft} days</span>
          ) : null}
        </div>
      </div>
      <div className="algo-explain">
        <strong>Enhanced Algorithm:</strong> Box ceiling locked after <strong>3 consecutive days</strong>{" "}
        where high varies &lt;1%. BUY requires: price &gt; 50d SMA + volume &gt;1.2× 20d avg. 10-day
        re-entry cooldown after SELL. Confidence score (1–5) based on box tightness, volume ratio and
        trend alignment.
      </div>
      <div className="box-stats">
        <div className="stat-card">
          <div className="stat-label">Box Ceiling</div>
          <div className="stat-value up">{fmt(currentBoxTop)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Box Floor</div>
          <div className="stat-value down">{fmt(currentBoxBot)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Box Tightness</div>
          <div className="stat-value">{tightness}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vol Ratio (20d)</div>
          <div className={`stat-value ${volOk ? "up" : "neutral"}`}>
            {volRatio ? volRatio.toFixed(2) + "x" : "N/A"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">50d SMA</div>
          <div className={`stat-value ${trendOk ? "up" : "down"}`}>{fmt(latestSma)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Latest Close</div>
          <div className="stat-value">{fmt(latestClose)}</div>
        </div>
      </div>
      <div className="counts-row">
        <div className="count-card count-BUY">
          <div className="count-num">{counts.BUY}</div>
          <div className="count-lbl">BUY</div>
        </div>
        <div className="count-card count-SELL">
          <div className="count-num">{counts.SELL}</div>
          <div className="count-lbl">SELL</div>
        </div>
        <div className="count-card count-HOLD">
          <div className="count-num">{counts.HOLD}</div>
          <div className="count-lbl">HOLD</div>
        </div>
      </div>
      {signals.length > 0 || dates.length ? (
        <EnhancedCharts
          ticker={t}
          result={result}
          rangeLabel={rangeLabel}
          onRangeChange={setRange}
        />
      ) : null}
      <div className="history-card">
        <div className="chart-title" style={{ marginBottom: 10 }}>
          Signal History
        </div>
        {signals.length === 0 ? (
          <p className="subtitle">No signals generated yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Signal</th>
                <th>Close</th>
                <th>Box Range</th>
                <th>Confidence</th>
                <th>Vol Ratio</th>
              </tr>
            </thead>
            <tbody>
              {[...signals].reverse().slice(0, 30).map((s) => (
                <tr key={s.date + s.signal}>
                  <td>{s.date}</td>
                  <td>
                    <span className={`sig-pill sig-${s.signal}`}>{s.signal}</span>
                  </td>
                  <td>{fmt(s.close)}</td>
                  <td>
                    {fmt(s.box_bottom)} – {fmt(s.box_top)}
                  </td>
                  <td title={`${s.confidence}/5`}>{stars(s.confidence ?? 1)}</td>
                  <td>{s.vol_ratio != null ? s.vol_ratio.toFixed(2) + "x" : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
