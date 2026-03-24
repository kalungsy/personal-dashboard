import { useCallback, useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { TICKERS } from "../constants";
import { fetchCloses } from "../api/client";
import {
  computeRS,
  getSignal,
  pct,
  rollingRS,
  type RankedTicker,
} from "../lib/rsRanking";

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(digits) + "%";
}

function colorClass(v: number | null): string {
  if (v == null) return "neu";
  if (v > 0.3) return "pos";
  if (v < -0.3) return "neg";
  return "neu";
}

function buildBars(tickerArr: number[], spyArr: number[], period: string, nDays: number) {
  const tv = pct(tickerArr, nDays);
  const sv = pct(spyArr, nDays);
  const max = Math.max(Math.abs(tv || 0), Math.abs(sv || 0), 1);
  const scale = 44 / max;
  const th = Math.max(2, Math.abs((tv || 0) * scale));
  const sh = Math.max(2, Math.abs((sv || 0) * scale));
  const tc = tv == null ? "#546e7a" : tv >= 0 ? "#7986cb" : "#ef9a9a";
  const sc = sv == null ? "#546e7a" : sv >= 0 ? "#546e7a" : "#ef9a9a";
  return (
    <div className="perf-col" key={period}>
      <div className="perf-period">{period}</div>
      <div className="bar-pair" style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 52 }}>
        <div
          className="bar ticker-bar"
          style={{ width: 14, borderRadius: "3px 3px 0 0", height: th, background: tc }}
          title={`Ticker: ${fmtPct(tv)}`}
        />
        <div
          className="bar spy-bar"
          style={{ width: 14, borderRadius: "3px 3px 0 0", height: sh, background: sc }}
          title={`SPY: ${fmtPct(sv)}`}
        />
      </div>
      <div className={`perf-val ${colorClass(tv)}`}>{fmtPct(tv, 1)}</div>
    </div>
  );
}

