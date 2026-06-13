import { useState, useEffect, useCallback } from "react";
import StockTable from "./components/StockTable.jsx";
import StockDetail from "./components/StockDetail.jsx";

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("darkMode", dark);
  }, [dark]);

  return [dark, setDark];
}

export default function App() {
  const [stocks, setStocks] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dark, setDark] = useDarkMode();

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stocksRes, statsRes] = await Promise.all([
        fetch("/api/stocks"),
        fetch("/api/stats"),
      ]);
      if (!stocksRes.ok) throw new Error("Failed to fetch stocks");
      const [stocksData, statsData] = await Promise.all([
        stocksRes.json(),
        statsRes.ok ? statsRes.json() : null,
      ]);
      setStocks(stocksData);
      setStats(statsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Refresh failed");
      }
      await fetchStocks();
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">
              StockResearch
            </span>
            {stats && (
              <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-3">
                <span>{stats.total} stocks tracked</span>
                {stats.top_sector && <span>Top sector: {stats.top_sector}</span>}
                {stats.last_updated && (
                  <span>Updated: {new Date(stats.last_updated).toLocaleString()}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 transition"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Refreshing…
                </>
              ) : (
                "Refresh Data"
              )}
            </button>

            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-lg"
              title="Toggle dark mode"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          {[
            ["80+", "Strong Buy", "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"],
            ["60–79", "Buy", "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"],
            ["40–59", "Hold", "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"],
            ["<40", "Watch", "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"],
          ].map(([range, label, cls]) => (
            <span key={range} className={`px-2.5 py-1 rounded-full font-semibold ${cls}`}>
              {range} · {label}
            </span>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500 gap-3">
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading stocks…
          </div>
        ) : (
          <StockTable stocks={stocks} onRowClick={setSelectedTicker} />
        )}
      </main>

      {/* Detail panel */}
      {selectedTicker && (
        <StockDetail
          ticker={selectedTicker}
          onClose={() => {
            setSelectedTicker(null);
            fetchStocks();
          }}
        />
      )}
    </div>
  );
}
