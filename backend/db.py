import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "stocks.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS stocks (
            ticker TEXT PRIMARY KEY,
            company_name TEXT,
            sector TEXT,
            current_price REAL,
            rating REAL,
            analyst_upside REAL,
            eps_growth REAL,
            revenue_growth REAL,
            pe_ratio REAL,
            profit_margin REAL,
            momentum REAL,
            notes TEXT DEFAULT '',
            user_rating_override REAL,
            prediction TEXT DEFAULT '',
            last_updated TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS rating_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT,
            rating REAL,
            price REAL,
            recorded_at TEXT
        );
    """)
    conn.commit()
    conn.close()


def upsert_stock(data: dict):
    conn = get_conn()
    c = conn.cursor()
    now = datetime.utcnow().isoformat()
    c.execute("""
        INSERT INTO stocks (
            ticker, company_name, sector, current_price, rating,
            analyst_upside, eps_growth, revenue_growth, pe_ratio,
            profit_margin, momentum, notes, prediction, last_updated, created_at
        ) VALUES (
            :ticker, :company_name, :sector, :current_price, :rating,
            :analyst_upside, :eps_growth, :revenue_growth, :pe_ratio,
            :profit_margin, :momentum, '', '', :last_updated, :created_at
        )
        ON CONFLICT(ticker) DO UPDATE SET
            company_name=excluded.company_name,
            sector=excluded.sector,
            current_price=excluded.current_price,
            rating=excluded.rating,
            analyst_upside=excluded.analyst_upside,
            eps_growth=excluded.eps_growth,
            revenue_growth=excluded.revenue_growth,
            pe_ratio=excluded.pe_ratio,
            profit_margin=excluded.profit_margin,
            momentum=excluded.momentum,
            last_updated=excluded.last_updated
    """, {**data, "last_updated": now, "created_at": now})
    conn.commit()
    conn.close()


def record_history(ticker: str, rating: float, price: float):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "INSERT INTO rating_history (ticker, rating, price, recorded_at) VALUES (?, ?, ?, ?)",
        (ticker, rating, price, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()


def get_top_stocks(limit: int = 100):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        SELECT *,
               COALESCE(user_rating_override, rating) AS effective_rating
        FROM stocks
        WHERE rating IS NOT NULL
        ORDER BY effective_rating DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_stock(ticker: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        SELECT *, COALESCE(user_rating_override, rating) AS effective_rating
        FROM stocks WHERE ticker = ?
    """, (ticker,))
    row = c.fetchone()
    if row is None:
        conn.close()
        return None
    stock = dict(row)
    c.execute("""
        SELECT rating, price, recorded_at FROM rating_history
        WHERE ticker = ? ORDER BY recorded_at DESC LIMIT 30
    """, (ticker,))
    stock["history"] = [dict(r) for r in c.fetchall()]
    conn.close()
    return stock


def patch_stock(ticker: str, notes: str = None, prediction: str = None, user_rating_override=None):
    conn = get_conn()
    c = conn.cursor()
    fields, values = [], []
    if notes is not None:
        fields.append("notes = ?")
        values.append(notes)
    if prediction is not None:
        fields.append("prediction = ?")
        values.append(prediction)
    if user_rating_override is not None:
        fields.append("user_rating_override = ?")
        values.append(user_rating_override)
    if not fields:
        conn.close()
        return
    values.append(ticker)
    c.execute(f"UPDATE stocks SET {', '.join(fields)} WHERE ticker = ?", values)
    conn.commit()
    conn.close()


def get_stats():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) AS total FROM stocks")
    total = c.fetchone()["total"]
    c.execute("SELECT MAX(last_updated) AS last_updated FROM stocks")
    last_updated = c.fetchone()["last_updated"]
    c.execute("""
        SELECT sector, COUNT(*) AS cnt FROM stocks
        GROUP BY sector ORDER BY cnt DESC LIMIT 1
    """)
    row = c.fetchone()
    top_sector = row["sector"] if row else None
    conn.close()
    return {"total": total, "last_updated": last_updated, "top_sector": top_sector}