function MiniRsChart({ rolling, ticker }: { rolling: number[]; ticker: string }) {
  const labels = rolling.map((_, i) => i);
  const positive = rolling.map((v) => (v >= 0 ? v : null));
  const negative = rolling.map((v) => (v < 0 ? v : null));
  return (
    <div className="mini-chart">
      <Line
        key={ticker}
        data={{
          labels,
          datasets: [
            {
              label: "pos",
              data: positive,
              borderColor: "#26c96c",
              backgroundColor: "rgba(38,201,108,.1)",
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              spanGaps: false,
              tension: 0.3,
            },
            {
              label: "neg",
              data: negative,
              borderColor: "#ef5350",
              backgroundColor: "rgba(239,83,80,.1)",
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              spanGaps: false,
              tension: 0.3,
            },
            {
              label: "line",
              data: rolling,
              borderColor: "rgba(255,255,255,.25)",
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              spanGaps: true,
              tension: 0.3,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: {
              display: true,
              grid: { color: "rgba(45,63,94,.5)" },
              ticks: {
                color: "#94a3b8",
                font: { size: 9 },
                maxTicksLimit: 4,
                callback: (v) => (Number(v) >= 0 ? "+" : "") + Number(v).toFixed(1) + "%",
              },
            },
          },
        }}
      />
    </div>
  );
}

export function RSRankingPage() {
  const [ranked, setRanked] = useState<RankedTicker[]>([]);
  const [spyCloses, setSpyCloses] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const results = await Promise.allSettled([
        fetchCloses("SPY"),
        ...TICKERS.map((t) => fetchCloses(t)),
      ]);
      const spy = results[0].status === "fulfilled" ? results[0].value : null;
      if (!spy || spy.length < 10) throw new Error("Failed to fetch SPY data");

      const tickerData: RankedTicker[] = [];
      TICKERS.forEach((ticker, i) => {
        const res = results[i + 1];
        const closes = res.status === "fulfilled" ? res.value : null;
        if (!closes || closes.length < 5) {
          tickerData.push({
            ticker,
            closes: [],
            rs: {
              score: 0,
              rs1w: 0,
              rs1m: 0,
              rs3m: 0,
              rs6m: 0,
              r1w: null,
              r1m: null,
              r3m: null,
              r6m: null,
              s1w: null,
              s1m: null,
              s3m: null,
              s6m: null,
            },
            signal: "HOLD",
            rolling: [],
            trending: false,
            trendingDown: false,
          });
          return;
        }
        const rs = computeRS(closes, spy);
        const rolling = rollingRS(closes, spy, 20);
        const trending =
          rolling.length >= 6 && rolling[rolling.length - 1] > rolling[rolling.length - 6];
        const trendingDown =
          rolling.length >= 6 && rolling[rolling.length - 1] < rolling[rolling.length - 6];
        const signal = getSignal(rs.score, rolling);
        tickerData.push({ ticker, closes, rs, signal, rolling, trending, trendingDown });
      });
      tickerData.sort((a, b) => b.rs.score - a.rs.score);
      setRanked(tickerData);
      setSpyCloses(spy);
      setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const leaders = ranked.slice(0, 3);
  const laggards = ranked.slice(-3).reverse();

  return (
    <div className="rs-container">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="header-row">
          <div>
            <h1>Relative Strength Ranking</h1>
            <p className="subtitle">
              {TICKERS.length} tickers ranked by RS Score vs S&amp;P 500 benchmark
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="header-meta">Updated {updated || "—"}</span>
            <button type="button" className="refresh-btn" disabled={loading} onClick={() => void loadAll()}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading && ranked.length === 0 ? (
        <div className="loading">Fetching RS data…</div>
      ) : null}
      {err ? <div className="error-msg">{err}</div> : null}

      {!err && ranked.length > 0 ? (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div className="subtitle" style={{ marginBottom: 6 }}>
                Leaders
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {leaders.map((d) => (
                  <span
                    key={d.ticker}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 4,
                      fontWeight: 700,
                      background: "rgba(38,201,108,.2)",
                      color: "var(--buy)",
                      border: "1px solid rgba(38,201,108,.3)",
                    }}
                  >
                    {d.ticker}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <div className="subtitle" style={{ marginBottom: 6 }}>
                Laggards
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {laggards.map((d) => (
                  <span
                    key={d.ticker}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 4,
                      fontWeight: 700,
                      background: "rgba(239,83,80,.2)",
                      color: "var(--sell)",
                      border: "1px solid rgba(239,83,80,.3)",
                    }}
                  >
                    {d.ticker}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="subtitle" style={{ marginBottom: 8 }}>
            Leaderboard
          </div>
          <table className="leaderboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Ticker</th>
                <th>Signal</th>
                <th>RS Score</th>
                <th>1W</th>
                <th>1M</th>
                <th>3M</th>
                <th>6M</th>
                <th>vs SPY</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((d, i) => {
                const rank = i + 1;
                const rowClass =
                  d.signal === "BUY" ? "row-buy" : d.signal === "SELL" ? "row-sell" : "";
                const trendArrow = d.trending ? "▲" : d.trendingDown ? "▼" : "—";
                const trendColor = d.trending ? "pos" : d.trendingDown ? "neg" : "neu";
                return (
                  <tr key={d.ticker} className={rowClass}>
                    <td>{rank}</td>
                    <td style={{ fontWeight: 700 }}>{d.ticker}</td>
                    <td>{d.signal}</td>
                    <td className={colorClass(d.rs.score)}>{fmtPct(d.rs.score)}</td>
                    <td className={colorClass(d.rs.r1w)}>{fmtPct(d.rs.r1w)}</td>
                    <td className={colorClass(d.rs.r1m)}>{fmtPct(d.rs.r1m)}</td>
                    <td className={colorClass(d.rs.r3m)}>{fmtPct(d.rs.r3m)}</td>
                    <td className={colorClass(d.rs.r6m)}>{fmtPct(d.rs.r6m)}</td>
                    <td className={colorClass(d.rs.score)}>{fmtPct(d.rs.score)}</td>
                    <td className={trendColor}>{trendArrow}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="subtitle" style={{ marginTop: 16, marginBottom: 8 }}>
            Ticker detail
          </div>
          <div className="cards-grid">
            {ranked.map((d, i) => {
              const rank = i + 1;
              const rsClass = d.rs.score > 0 ? "pos" : d.rs.score < 0 ? "neg" : "neu";
              const momClass = d.trending ? "up" : d.trendingDown ? "down" : "flat";
              const momText = d.trending ? "Strengthening" : d.trendingDown ? "Weakening" : "Neutral";
              return (
                <div key={d.ticker} className="detail-card">
                  <div className="card-header">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{d.ticker}</div>
                      <div className="subtitle">
                        Rank #{rank} of {ranked.length}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div>{d.signal}</div>
                      <div className={rsClass} style={{ fontWeight: 700 }}>
                        {fmtPct(d.rs.score)}
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        background: "var(--surface2)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        marginBottom: 12,
                      }}
                    >
                      <span className="subtitle">Momentum (5d RS trend)</span>
                      <span className={momClass} style={{ fontWeight: 700 }}>
                        {momText}
                      </span>
                    </div>
                    <div className="subtitle" style={{ marginBottom: 8 }}>
                      Performance vs SPY (ticker / SPY bars)
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {buildBars(d.closes, spyCloses, "1W", 5)}
                      {buildBars(d.closes, spyCloses, "1M", 21)}
                      {buildBars(d.closes, spyCloses, "3M", 63)}
                      {buildBars(d.closes, spyCloses, "6M", 126)}
                    </div>
                    <div className="subtitle" style={{ marginTop: 12, marginBottom: 6 }}>
                      RS Score Trend (20 days)
                    </div>
                    <MiniRsChart rolling={d.rolling} ticker={d.ticker} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
