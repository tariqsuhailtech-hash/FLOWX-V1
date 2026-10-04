export const fmtNum = (n, d = 2) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtCompact = (n) => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(a < 10 ? 2 : 0);
};
export const fmtUsd = (n) => (n < 0 ? "-$" : "$") + fmtCompact(Math.abs(n));
export const fmtVol = (q) => {
  if (q == null || Number.isNaN(q)) return "—";
  if (q >= 1e6) return (q / 1e6).toFixed(2) + "M";
  if (q >= 1000) return (q / 1000).toFixed(1) + "K";
  if (q >= 100) return q.toFixed(0);
  if (q >= 10) return q.toFixed(1);
  if (q >= 1) return q.toFixed(2);
  if (q >= 0.01) return q.toFixed(3);
  return q.toFixed(4);
};
export const signed = (n, d = 0) => (n > 0 ? "+" : "") + fmtNum(n, d);
export const signedVol = (n) => (n > 0 ? "+" : n < 0 ? "-" : "") + fmtVol(Math.abs(n));
export const fmtTime = (t) => new Date(t).toLocaleTimeString("en-GB", { hour12: false });
export const fmtClock = (t) => new Date(t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
export const fmtDate = (s) => (s ? new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const priceDecimals = (prices, fallback = 2) => {
  let d = 0;
  for (const p of prices.slice(0, 12)) { const s = String(p); const i = s.indexOf("."); if (i >= 0) d = Math.max(d, Math.min(6, s.length - i - 1)); }
  return prices.length ? Math.max(d, fallback) : fallback;
};
export const ago = (s) => {
  if (!s) return "never";
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 2) return "now";
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};
