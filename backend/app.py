import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request, abort
from flask_cors import CORS
from db import init_db, get_top_stocks, get_stock, patch_stock, get_stats
from fetcher import fetch_all_stocks
from analyzer import score_and_store_all

app = Flask(__name__)
CORS(app)

init_db()


@app.route("/api/stocks", methods=["GET"])
def api_stocks():
    stocks = get_top_stocks(100)
    return jsonify(stocks)


@app.route("/api/stocks/<ticker>", methods=["GET"])
def api_stock_detail(ticker: str):
    stock = get_stock(ticker.upper())
    if stock is None:
        abort(404, description=f"Ticker {ticker} not found")
    return jsonify(stock)


@app.route("/api/stocks/<ticker>", methods=["PATCH"])
def api_patch_stock(ticker: str):
    body = request.get_json(silent=True) or {}
    patch_stock(
        ticker.upper(),
        notes=body.get("notes"),
        prediction=body.get("prediction"),
        user_rating_override=body.get("user_rating_override"),
    )
    stock = get_stock(ticker.upper())
    return jsonify(stock)


@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    try:
        raw = fetch_all_stocks()
        score_and_store_all(raw)
        return jsonify({"status": "ok", "count": len(raw)})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/stats", methods=["GET"])
def api_stats():
    return jsonify(get_stats())


if __name__ == "__main__":
    app.run(debug=True, port=5000)
