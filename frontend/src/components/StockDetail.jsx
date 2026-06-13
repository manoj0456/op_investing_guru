import { useState, useEffect, useCallback } from "react";
import RatingBadge from "./RatingBadge.jsx";

function Sparkline({ history }) {
  if (!history || history.length < 2) {
    return <p className="text-xs text-gray-400 dark:text-gray-500">Not enough history yet.</p>;
  }

  const ratings = history.map((h) => h.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const range = max - min || 1;
  const W = 300, H = 60, pad = 4;

  const points = ratings
    .slice()
    .reverse()
    .map((r, i) => {
      const x = pad + (i / (ratings.length - 1)) * (W - pad * 2);
      const y = H - pad - ((r - min) / range) * (H - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14 text-blue-500">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function StockDetail({ ticker, onClose }) {
  const [stock, setStock] = useState(null);
  const [notes, setNotes] = useState("");
  const [prediction, setPrediction] = useState("");
  const [override, setOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stocks/${ticker}`);
    if (!res.ok) return;
    const data = await res.json();
    setStock(data);
    setNotes(data.notes || "");
    setPrediction(data.prediction || "");
    setOverride(data.user_rating_override != null ? String(data.user_rating_override) : "");
  }, [ticker]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    const body = { notes, prediction };
    const parsed = parseFloat(override);
    if (!isNaN(parsed) && override.trim() !== "") {
      body.user_rating_override = Math.max(0, Math.min(100, parsed));
    } else {
      body.user_rating_override = null;
    }
    const res = await fetch(`/api/stocks/${ticker}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setStock(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const fmt = (v, suffix = "") =>
    v != null ? `${Number(v).toFixed(2)}${suffix}` : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stock?.ticker ?? ticker}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stock?.company_name} · {stock?.sector}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Key metrics */}
          {stock && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ["Price", `$${fmt(stock.current_price)}`],
                ["Rating", <RatingBadge key="rb" rating={stock.effective_rating} />],
                ["Analyst Upside", fmt(stock.analyst_upside, "%")],
                ["EPS Growth", fmt(stock.eps_growth, "%")],
                ["Revenue Growth", fmt(stock.revenue_growth, "%")],
                ["Fwd P/E", fmt(stock.pe_ratio)],
                ["Profit Margin", fmt(stock.profit_margin, "%")],
                ["Momentum", fmt(stock.momentum, "%")],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{val}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sparkline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Rating History
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              <Sparkline history={stock?.history} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Your research notes..."
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Prediction */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Prediction
            </label>
            <textarea
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              rows={2}
              placeholder="Where do you think this stock is headed?"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Rating override */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Rating Override <span className="font-normal normal-case">(0–100, leave blank to use computed)</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="e.g. 75"
              className="w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">Saved!</span>
            )}
          </div>

          {/* Last updated */}
          {stock?.last_updated && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Last updated: {new Date(stock.last_updated).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
