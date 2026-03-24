"""
API for the personal trading dashboard: Yahoo Finance chart proxy (no browser CORS)
and static signals.json from the repository root.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SIGNALS_PATH = Path(os.environ.get("SIGNALS_JSON", str(REPO_ROOT / "signals.json")))

YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"

app = FastAPI(title="Personal Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _normalize_yahoo_payload(data: dict) -> dict:
    chart = (data.get("chart") or {}).get("result")
    if not chart:
        raise ValueError("No chart result")
    result = chart[0]
    timestamps = result.get("timestamp") or []
    quote = (result.get("indicators") or {}).get("quote") or [{}]
    q = quote[0]
    opens = q.get("open") or []
    highs = q.get("high") or []
    lows = q.get("low") or []
    closes = q.get("close") or []
    volumes = q.get("volume") or []

    def _get(arr: list, idx: int):
        if idx < 0 or idx >= len(arr):
            return None
        return arr[idx]

    rows = []
    for i, ts in enumerate(timestamps):
        c = _get(closes, i)
        if c is None:
            continue
        o = _get(opens, i)
        h = _get(highs, i)
        l = _get(lows, i)
        v = _get(volumes, i)
        # Yahoo often leaves high/low/open null on some bars; keep the day so history length matches other tickers
        o = o if o is not None else c
        h = h if h is not None else c
        l = l if l is not None else c
        d = __import__("datetime").datetime.utcfromtimestamp(int(ts))
        rows.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "open": float(o),
                "high": float(h),
                "low": float(l),
                "close": float(c),
                "volume": int(v) if v is not None else 0,
            }
        )

    if not rows:
        raise ValueError("No valid OHLC rows")

    return {
        "ticker": (result.get("meta") or {}).get("symbol", ""),
        "currency": (result.get("meta") or {}).get("currency"),
        "dates": [r["date"] for r in rows],
        "opens": [r["open"] for r in rows],
        "highs": [r["high"] for r in rows],
        "lows": [r["low"] for r in rows],
        "closes": [r["close"] for r in rows],
        "volumes": [r["volume"] for r in rows],
    }


async def _fetch_chart(ticker: str, time_range: str = "2y", interval: str = "1d") -> dict:
    url = f"{YAHOO_CHART.format(ticker=ticker.upper())}?interval={interval}&range={time_range}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; PersonalDashboard/1.0)"},
        )
    if r.status_code != 200:
        raise HTTPException(r.status_code, "Yahoo Finance request failed")
    try:
        payload = _normalize_yahoo_payload(r.json())
        payload["ticker"] = ticker.upper()
        return payload
    except (ValueError, KeyError, TypeError) as e:
        raise HTTPException(502, f"Bad Yahoo payload: {e}") from e


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/chart/{ticker}")
async def get_chart(
    ticker: str,
    time_range: str = Query("2y", alias="range"),
    interval: str = "1d",
):
    """Proxy Yahoo chart API; returns aligned OHLCV arrays (same shape as legacy frontends)."""
    return await _fetch_chart(ticker, time_range=time_range, interval=interval)


@app.get("/api/signals")
def get_signals():
    if not SIGNALS_PATH.is_file():
        raise HTTPException(404, f"Missing {SIGNALS_PATH}")
    try:
        return json.loads(SIGNALS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Invalid JSON: {e}") from e


@app.get("/api/closes/{ticker}")
async def get_closes_only(
    ticker: str,
    time_range: str = Query("2y", alias="range"),
):
    """Lightweight series for RS ranking (closes only)."""
    full = await _fetch_chart(ticker, time_range=time_range)
    return {"ticker": full["ticker"], "closes": full["closes"]}


# Production: serve Vite build from dashboard/client/dist (run `npm run build` in client/)
_DIST = REPO_ROOT / "dashboard" / "client" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="spa")
