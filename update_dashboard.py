#!/usr/bin/env python3
"""
update_dashboard.py
Runs UNH box theory analysis, appends result to signals.json, and pushes to GitHub.
Called by the daily scheduled task every weekday morning.
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_DIR  = Path.home() / "Documents" / "personal-dashboard"
JSON_FILE = REPO_DIR / "signals.json"
TICKER    = "UNH"

# ── 1. Run the box theory analysis ──────────────────────────────────────────
def run_analysis():
    try:
        import yfinance as yf
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install",
                               "yfinance", "--break-system-packages", "-q"])
        import yfinance as yf

    from datetime import timedelta
    import pandas as pd

    LOOKBACK  = 60
    BOX_DAYS  = 3
    VOL_MULT  = 1.2

    end   = datetime.today()
    start = end - timedelta(days=LOOKBACK + 10)
    df = yf.download(TICKER,
                     start=start.strftime("%Y-%m-%d"),
                     end=end.strftime("%Y-%m-%d"),
                     progress=False)
    df = df.tail(LOOKBACK)
    if df.empty:
        raise RuntimeError("No data returned from yfinance")

    highs  = df["High"].values
    lows   = df["Low"].values
    n      = len(df)

    box_top = box_bottom = None
    i = BOX_DAYS
    while i < n:
        ch = highs[i - BOX_DAYS]
        if all(highs[i - BOX_DAYS + k] <= ch for k in range(1, BOX_DAYS)):
            box_top = ch
            j, floor = i - BOX_DAYS, lows[i - BOX_DAYS]
            while j < n and highs[j] <= box_top * 1.001:
                floor = min(floor, lows[j])
                j += 1
            box_bottom = floor
            i = j
        else:
            i += 1

    last_close  = float(df["Close"].iloc[-1])
    last_volume = float(df["Volume"].iloc[-1])
    avg_volume  = float(df["Volume"].iloc[-20:].mean())
    date_str    = df.index[-1].strftime("%Y-%m-%d")

    if box_top is None:
        return {"date": date_str, "close": last_close, "signal": "HOLD",
                "reason": "No clear Darvas box found in the lookback window.",
                "box_top": None, "box_bottom": None,
                "volume": last_volume, "avg_volume": avg_volume}

    surge = last_volume >= avg_volume * VOL_MULT
    if last_close > box_top:
        signal = "BUY"
        reason = (f"Price (${last_close:.2f}) broke ABOVE box ceiling (${box_top:.2f}). "
                  + ("Volume confirms breakout." if surge else "Volume is weak — watch for false breakout."))
    elif last_close < box_bottom:
        signal = "SELL"
        reason = (f"Price (${last_close:.2f}) broke BELOW box floor (${box_bottom:.2f}). "
                  + ("Volume confirms breakdown." if surge else "Volume is light — may be a shake-out."))
    else:
        signal = "HOLD"
        reason = (f"Price (${last_close:.2f}) is inside the box "
                  f"(${box_bottom:.2f}–${box_top:.2f}). Wait for a breakout.")

    return {"date": date_str, "close": round(last_close, 2),
            "signal": signal, "reason": reason,
            "box_top": round(float(box_top), 2),
            "box_bottom": round(float(box_bottom), 2),
            "volume": int(last_volume), "avg_volume": int(avg_volume)}


# ── 2. Append to signals.json ────────────────────────────────────────────────
def update_json(result):
    if JSON_FILE.exists():
        data = json.loads(JSON_FILE.read_text())
    else:
        data = {"ticker": TICKER, "last_updated": "", "signals": []}

    # Avoid duplicate entries for the same date
    existing_dates = {s["date"] for s in data["signals"]}
    if result["date"] in existing_dates:
        print(f"Signal for {result['date']} already recorded. Skipping.")
        return data

    data["signals"].append(result)
    data["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    JSON_FILE.write_text(json.dumps(data, indent=2))
    print(f"Updated signals.json — {result['date']}: {result['signal']}")
    return data


# ── 3. Git commit & push ─────────────────────────────────────────────────────
def git_push(date_str, signal):
    cmds = [
        ["git", "-C", str(REPO_DIR), "add", "signals.json"],
        ["git", "-C", str(REPO_DIR), "commit", "-m",
         f"signal: {date_str} {signal}"],
        ["git", "-C", str(REPO_DIR), "push"],
    ]
    for cmd in cmds:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Git error ({' '.join(cmd[2:])}):\n{result.stderr}")
            raise RuntimeError("Git operation failed")
    print("Pushed to GitHub Pages.")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] Running UNH Darvas Box analysis…")
    result = run_analysis()
    data   = update_json(result)
    if data["signals"] and data["signals"][-1]["date"] == result["date"]:
        git_push(result["date"], result["signal"])
    print(f"\nSignal: {result['signal']}")
    print(f"Close:  ${result['close']}")
    print(f"Reason: {result['reason']}")
