import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import Modal from "../components/Modal.jsx";
import FieldRow from "../components/FieldRow.jsx";

const INPUT = "w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500";
const SELECT = INPUT + " cursor-pointer";

const STRATEGIES = ["covered_call", "cash_secured_put", "iron_condor", "long_call", "long_put"];
const RISK_LEVELS = ["low", "medium", "high"];
const STATUSES = ["active", "expired", "closed"];

const STRATEGY_COLORS = {
  covered_call: "bg-blue-700 text-blue-100",
  cash_secured_put: "bg-purple-700 text-purple-100",
  iron_condor: "bg-cyan-700 text-cyan-100",
  long_call: "bg-green-700 text-green-100",
  long_put: "bg-red-700 text-red-100",
};

const RISK_COLORS = {
  low: "bg-green-700 text-green-100",
  medium: "bg-yellow-600 text-yellow-100",
  high: "bg-red-700 text-red-100",
};

const STATUS_COLORS = {
  active: "bg-emerald-700 text-emerald-100",
  expired: "bg-gray-600 text-gray-200",
  closed: "bg-orange-700 text-orange-100",
};

const EMPTY_FORM = {
  ticker: "", strategy: "covered_call", expiry: "", strike: "",
  premium: "", max_profit: "", max_loss: "", breakeven: "",
  rationale: "", risk_level: "medium", status: "active",
};

function Badge({ text, colorMap }) {
  const cls = colorMap[text] || "bg-gray-600 text-gray-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {text?.replace(/_/g, " ")}
    </span>
  );
}

