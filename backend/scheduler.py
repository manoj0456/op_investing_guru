"""
Run this script daily (e.g., via Windows Task Scheduler at 5:00 PM):
  python scheduler.py

It fetches fresh stock data, scores every ticker, and saves results to SQLite.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from db import init_db
from fetcher import fetch_all_stocks
from analyzer import score_and_store_all

if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Fetching stock data...")
    raw = fetch_all_stocks()
    print("Scoring and storing...")
    score_and_store_all(raw)
    print("Done.")
