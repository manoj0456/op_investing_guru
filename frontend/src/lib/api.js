const BASE = import.meta.env.VITE_API_URL || "";

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Stocks
  getStocks: () => req("GET", "/stocks"),
  getStock: (ticker) => req("GET", `/stocks/${ticker}`),
  upsertStock: (ticker, data) => req("PUT", `/stocks/${ticker}`, data),
  patchStock: (ticker, data) => req("PATCH", `/stocks/${ticker}`, data),
  deleteStock: (ticker) => req("DELETE", `/stocks/${ticker}`),

  // Options
  getOptions: () => req("GET", "/options"),
  createOption: (data) => req("POST", "/options", data),
  patchOption: (id, data) => req("PATCH", `/options/${id}`, data),
  deleteOption: (id) => req("DELETE", `/options/${id}`),
};
