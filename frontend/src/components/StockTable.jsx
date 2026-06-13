import { useState, useMemo } from "react";
import RatingBadge from "./RatingBadge.jsx";

const COLUMNS = [
  { key: "rank",           label: "#",              sortable: false },
  { key: "ticker",         label: "Ticker",         sortable: true },
  { key: "company_name",   label: "Company",        sortable: true },
  { key: "sector",         label: "Sector",         sortable: true },
  { key: "current_price",  label: "Price",          sortable: true },
  { key: "effective_rating", label: "Rating",       sortable: true },
  { key: "analyst_upside", label: "Analyst Upside", sortable: true },
  { key: "eps_growth",     label: "EPS Growth",     sortable: true },
  { key: "notes",          label: "Notes",          sortable: false },
  { key: "last_updated",   label: "Updated",        sortable: true },
];

function SortIcon({ dir }) {
  return (
    <span className="ml-1 text-xs opacity-60">
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

function fmt(val, prefix = "", suffix = "", decimals = 2) {
  if (val == null) return "—";
  return `${prefix}${Number(val).toFixed(decimals)}${suffix}`;
}

export default function StockTable({ stocks, onRowClick }) {
  const [sortKey, setSortKey] = useState("effective_rating");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    const arr = [...stocks];
    arr.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = sortDir === "asc" ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [stocks, sortKey, sortDir]);

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (stocks.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-sm">
        No stocks loaded yet. Click <strong>Refresh Data</strong> to fetch.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-4 py-3 text-left whitespace-nowrap select-none ${
                  col.sortable ? "cursor-pointer hover:text-gray-800 dark:hover:text-gray-200" : ""
                }`}
              >
                {col.label}
                {col.sortable && sortKey === col.key && <SortIcon dir={sortDir} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sorted.map((stock, i) => (
            <tr
              key={stock.ticker}
              onClick={() => onRowClick(stock.ticker)}
              className="bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono">{i + 1}</td>
              <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400 font-mono">
                {stock.ticker}
              </td>
              <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-[180px] truncate">
                {stock.company_name}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{stock.sector || "—"}</td>
              <td className="px-4 py-3 font-mono text-gray-800 dark:text-gray-200">
                {fmt(stock.current_price, "$")}
              </td>
              <td className="px-4 py-3">
                <RatingBadge rating={stock.effective_rating} />
              </td>
              <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                {fmt(stock.analyst_upside, "", "%")}
              </td>
              <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                {fmt(stock.eps_growth, "", "%")}
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                {stock.notes || <span className="italic opacity-40">—</span>}
              </td>
              <td className="px-4 py-3 text-gray-400 dark:text-gray-500 whitespace-nowrap text-xs">
                {stock.last_updated
                  ? new Date(stock.last_updated).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
