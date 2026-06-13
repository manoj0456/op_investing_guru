from db import upsert_stock, record_history


def _safe(value, default=0.0):
    if value is None or (isinstance(value, float) and (value != value)):  # NaN check
        return default
    return float(value)


def score_stock(info: dict) -> dict:
    """
    Returns a dict ready for upsert_stock, including a 0-100 composite rating.

    Weights:
      EPS growth (fwd vs trailing): 25%
      Revenue growth (YoY):         20%
      P/E ratio (fwd):              15%
      Analyst target upside:        20%
      52-week momentum:             10%
      Profit margin:                10%
    """
    price = _safe(info.get("current_price"))
    forward_eps = info.get("forward_eps")
    trailing_eps = info.get("trailing_eps")
    revenue_growth = info.get("revenue_growth")
    forward_pe = info.get("forward_pe")
    target_mean = info.get("target_mean_price")
    low_52 = info.get("fifty_two_week_low")
    high_52 = info.get("fifty_two_week_high")
    profit_margins = info.get("profit_margins")

    # --- EPS growth score (25%) ---
    if forward_eps and trailing_eps and _safe(trailing_eps) != 0:
        eps_growth = (_safe(forward_eps) - _safe(trailing_eps)) / abs(_safe(trailing_eps))
    else:
        eps_growth = None
    if eps_growth is not None:
        # Clamp growth between -50% and +100%; map to 0-100
        eps_score = max(0, min(100, (eps_growth + 0.5) / 1.5 * 100))
    else:
        eps_score = 50  # neutral when missing

    # --- Revenue growth score (20%) ---
    rev_growth = _safe(revenue_growth) if revenue_growth is not None else None
    if rev_growth is not None:
        # Clamp -30% to +50%; map to 0-100
        rev_score = max(0, min(100, (rev_growth + 0.30) / 0.80 * 100))
    else:
        rev_score = 50

    # --- Forward P/E score (15%) ---
    fpe = _safe(forward_pe) if forward_pe is not None else None
    if fpe and fpe > 0:
        # Lower P/E is better; ideal ≤ 15, bad ≥ 60
        pe_score = max(0, min(100, (60 - fpe) / 45 * 100))
    else:
        pe_score = 50

    # --- Analyst upside score (20%) ---
    if target_mean and price and price > 0:
        analyst_upside = (_safe(target_mean) - price) / price
        upside_score = max(0, min(100, (analyst_upside + 0.10) / 0.60 * 100))
    else:
        analyst_upside = None
        upside_score = 50

    # --- 52-week momentum score (10%) ---
    if low_52 and high_52 and price and _safe(high_52) != _safe(low_52):
        momentum = (price - _safe(low_52)) / (_safe(high_52) - _safe(low_52))
        # Mid-range (0.5) is neutral; trending high is good
        momentum_score = max(0, min(100, momentum * 100))
    else:
        momentum = None
        momentum_score = 50

    # --- Profit margin score (10%) ---
    pm = _safe(profit_margins) if profit_margins is not None else None
    if pm is not None:
        # Clamp -10% to +40%; map to 0-100
        pm_score = max(0, min(100, (pm + 0.10) / 0.50 * 100))
    else:
        pm_score = 50

    # --- Composite ---
    rating = (
        eps_score    * 0.25 +
        rev_score    * 0.20 +
        pe_score     * 0.15 +
        upside_score * 0.20 +
        momentum_score * 0.10 +
        pm_score     * 0.10
    )

    return {
        "ticker": info["ticker"],
        "company_name": info.get("company_name", info["ticker"]),
        "sector": info.get("sector", "Unknown"),
        "current_price": price,
        "rating": round(rating, 2),
        "analyst_upside": round(analyst_upside * 100, 2) if analyst_upside is not None else None,
        "eps_growth": round(eps_growth * 100, 2) if eps_growth is not None else None,
        "revenue_growth": round(rev_growth * 100, 2) if rev_growth is not None else None,
        "pe_ratio": round(fpe, 2) if fpe is not None else None,
        "profit_margin": round(pm * 100, 2) if pm is not None else None,
        "momentum": round(momentum * 100, 2) if momentum is not None else None,
    }


def score_and_store_all(raw_stocks: list[dict]):
    print(f"Scoring {len(raw_stocks)} stocks...")
    for info in raw_stocks:
        try:
            scored = score_stock(info)
            upsert_stock(scored)
            record_history(scored["ticker"], scored["rating"], scored["current_price"])
        except Exception as e:
            print(f"Error scoring {info.get('ticker', '?')}: {e}")
    print("Scoring complete.")
