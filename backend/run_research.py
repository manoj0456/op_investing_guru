"""
run_research.py -- End-to-end daily research: stock scoring + options suggestions.

Usage:
  python run_research.py               # Full run: stocks + options
  python run_research.py --options-only  # Skip stock scoring, fetch top stocks from API
"""

import os
import sys
import re
import time
import datetime
import requests
import yfinance as yf

API_URL = os.environ.get(
    "INVESTING_GURU_API_URL",
    "https://drvmig6o7c.execute-api.us-east-2.amazonaws.com",
).rstrip("/")

# -- Ticker universe -----------------------------------------------------------

NASDAQ100 = [
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


def get_sp500_tickers():
    try:
        html = requests.get(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"},
        ).text
        return re.findall(r'<td><a[^>]*>([A-Z]{1,5})</a></td>', html)
    except Exception as e:
        print(f"[WARN] Could not fetch S&P 500 list: {e}")
        return []


def build_ticker_list():
    sp500 = get_sp500_tickers()
    combined = list(dict.fromkeys(NASDAQ100 + sp500))
    return combined[:500]


# -- Rating algorithm ----------------------------------------------------------

def compute_rating(info):
    score = 0

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

    rev_growth = info.get("revenueGrowth")
    revenue_growth = round(rev_growth * 100, 2) if rev_growth is not None else None
    if rev_growth is not None:
        if rev_growth > 0.15:
            score += 15
        elif rev_growth > 0.08:
            score += 10
        elif rev_growth > 0:
            score += 4

    pe = info.get("trailingPE") or info.get("forwardPE")
    if pe and pe > 0:
        if pe < 15:
            score += 15
        elif pe < 25:
            score += 10
        elif pe < 40:
            score += 5

    margin = info.get("profitMargins")
    profit_margin = round(margin * 100, 2) if margin is not None else None
    if margin is not None:
        if margin > 0.20:
            score += 15
        elif margin > 0.10:
            score += 10
        elif margin > 0:
            score += 4

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


# -- Part 1: Stock scoring -----------------------------------------------------

def run_stocks():
    tickers = build_ticker_list()
    print(f"\n[PART 1] Processing {len(tickers)} tickers...")
    ok = 0
    skip = 0
    top_stocks = []

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
                "source": "run_research",
            }

            r = requests.put(f"{API_URL}/stocks/{ticker}", json=payload, timeout=15)
            r.raise_for_status()
            ok += 1

            top_stocks.append({
                "ticker": ticker,
                "current_price": round(float(current_price), 2),
                "rating": rating,
                "analyst_upside": analyst_upside,
                "momentum": momentum,
            })

            if (i + 1) % 10 == 0:
                print(f"  [{i+1}/{len(tickers)}] {ticker} -> rating {rating}")

            time.sleep(0.2)

        except KeyboardInterrupt:
            print("\n[STOP] Interrupted by user")
            break
        except Exception as e:
            print(f"  [ERR] {ticker}: {e}")
            skip += 1

    print(f"\n[PART 1 DONE] {ok} upserted, {skip} skipped")

    r = requests.get(f"{API_URL}/stocks", timeout=15)
    data = r.json()
    if isinstance(data, list):
        count = len(data)
    else:
        count = len(data.get("stocks", data.get("items", [])))
    print(f"[VERIFY] GET /stocks -> {count} stocks in DB")
    if count < 50:
        print("[WARN] Fewer than 50 stocks in DB -- check logs above")

    top_stocks.sort(key=lambda x: x["rating"], reverse=True)
    return top_stocks


def fetch_top_stocks_from_api():
    """Fetch current top-rated stocks from API (used in --options-only mode)."""
    print("[PART 1 SKIP] Fetching top stocks from API...")
    r = requests.get(f"{API_URL}/stocks", timeout=15)
    r.raise_for_status()
    data = r.json()
    stocks = data if isinstance(data, list) else data.get("stocks", data.get("items", []))
    result = []
    for s in stocks:
        try:
            result.append({
                "ticker": s.get("ticker") or s.get("pk") or s.get("symbol") or s.get("id", ""),
                "current_price": float(s.get("current_price") or s.get("currentPrice") or 0),
                "rating": int(s.get("rating") or 0),
                "analyst_upside": s.get("analyst_upside"),
                "momentum": s.get("momentum"),
            })
        except Exception:
            continue
    result = [s for s in result if s["ticker"] and s["current_price"] > 0]
    result.sort(key=lambda x: x["rating"], reverse=True)
    print(f"  Loaded {len(result)} stocks from API")
    return result


# -- Part 2: Options suggestions -----------------------------------------------

def nearest_expiry(expiries, min_days=14, max_days=60):
    today = datetime.date.today()
    best = None
    best_days = None
    for exp_str in expiries:
        try:
            exp = datetime.date.fromisoformat(exp_str)
            days = (exp - today).days
            if min_days <= days <= max_days:
                if best_days is None or days < best_days:
                    best = exp_str
                    best_days = days
        except Exception:
            continue
    return best


def _closest_row(df, target):
    if df.empty:
        return None
    df = df.copy()
    df["_dist"] = (df["strike"] - target).abs()
    return df.sort_values("_dist").iloc[0]


