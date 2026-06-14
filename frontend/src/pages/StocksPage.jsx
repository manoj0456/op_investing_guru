import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import RatingBadge from "../components/RatingBadge.jsx";
import Modal from "../components/Modal.jsx";
import FieldRow from "../components/FieldRow.jsx";

const INPUT = "w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500";

const EMPTY_FORM = {
  ticker: "", company_name: "", sector: "", current_price: "",
  notes: "", prediction: "", user_rating_override: "",
};

export default function StocksPage() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStocks();
      setStocks(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(stock) {
    setEditing(stock.ticker);
    setForm({
      ticker: stock.ticker || "",
      company_name: stock.company_name || "",
      sector: stock.sector || "",
      current_price: stock.current_price ?? "",
      notes: stock.notes || "",
      prediction: stock.prediction || "",
      user_rating_override: stock.user_rating_override ?? "",
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const ticker = form.ticker.trim().toUpperCase();
      if (!ticker) throw new Error("Ticker is required");
      const payload = {
        company_name: form.company_name,
        sector: form.sector,
        current_price: form.current_price !== "" ? Number(form.current_price) : null,
        notes: form.notes,
        prediction: form.prediction,
        user_rating_override: form.user_rating_override !== "" ? Number(form.user_rating_override) : null,
        source: "manual",
      };
      await api.upsertStock(ticker, payload);
      setShowModal(false);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ticker) {
    if (!confirm(`Delete ${ticker}?`)) return;
    try {
      await api.deleteStock(ticker);
      setStocks((s) => s.filter((x) => x.ticker !== ticker));
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const schedulerUrl = import.meta.env.VITE_SCHEDULER_TRIGGER_URL;
      if (!schedulerUrl) {
        alert("VITE_SCHEDULER_TRIGGER_URL not configured. Run the scheduler manually:\n  cd backend && python scheduler.py");
        return;
      }
      await fetch(schedulerUrl, { method: "POST" });
      alert("Scheduler triggered. Data will refresh in a few minutes.");
    } catch (e) {
      alert("Failed to trigger scheduler: " + e.message);
    } finally {
      setRefreshing(false);
    }
  }

  function fmt(val, suffix = "") {
    if (val === null || val === undefined || val === "") return <span className="text-gray-600">—</span>;
    return `${val}${suffix}`;
  }

  function effectiveRating(s) {
    return s.user_rating_override ?? s.rating ?? 0;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Top Stocks</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors disabled:opacity-50"
          >
            {refreshing ? "Triggering…" : "↻ Refresh from Market"}
          </button>
          <button
            onClick={openAdd}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            + Add Stock
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded text-sm text-red-300">
          {error}
          {!import.meta.env.VITE_API_URL && (
            <p className="mt-1 text-xs text-red-400">Tip: set VITE_API_URL in .env to point to your Lambda API.</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-3 py-3 text-left w-10">#</th>
              <th className="px-3 py-3 text-left">Ticker</th>
              <th className="px-3 py-3 text-left">Company</th>
              <th className="px-3 py-3 text-left">Sector</th>
              <th className="px-3 py-3 text-right">Price</th>
              <th className="px-3 py-3 text-left">Rating</th>
              <th className="px-3 py-3 text-right">Upside</th>
              <th className="px-3 py-3 text-right">EPS Growth</th>
              <th className="px-3 py-3 text-left max-w-xs">Notes</th>
              <th className="px-3 py-3 text-left">Updated</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-500">Loading…</td>
              </tr>
            ) : stocks.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-500">
                  No stocks yet. Add one or run the scheduler.
                </td>
              </tr>
            ) : (
              stocks.map((s, i) => (
                <tr key={s.ticker} className="hover:bg-gray-900/50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-blue-400">{s.ticker}</td>
                  <td className="px-3 py-2.5 text-gray-200">{s.company_name || <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-400">{s.sector || <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-gray-200">
                    {s.current_price != null ? `$${Number(s.current_price).toFixed(2)}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <RatingBadge rating={effectiveRating(s)} />
                    {s.user_rating_override != null && (
                      <span className="ml-1 text-xs text-purple-400" title="Manual override">✎</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-green-400">
                    {s.analyst_upside != null ? `${s.analyst_upside > 0 ? "+" : ""}${s.analyst_upside.toFixed(1)}%` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-300">
                    {s.eps_growth != null ? `${s.eps_growth > 0 ? "+" : ""}${s.eps_growth.toFixed(1)}%` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 max-w-xs truncate text-gray-400" title={s.notes}>{s.notes || <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {s.last_updated ? new Date(s.last_updated).toLocaleDateString() : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <button
                      onClick={() => openEdit(s)}
                      className="text-gray-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(s.ticker)}
                      className="text-gray-400 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors ml-1"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? `Edit ${editing}` : "Add Stock"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-1">
            <FieldRow label="Ticker *">
              <input
                className={INPUT}
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                placeholder="e.g. AAPL"
                disabled={!!editing}
                required
              />
            </FieldRow>
            <FieldRow label="Company Name">
              <input className={INPUT} value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Apple Inc." />
            </FieldRow>
            <FieldRow label="Sector">
              <input className={INPUT} value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} placeholder="Technology" />
            </FieldRow>
            <FieldRow label="Current Price ($)">
              <input className={INPUT} type="number" step="0.01" value={form.current_price} onChange={(e) => setForm((f) => ({ ...f, current_price: e.target.value }))} placeholder="0.00" />
            </FieldRow>
            <FieldRow label="Notes">
              <textarea className={INPUT + " resize-none"} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Your notes…" />
            </FieldRow>
            <FieldRow label="Prediction">
              <input className={INPUT} value={form.prediction} onChange={(e) => setForm((f) => ({ ...f, prediction: e.target.value }))} placeholder="e.g. Strong growth expected in Q3" />
            </FieldRow>
            <FieldRow label="Rating Override (0–100, optional)">
              <input className={INPUT} type="number" min={0} max={100} value={form.user_rating_override} onChange={(e) => setForm((f) => ({ ...f, user_rating_override: e.target.value }))} placeholder="Leave blank to use computed rating" />
            </FieldRow>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Update" : "Add Stock"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