export default function OptionsPage() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [filterTicker, setFilterTicker] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOptions();
      setOptions(data);
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

  function openEdit(opt) {
    setEditing(opt.id);
    setForm({
      ticker: opt.ticker || "",
      strategy: opt.strategy || "covered_call",
      expiry: opt.expiry || "",
      strike: opt.strike ?? "",
      premium: opt.premium ?? "",
      max_profit: opt.max_profit ?? "",
      max_loss: opt.max_loss ?? "",
      breakeven: opt.breakeven ?? "",
      rationale: opt.rationale || "",
      risk_level: opt.risk_level || "medium",
      status: opt.status || "active",
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ticker: form.ticker.trim().toUpperCase(),
        strategy: form.strategy,
        expiry: form.expiry,
        strike: form.strike !== "" ? Number(form.strike) : null,
        premium: form.premium !== "" ? Number(form.premium) : null,
        max_profit: form.max_profit !== "" ? Number(form.max_profit) : null,
        max_loss: form.max_loss !== "" ? Number(form.max_loss) : null,
        breakeven: form.breakeven !== "" ? Number(form.breakeven) : null,
        rationale: form.rationale,
        risk_level: form.risk_level,
        status: form.status,
      };
      if (editing) {
        await api.patchOption(editing, payload);
      } else {
        await api.createOption(payload);
      }
      setShowModal(false);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, ticker) {
    if (!confirm(`Delete option for ${ticker}?`)) return;
    try {
      await api.deleteOption(id);
      setOptions((o) => o.filter((x) => x.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  const filtered = options.filter((o) => {
    if (filterTicker && !o.ticker?.toLowerCase().includes(filterTicker.toLowerCase())) return false;
    if (filterStrategy && o.strategy !== filterStrategy) return false;
    if (filterRisk && o.risk_level !== filterRisk) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    return true;
  });

  function num(v) {
    if (v === null || v === undefined || v === "") return <span className="text-gray-600">—</span>;
    return Number(v).toFixed(2);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Options Suggestions</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          + Add Option Suggestion
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-32"
          placeholder="Ticker…"
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
        />
        <select
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          value={filterStrategy}
          onChange={(e) => setFilterStrategy(e.target.value)}
        >
          <option value="">All Strategies</option>
          {STRATEGIES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
        >
          <option value="">All Risk Levels</option>
          {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filterTicker || filterStrategy || filterRisk || filterStatus) && (
          <button
            onClick={() => { setFilterTicker(""); setFilterStrategy(""); setFilterRisk(""); setFilterStatus(""); }}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded"
          >
            Clear
          </button>
        )}
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
              <th className="px-3 py-3 text-left">Ticker</th>
              <th className="px-3 py-3 text-left">Strategy</th>
              <th className="px-3 py-3 text-right">Strike</th>
              <th className="px-3 py-3 text-left">Expiry</th>
              <th className="px-3 py-3 text-right">Premium</th>
              <th className="px-3 py-3 text-right">Max Profit</th>
              <th className="px-3 py-3 text-right">Max Loss</th>
              <th className="px-3 py-3 text-right">Breakeven</th>
              <th className="px-3 py-3 text-left">Risk</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-500">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-500">
                  {options.length === 0 ? "No options yet. Add a suggestion." : "No results match your filters."}
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-900/50 transition-colors" title={o.rationale}>
                  <td className="px-3 py-2.5 font-mono font-bold text-blue-400">{o.ticker}</td>
                  <td className="px-3 py-2.5"><Badge text={o.strategy} colorMap={STRATEGY_COLORS} /></td>
                  <td className="px-3 py-2.5 text-right text-gray-200">{o.strike != null ? `$${num(o.strike)}` : <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{o.expiry || <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-yellow-300">{o.premium != null ? `$${num(o.premium)}` : <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-green-400">{o.max_profit != null ? `$${num(o.max_profit)}` : <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-red-400">{o.max_loss != null ? `$${num(o.max_loss)}` : <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-gray-300">{o.breakeven != null ? `$${num(o.breakeven)}` : <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2.5"><Badge text={o.risk_level} colorMap={RISK_COLORS} /></td>
                  <td className="px-3 py-2.5"><Badge text={o.status} colorMap={STATUS_COLORS} /></td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <button
                      onClick={() => openEdit(o)}
                      className="text-gray-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(o.id, o.ticker)}
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
        <Modal title={editing ? "Edit Option" : "Add Option Suggestion"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-1">
            <FieldRow label="Ticker *">
              <input className={INPUT} value={form.ticker} onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))} placeholder="e.g. AAPL" required />
            </FieldRow>
            <FieldRow label="Strategy">
              <select className={SELECT} value={form.strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}>
                {STRATEGIES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Expiry Date">
              <input className={INPUT} type="date" value={form.expiry} onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))} />
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Strike ($)">
                <input className={INPUT} type="number" step="0.01" value={form.strike} onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))} placeholder="0.00" />
              </FieldRow>
              <FieldRow label="Premium ($)">
                <input className={INPUT} type="number" step="0.01" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))} placeholder="0.00" />
              </FieldRow>
              <FieldRow label="Max Profit ($)">
                <input className={INPUT} type="number" step="0.01" value={form.max_profit} onChange={(e) => setForm((f) => ({ ...f, max_profit: e.target.value }))} placeholder="0.00" />
              </FieldRow>
              <FieldRow label="Max Loss ($)">
                <input className={INPUT} type="number" step="0.01" value={form.max_loss} onChange={(e) => setForm((f) => ({ ...f, max_loss: e.target.value }))} placeholder="0.00" />
              </FieldRow>
            </div>
            <FieldRow label="Breakeven ($)">
              <input className={INPUT} type="number" step="0.01" value={form.breakeven} onChange={(e) => setForm((f) => ({ ...f, breakeven: e.target.value }))} placeholder="0.00" />
            </FieldRow>
            <FieldRow label="Rationale">
              <textarea className={INPUT + " resize-none"} rows={2} value={form.rationale} onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))} placeholder="Why this trade…" />
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Risk Level">
                <select className={SELECT} value={form.risk_level} onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value }))}>
                  {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Status">
                <select className={SELECT} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FieldRow>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