def _bid(row):
    val = row.get("bid") if hasattr(row, "get") else row["bid"]
    return float(val) if val and float(val) > 0 else float(row.get("lastPrice", row["lastPrice"]) or 0)


def _ask(row):
    val = row.get("ask") if hasattr(row, "get") else row["ask"]
    return float(val) if val and float(val) > 0 else float(row.get("lastPrice", row["lastPrice"]) or 0)


def get_chain(ticker_sym, min_days=14, max_days=60):
    """Return (expiry_str, calls_df, puts_df) or None."""
    try:
        t = yf.Ticker(ticker_sym)
        expiries = t.options
        if not expiries:
            return None
        expiry = nearest_expiry(expiries, min_days, max_days) or expiries[0]
        chain = t.option_chain(expiry)
        return expiry, chain.calls, chain.puts
    except Exception as e:
        print(f"  [CHAIN-ERR] {ticker_sym}: {e}")
        return None


def make_covered_call(stock, calls, expiry):
    price = stock["current_price"]
    otm_calls = calls[calls["strike"] > price * 1.03].copy()
    row = _closest_row(otm_calls, price * 1.07)
    if row is None:
        return None
    premium = _bid(row)
    if premium <= 0:
        return None
    strike = float(row["strike"])
    pct_otm = (strike / price - 1) * 100
    return {
        "ticker": stock["ticker"],
        "strategy": "covered_call",
        "expiry": expiry,
        "strike": round(strike, 2),
        "premium": round(premium, 2),
        "max_profit": round(premium * 100, 2),
        "max_loss": round((price - premium) * 100, 2),
        "breakeven": round(price - premium, 2),
        "rationale": (
            f"Strong fundamentals, rating {stock['rating']}/100. "
            f"Selling OTM call at ${strike:.2f} ({pct_otm:.1f}% above market) for income."
        ),
        "risk_level": "low",
        "status": "active",
    }


def make_cash_secured_put(stock, puts, expiry):
    price = stock["current_price"]
    otm_puts = puts[puts["strike"] < price * 0.97].copy()
    row = _closest_row(otm_puts, price * 0.93)
    if row is None:
        return None
    premium = _bid(row)
    if premium <= 0:
        return None
    strike = float(row["strike"])
    pct_otm = (1 - strike / price) * 100
    return {
        "ticker": stock["ticker"],
        "strategy": "cash_secured_put",
        "expiry": expiry,
        "strike": round(strike, 2),
        "premium": round(premium, 2),
        "max_profit": round(premium * 100, 2),
        "max_loss": round((strike - premium) * 100, 2),
        "breakeven": round(strike - premium, 2),
        "rationale": (
            f"High-rated stock ({stock['rating']}/100). "
            f"Selling OTM put at ${strike:.2f} ({pct_otm:.1f}% below market) for premium income."
        ),
        "risk_level": "medium",
        "status": "active",
    }


def make_long_call(stock, calls, expiry):
    price = stock["current_price"]
    atm_calls = calls[(calls["strike"] >= price * 0.98) & (calls["strike"] <= price * 1.05)].copy()
    row = _closest_row(atm_calls, price)
    if row is None:
        return None
    premium = _ask(row)
    if premium <= 0:
        return None
    strike = float(row["strike"])
    upside = stock.get("analyst_upside") or 0
    target_price = price * (1 + upside / 100) if upside > 0 else price * 1.30
    max_profit = round(max(0, target_price - strike - premium) * 100, 2)
    return {
        "ticker": stock["ticker"],
        "strategy": "long_call",
        "expiry": expiry,
        "strike": round(strike, 2),
        "premium": round(premium, 2),
        "max_profit": max_profit,
        "max_loss": round(premium * 100, 2),
        "breakeven": round(strike + premium, 2),
        "rationale": (
            f"Analyst target implies {upside:.0f}% upside, rating {stock['rating']}/100. "
            f"Buying ATM/slight-OTM call at ${strike:.2f} for leveraged directional exposure."
        ),
        "risk_level": "high",
        "status": "active",
    }


def make_iron_condor(stock, calls, puts, expiry):
    price = stock["current_price"]
    sc_row = _closest_row(calls[calls["strike"] > price * 1.03], price * 1.05)
    lc_row = _closest_row(calls[calls["strike"] > price * 1.07], price * 1.10)
    sp_row = _closest_row(puts[puts["strike"] < price * 0.97], price * 0.95)
    lp_row = _closest_row(puts[puts["strike"] < price * 0.93], price * 0.90)
    if any(r is None for r in [sc_row, lc_row, sp_row, lp_row]):
        return None
    sc_bid = _bid(sc_row)
    lc_ask = _ask(lc_row)
    sp_bid = _bid(sp_row)
    lp_ask = _ask(lp_row)
    net_credit = round(sc_bid + sp_bid - lc_ask - lp_ask, 2)
    if net_credit <= 0:
        return None
    call_width = float(lc_row["strike"]) - float(sc_row["strike"])
    max_loss = round((call_width - net_credit) * 100, 2)
    return {
        "ticker": stock["ticker"],
        "strategy": "iron_condor",
        "expiry": expiry,
        "strike": round(float(sc_row["strike"]), 2),
        "premium": round(net_credit, 2),
        "max_profit": round(net_credit * 100, 2),
        "max_loss": max_loss,
        "breakeven": round(float(sp_row["strike"]) - net_credit, 2),
        "rationale": (
            f"Stable stock, rating {stock['rating']}/100. "
            f"Iron condor: put spread {float(lp_row['strike']):.0f}/{float(sp_row['strike']):.0f}, "
            f"call spread {float(sc_row['strike']):.0f}/{float(lc_row['strike']):.0f}. "
            f"Collecting ${net_credit:.2f} net credit."
        ),
        "risk_level": "medium",
        "status": "active",
    }


