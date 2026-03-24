import { useEffect, useMemo, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import { COLORS, RANGES, TICKERS } from "../constants";
import { fetchSignals } from "../api/client";
import { fmt, fmtVol, sliceStartByRange } from "../lib/format";
import type { SignalRow, TickerBundle } from "../types/signals";

function latestSignal(sigs: SignalRow[]): SignalRow | null {
  return sigs.length ? sigs[sigs.length - 1] : null;
}

function StandardCharts({
  ticker,
  tdata,
  rangeLabel,
  onRangeChange,
}: {
  ticker: string;
  tdata: TickerBundle;
  rangeLabel: string;
  onRangeChange: (label: string) => void;
}) {
  const ph = tdata.price_history;
  const sigs = tdata.signals || [];
  const allLabels = ph ? ph.dates : sigs.map((s) => s.date);
  const allCloses = ph ? ph.close : sigs.map((s) => s.close);
  const boxTop = ph ? ph.box_top : sigs[0]?.box_top ?? null;
  const boxBot = ph ? ph.box_bottom : sigs[0]?.box_bottom ?? null;

  const start = sliceStartByRange(allLabels.length, rangeLabel);
  const labels = allLabels.slice(start);
  const closes = allCloses.slice(start);
  const tops = labels.map(() => boxTop);
  const bots = labels.map(() => boxBot);

  const sigMap: Record<string, { close: number; signal: string }> = {};
  sigs.forEach((s) => {
    sigMap[s.date] = { close: s.close, signal: s.signal };
  });
  const dotData = labels.map((d) => (sigMap[d] ? sigMap[d].close : null));
  const dotColors = labels.map((d) => (sigMap[d] ? COLORS[sigMap[d].signal as keyof typeof COLORS] || "#888" : "transparent"));
  const maxTicks = labels.length <= 5 ? labels.length : 8;

  const allVols = ph ? ph.volume : sigs.map((s) => s.volume);
  const fullAvg = allVols.map((_, i) => {
    const w = allVols.slice(Math.max(0, i - 19), i + 1);
    return parseFloat((w.reduce((a, b) => a + b, 0) / w.length).toFixed(0));
  });
  const vols = allVols.slice(start).map((v) => v / 1e6);
  const avgLine = fullAvg.slice(start).map((v) => v / 1e6);
  const barColors = labels.map((d) =>
    sigMap[d] ? (COLORS[sigMap[d].signal as keyof typeof COLORS] || "#5c6bc0") + "99" : "#5c6bc099",
  );

  const priceData = {
    labels,
    datasets: [
      {
        label: "Box Ceiling",
        data: tops,
        borderColor: COLORS.boxTop,
        borderWidth: 1.5,
        borderDash: [6, 4] as number[],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 3,
      },
      {
        label: "Box Floor",
        data: bots,
        borderColor: COLORS.boxBottom,
        borderWidth: 1.5,
        borderDash: [6, 4] as number[],
        pointRadius: 0,
        backgroundColor: "rgba(38,201,108,0.07)",
        fill: "-1" as const,
        tension: 0,
        order: 4,
      },
      {
        label: "Close Price",
        data: closes,
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

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#9197c0", font: { size: 12 }, boxWidth: 20, padding: 10 } },
    },
    scales: {
      x: {
        ticks: { color: "#9197c0", maxTicksLimit: maxTicks, font: { size: 11 } },
        grid: { color: "rgba(150,150,200,0.1)" },
      },
      y: {
        ticks: { color: "#9197c0", font: { size: 11 } },
        grid: { color: "rgba(150,150,200,0.1)" },
      },
    },
  };

  return (
    <>
      <div className="chart-card">
        <div className="chart-header">
          <div className="chart-title">Price &amp; Darvas Box</div>
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
            key={`p-${ticker}-${rangeLabel}`}
            data={priceData}
            options={{
              ...commonOpts,
              interaction: { mode: "index" as const, intersect: false },
              plugins: {
                ...commonOpts.plugins,
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
                      return `${ctx.dataset.label}: $${Number(ctx.raw).toFixed(2)}`;
                    },
                  },
                },
              },
              scales: {
                ...commonOpts.scales,
                y: {
                  ...commonOpts.scales.y,
                  ticks: {
                    ...commonOpts.scales.y.ticks,
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
            key={`v-${ticker}-${rangeLabel}`}
            data={volData as never}
            options={{
              ...commonOpts,
              plugins: {
                ...commonOpts.plugins,
                tooltip: {
                  callbacks: {
                    label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
                      `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}M`,
                  },
                },
              },
              scales: {
                ...commonOpts.scales,
                y: {
                  ...commonOpts.scales.y,
                  ticks: {
                    ...commonOpts.scales.y.ticks,
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

export function StandardPage() {
  const [data, setData] = useState<Record<string, TickerBundle> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<string>(TICKERS[0]);
  const [ranges, setRanges] = useState<Record<string, string>>(() =>
    Object.fromEntries(TICKERS.map((t) => [t, "3M"])),
  );

  useEffect(() => {
    fetchSignals()
      .then((j) => setData(j as Record<string, TickerBundle>))
      .catch((e: Error) => setErr(e.message));
  }, []);

  const updatedText = useMemo(() => {
    if (!data) return "Loading…";
    const times = TICKERS.map((t) => data[t]?.last_updated).filter(Boolean);
    return times.length ? `Last updated: ${times[times.length - 1]}` : "No recent update";
  }, [data]);

  if (err) {
    return (
      <div className="panels-container">
        <div className="error-msg">Could not load signals: {err}</div>
      </div>
    );
  }

  if (!data) {
    return <div className="loading">Loading signals…</div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Darvas Box Dashboard (Standard)</h1>
        <p className="subtitle">{updatedText}</p>
      </div>
      <div className="tab-bar-wrap">
        <div className="tab-bar">
          {TICKERS.map((t) => {
            const latest = latestSignal(data[t]?.signals || []);
            const sig = latest?.signal || "HOLD";
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
      <div className="panels-container">
        {TICKERS.map((t) => {
          const td = data[t] || { ticker: t, signals: [] };
          const sigs = td.signals || [];
          const latest = latestSignal(sigs);
          const counts = { BUY: 0, SELL: 0, HOLD: 0 };
          sigs.forEach((s) => {
            if (s.signal in counts) counts[s.signal as keyof typeof counts]++;
          });
          const volRatio =
            latest && latest.avg_volume ? latest.volume / latest.avg_volume : null;
          const vrClass = volRatio
            ? volRatio >= 1.2
              ? "up"
              : volRatio < 0.8
                ? "down"
                : "neutral"
            : "";
          const rangeLabel = ranges[t] || "3M";

          return (
            <div key={t} className={`panel${active === t ? " active" : ""}`}>
              <div className="signal-card">
                {latest ? (
                  <>
                    <div className={`signal-badge badge-${latest.signal}`}>{latest.signal}</div>
                    <p style={{ marginBottom: 8 }}>{latest.reason}</p>
                    <p className="subtitle">
                      {latest.date} &nbsp;|&nbsp; Close: {fmt(latest.close)}
                    </p>
                  </>
                ) : (
                  <p className="subtitle">No signal data for {t}.</p>
                )}
              </div>
              <div className="box-explain">
                <strong>How the box is determined:</strong> The algorithm scans for a{" "}
                <strong>3-day confirmation rule</strong> — a peak high is set as the box ceiling once 3
                consecutive days&apos; highs don&apos;t exceed it. The floor is the lowest low while price
                stayed inside the box. A <strong>BUY</strong> fires when today&apos;s close breaks{" "}
                <em>above</em> the ceiling; a <strong>SELL</strong> fires when it breaks <em>below</em>{" "}
                the floor.
              </div>
              <div className="box-stats">
                <div className="stat-card">
                  <div className="stat-label">Box Ceiling</div>
                  <div className="stat-value up">{fmt(latest?.box_top ?? null)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Box Floor</div>
                  <div className="stat-value down">{fmt(latest?.box_bottom ?? null)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Volume</div>
                  <div className="stat-value">{fmtVol(latest?.volume)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Vol Ratio vs 20d Avg</div>
                  <div className={`stat-value ${vrClass}`}>
                    {volRatio ? `${volRatio.toFixed(2)}x` : "N/A"}
                  </div>
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
              {sigs.length > 0 || td.price_history ? (
                <StandardCharts
                  ticker={t}
                  tdata={td}
                  rangeLabel={rangeLabel}
                  onRangeChange={(label) => setRanges((prev) => ({ ...prev, [t]: label }))}
                />
              ) : null}
              <div className="history-card">
                <div className="chart-title" style={{ marginBottom: 10 }}>
                  Signal History
                </div>
                {sigs.length === 0 ? (
                  <p className="subtitle">No history yet.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Signal</th>
                        <th>Close</th>
                        <th>Box Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sigs].reverse().map((s) => (
                        <tr key={s.date + s.signal}>
                          <td>{s.date}</td>
                          <td>
                            <span className={`sig-pill sig-${s.signal}`}>{s.signal}</span>
                          </td>
                          <td>{fmt(s.close)}</td>
                          <td>
                            {fmt(s.box_bottom)} – {fmt(s.box_top)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
