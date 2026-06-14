"""
Daily scheduler — fetches market data via yfinance and upserts to Lambda API.
Run manually: python scheduler.py
Or schedule via cron/Task Scheduler at 5PM daily.
"""

import os
import json
import time
import requests
import yfinance as yf

API_URL = os.environ.get("INVESTING_GURU_API_URL", "").rstrip("/")

# ─── Ticker universe ──────────────────────────────────────────────────────────

def get_sp500_tickers():
    try:
        tables = requests.get(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"},
        ).text
        import re
        return re.findall(r'<td><a[^>]*>([A-Z]{1,5})</a></td>', tables)
    except Exception as e:
        print(f"[WARN] Could not fetch S&P 500 list: {e}")
        return []

NASDAQ100_HARDCODED = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "TSLA", "AVGO", "COST",
    "NFLX", "AMD", "ADBE", "QCOM", "TMUS", "INTC", "INTU", "TXN", "AMGN", "AMAT",
    "MU", "BKNG", "ISRG", "LRCX", "KLAC", "ASML", "REGN", "ADI", "CDNS", "SNPS",
    "MELI", "PANW", "CRWD", "FTNT", "ABNB", "ORLY", "MNST", "CTAS", "CHTR", "PAYX",
    "MRVL", "KDP", "AEP", "EXC", "FANG", "DXCM", "TEAM", "WDAY", "ODFL", "FAST",
    "ROST", "VRSK", "GEHC", "ON", "ILMN", "PCAR", "DLTR", "BIIB", "SIRI", "ANSS",
    "ZS", "ALGN", "GFS", "TTWO", "WBA", "LCID", "CEG", "ENPH", "DDOG", "ZM",
    "RIVN", "NXPI", "CPRT", "IDXX", "EBAY", "XEL", "WBD", "MCHP", "CSGP", "CTSH",
    "SPLK", "LULU", "SBUX", "HON", "PYPL", "CMCSA", "GILD", "CSX", "MDLZ", "VRTX",
    "ADSK", "MRNA", "PTON", "PDD", "OKTA", "DOCU", "NET", "SNOW", "PLTR", "ARM",
]

def build_ticker_list():
    sp500 = get_sp500_tickers()
    combined = list(dict.fromkeys(NASDAQ100_HARDCODED + sp500))
    return combined[:500]

# ─── Rating algorithm ─────────────────────────────────────────────────────────

def compute_rating(info):
    score = 0

    # 1. Analyst upside (target vs current price)
    target = info.get("targetMeanPrice")
    current = info.get("currentPrice") or info.get("regularMarketPrice")
    analyst_upside = None
    if target and current and current > 0:
        analyst_upside = round((target - current) / current * 100, 2)
        if analyst_upside > 20:
            score += 25
        elif analyst_upside > 10:
            score += 15
        elif analyst_upside > 0:
            score += 8

    # 2. EPS growth (forward vs trailing)
    forward_eps = info.get("forwardEps")
    trailing_eps = info.get("trailingEps")
    eps_growth = None
    if forward_eps and trailing_eps and trailing_eps != 0:
        eps_growth = round((forward_eps - trailing_eps) / abs(trailing_eps) * 100, 2)
        if eps_growth > 20:
            score += 20
        elif eps_growth > 10:
            score += 12
        elif eps_growth > 0:
            score += 5

    # 3. Revenue growth
    rev_growth = info.get("revenueGrowth")
    revenue_growth = round(rev_growth * 100, 2) if rev_growth is not None else None
    if rev_growth is not None:
        if rev_growth > 0.15:
            score += 15
        elif rev_growth > 0.08:
            score += 10
        elif rev_growth > 0:
            score += 4

    # 4. P/E ratio (lower is generally better, within reason)
    pe = info.get("trailingPE") or info.get("forwardPE")
    if pe and pe > 0:
        if pe < 15:
            score += 15
        elif pe < 25:
            score += 10
        elif pe < 40:
            score += 5

    # 5. Profit margin
    margin = info.get("profitMargins")
    profit_margin = round(margin * 100, 2) if margin is not None else None
    if margin is not None:
        if margin > 0.20:
            score += 15
        elif margin > 0.10:
            score += 10
        elif margin > 0:
            score += 4

    # 6. Momentum (52w performance)
    low52 = info.get("fiftyTwoWeekLow")
    high52 = info.get("fiftyTwoWeekHigh")
    momentum = None
    if low52 and high52 and current and high52 > low52:
        pos = (current - low52) / (high52 - low52)
        momentum = round(pos * 100, 2)
        if pos > 0.7:
            score += 10
        elif pos > 0.4:
            score += 6
        elif pos > 0.2:
            score += 2

    return min(score, 100), analyst_upside, eps_growth, revenue_growth, pe, profit_margin, momentum

# ─── Main loop ────────────────────────────────────────────────────────────────

def upsert(ticker, payload):
    if not API_URL:
        print(f"  [SKIP] INVESTING_GURU_API_URL not set — would PUT /stocks/{ticker}")
        return
    r = requests.put(f"{API_URL}/stocks/{ticker}", json=payload, timeout=15)
    r.raise_for_status()

def run():
    tickers = build_ticker_list()
    print(f"[INFO] Processing {len(tickers)} tickers…")
    ok = 0
    skip = 0

    for i, ticker in enumerate(tickers):
        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
            if not info.get("symbol") and not info.get("shortName"):
                skip += 1
                continue

            current_price = info.get("currentPrice") or info.get("regularMarketPrice")
            if not current_price:
                skip += 1
                continue

            rating, analyst_upside, eps_growth, revenue_growth, pe, profit_margin, momentum = compute_rating(info)

            payload = {
                "company_name": info.get("shortName") or info.get("longName") or "",
                "sector": info.get("sector") or "",
                "current_price": round(float(current_price), 2),
                "rating": rating,
                "analyst_upside": analyst_upside,
                "eps_growth": eps_growth,
                "revenue_growth": revenue_growth,
                "pe_ratio": round(float(pe), 2) if pe else None,
                "profit_margin": profit_margin,
                "momentum": momentum,
                "source": "scheduled",
            }

            upsert(ticker, payload)
            ok += 1

            if (i + 1) % 10 == 0:
                print(f"  [{i+1}/{len(tickers)}] {ticker} → rating {rating}")

            time.sleep(0.2)

        except KeyboardInterrupt:
            print("\n[STOP] Interrupted by user")
            break
        except Exception as e:
            print(f"  [ERR] {ticker}: {e}")
            skip += 1

    print(f"\n[DONE] {ok} upserted, {skip} skipped")

if __name__ == "__main__":
    run()