def run_options(top_stocks):
    print(f"\n[PART 2] Generating options suggestions from top {len(top_stocks)} rated stocks...")
    suggestions = []

    high_rated = [s for s in top_stocks if s["rating"] >= 70]
    long_call_cands = [s for s in top_stocks if s["rating"] >= 75 and (s.get("analyst_upside") or 0) >= 20]
    condor_cands = [s for s in top_stocks if s["rating"] >= 60]

    def try_add(s, label):
        if s:
            suggestions.append(s)
            print(f"  [+] {s['ticker']:6s} {label:20s} strike={s['strike']:8.2f}  exp={s['expiry']}  premium=${s['premium']:.2f}")
            return True
        return False

    # Covered calls -- up to 6
    print("\n  -> Covered calls...")
    cc_done = set()
    for stock in high_rated:
        if sum(1 for s in suggestions if s["strategy"] == "covered_call") >= 6:
            break
        if stock["ticker"] in cc_done:
            continue
        result = get_chain(stock["ticker"])
        if not result:
            continue
        expiry, calls, puts = result
        try_add(make_covered_call(stock, calls, expiry), "covered_call")
        cc_done.add(stock["ticker"])
        time.sleep(0.3)

    # Cash secured puts -- up to 6
    print("\n  -> Cash secured puts...")
    csp_done = set()
    for stock in high_rated:
        if sum(1 for s in suggestions if s["strategy"] == "cash_secured_put") >= 6:
            break
        if stock["ticker"] in csp_done:
            continue
        result = get_chain(stock["ticker"])
        if not result:
            continue
        expiry, calls, puts = result
        try_add(make_cash_secured_put(stock, puts, expiry), "cash_secured_put")
        csp_done.add(stock["ticker"])
        time.sleep(0.3)

    # Long calls -- up to 5 (30-90 day expiry for longer duration)
    print("\n  -> Long calls...")
    lc_done = set()
    for stock in long_call_cands:
        if sum(1 for s in suggestions if s["strategy"] == "long_call") >= 5:
            break
        if stock["ticker"] in lc_done:
            continue
        result = get_chain(stock["ticker"], min_days=25, max_days=90)
        if not result:
            continue
        expiry, calls, puts = result
        try_add(make_long_call(stock, calls, expiry), "long_call")
        lc_done.add(stock["ticker"])
        time.sleep(0.3)

    # Iron condors -- up to 4
    print("\n  -> Iron condors...")
    ic_done = set()
    for stock in condor_cands:
        if sum(1 for s in suggestions if s["strategy"] == "iron_condor") >= 4:
            break
        if stock["ticker"] in ic_done:
            continue
        result = get_chain(stock["ticker"])
        if not result:
            continue
        expiry, calls, puts = result
        try_add(make_iron_condor(stock, calls, puts, expiry), "iron_condor")
        ic_done.add(stock["ticker"])
        time.sleep(0.3)

    print(f"\n[PART 2] {len(suggestions)} suggestions generated. Posting to API...")

    posted = 0
    for s in suggestions:
        try:
            r = requests.post(f"{API_URL}/options", json=s, timeout=15)
            r.raise_for_status()
            posted += 1
        except Exception as e:
            print(f"  [POST-ERR] {s['ticker']} {s['strategy']}: {e}")

    print(f"[PART 2 DONE] Posted {posted}/{len(suggestions)} options to API")

    # Verify
    r = requests.get(f"{API_URL}/options", timeout=15)
    data = r.json()
    if isinstance(data, list):
        count = len(data)
    else:
        count = len(data.get("options", data.get("items", [])))
    print(f"[VERIFY] GET /options -> {count} options in DB")
    if count < 15:
        print("[WARN] Fewer than 15 options in DB -- check logs above")
    return suggestions


# -- Main ----------------------------------------------------------------------

if __name__ == "__main__":
    options_only = "--options-only" in sys.argv

    print("=" * 60)
    print("op_investing_guru -- Daily Research Run")
    print(f"API: {API_URL}")
    print(f"Mode: {'options-only' if options_only else 'full (stocks + options)'}")
    print("=" * 60)

    if options_only:
        top_stocks = fetch_top_stocks_from_api()
    else:
        top_stocks = run_stocks()

    run_options(top_stocks)

    print("\n[ALL DONE] Research run complete.")
