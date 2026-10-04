import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Star, Trash2, ArrowUpRight } from "lucide-react";
import { AppNav, Card } from "@/components/AppNav";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { SYMBOLS, PRICE_DEC } from "@/lib/marketEngine";
import { fmtCompact, fmtDate, fmtNum, signed } from "@/lib/format";
import { ConfidencePill } from "@/components/terminal/ui";

const useTickers = (symbols) => {
  const [data, setData] = useState({});
  useEffect(() => {
    if (!symbols.length) return;
    let alive = true;
    const load = async () => {
      try { const r = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`); const j = await r.json(); if (alive && Array.isArray(j)) setData(Object.fromEntries(j.map((t) => [t.symbol, { last: +t.lastPrice, pct: +t.priceChangePercent, vol: +t.quoteVolume, high: +t.highPrice, low: +t.lowPrice }]))); } catch {}
    };
    load(); const id = setInterval(load, 5000); return () => { alive = false; clearInterval(id); };
  }, [symbols.join(",")]);
  return data;
};

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const [usage, setUsage] = useState(null); const [alerts, setAlerts] = useState([]); const [signals, setSignals] = useState([]); const [layouts, setLayouts] = useState([]);
  const favorites = user?.favorites || [];
  const tickers = useTickers(favorites);
  useEffect(() => {
    api.get("/me/usage").then((r) => setUsage(r.data)).catch(() => {});
    api.get("/me/alerts").then((r) => setAlerts(r.data)).catch(() => {});
    api.get("/me/signals").then((r) => setSignals(r.data)).catch(() => {});
    api.get("/me/layouts").then((r) => setLayouts(r.data)).catch(() => {});
  }, []);
  const toggleFav = async (s) => { const next = favorites.includes(s) ? favorites.filter((x) => x !== s) : [...favorites, s]; const { data } = await api.put("/me/favorites", { symbols: next }); setUser({ ...user, favorites: data.favorites }); };
  const saveLayout = async () => { const cfg = JSON.parse(localStorage.getItem("flowx_settings") || "{}"); const { data } = await api.post("/me/layouts", { name: `${cfg.symbol || "BTCUSDT"} · ${cfg.timeframe || "1m"} · ${new Date().toLocaleDateString("en-GB")}`, config: cfg }); setLayouts((l) => [data, ...l]); toast.success("Current terminal layout saved"); };
  const loadLayout = (l) => { localStorage.setItem("flowx_settings", JSON.stringify(l.config)); toast.success(`Layout "${l.name}" applied`, { description: "Open the terminal to use it" }); };
  const delLayout = async (id) => { await api.delete(`/me/layouts/${id}`); setLayouts((l) => l.filter((x) => x.id !== id)); };
  const toggleAlert = async (a) => { const { data } = await api.patch(`/me/alerts/${a.id}`, { enabled: !a.enabled }); setAlerts((l) => l.map((x) => (x.id === a.id ? data : x))); };

  return (
    <div className="min-h-screen bg-void" data-testid="user-dashboard">
      <AppNav />
      <div className="max-w-[1500px] mx-auto px-5 py-6">
        <div className="flex items-end justify-between mb-6">
          <div><span className="label text-brand">Trader hub</span><h1 className="display text-2xl font-semibold text-t1 mt-1">Welcome back, {user.name}</h1></div>
          <Link to="/terminal" className="btn-brand h-9 px-4 text-xs" data-testid="dashboard-open-terminal">Open terminal <ArrowUpRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4">
          <Card title="My markets · live" className="md:col-span-6 xl:col-span-7" testid="my-markets-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {favorites.map((s) => { const t = tickers[s]; return (
                <Link to="/terminal" key={s} onClick={() => localStorage.setItem("flowx_settings", JSON.stringify({ ...JSON.parse(localStorage.getItem("flowx_settings") || "{}"), symbol: s }))} className="flex items-center justify-between border border-line px-3 h-14 hover:border-brand/50 transition-colors duration-150" data-testid={`market-tile-${s.toLowerCase()}`}>
                  <div><div className="font-mono text-xs text-t1">{s}</div><div className="text-[10px] text-t3 font-mono">24h vol {t ? fmtCompact(t.vol) : "—"}</div></div>
                  <div className="text-right"><div className="num text-sm text-t1">{t ? fmtNum(t.last, PRICE_DEC[s]) : "—"}</div><div className={`num text-[11px] ${t?.pct >= 0 ? "text-bull" : "text-bear"}`}>{t ? signed(t.pct, 2) + "%" : "loading"}</div></div>
                </Link>); })}
              {!favorites.length && <div className="text-xs text-t3">Star symbols below to track them here.</div>}
            </div>
          </Card>
          <Card title="Subscription" className="md:col-span-3 xl:col-span-5" testid="subscription-card">
            <div className="flex items-start justify-between">
              <div><div className="display text-2xl font-bold text-brand uppercase">{user.plan}</div><div className="text-xs text-t3 mt-1">Member since {fmtDate(user.created_at)}</div></div>
              <Link to="/#pricing" className="btn-ghost h-8 px-3 text-[11px]" data-testid="subscription-manage-link">Manage plan</Link>
            </div>
            {usage && <div className="grid grid-cols-3 gap-3 mt-5">{[["Alerts", usage.alerts, usage.limits.alerts], ["Exchanges", usage.limits.exchanges, null], ["DOM depth", usage.limits.depth, null]].map(([l, v, lim]) => <div key={l}><div className="label">{l}</div><div className="num text-sm text-t1">{v}{lim != null ? <span className="text-t3"> / {lim}</span> : ""}</div></div>)}</div>}
          </Card>
          <Card title="Favorite symbols" className="md:col-span-3 xl:col-span-4" testid="favorites-card">
            <div className="flex flex-wrap gap-2">{SYMBOLS.map((s) => <button key={s} onClick={() => toggleFav(s)} className={`inline-flex items-center gap-1.5 px-2.5 h-8 border font-mono text-[11px] transition-colors duration-150 ${favorites.includes(s) ? "border-brand/60 text-brand bg-brand/10" : "border-line text-t2 hover:text-t1"}`} data-testid={`fav-toggle-${s.toLowerCase()}`}><Star size={11} fill={favorites.includes(s) ? "currentColor" : "none"} />{s}</button>)}</div>
          </Card>
          <Card title="Saved layouts" className="md:col-span-3 xl:col-span-4" testid="layouts-card" action={<button onClick={saveLayout} className="label text-brand hover:underline" data-testid="save-layout-button">+ Save current</button>}>
            <div className="flex flex-col gap-1">{layouts.map((l) => <div key={l.id} className="flex items-center gap-2 h-8 border-b border-line/60 font-mono text-[11px]"><button onClick={() => loadLayout(l)} className="text-t1 hover:text-brand truncate text-left flex-1" data-testid="layout-apply-button">{l.name}</button><span className="text-t3">{l.config?.exchange}</span><button onClick={() => delLayout(l.id)} className="text-t3 hover:text-bear" data-testid="layout-delete-button"><Trash2 size={12} /></button></div>)}{!layouts.length && <div className="text-xs text-t3">No saved layouts yet.</div>}</div>
          </Card>
          <Card title="Usage" className="md:col-span-3 xl:col-span-4" testid="usage-card">
            {usage ? <div className="grid grid-cols-2 gap-4">{[["Sessions", usage.sessions], ["Signals logged", usage.signals], ["Journal entries", usage.journal], ["Alert rules", usage.alerts]].map(([l, v]) => <div key={l}><div className="label">{l}</div><div className="num text-xl text-t1">{v}</div></div>)}<div className="col-span-2 text-[10px] text-t3 font-mono">Last login {fmtDate(usage.lastLogin)}</div></div> : <div className="text-xs text-t3">Loading…</div>}
          </Card>
          <Card title="Price alerts" className="md:col-span-3 xl:col-span-5" testid="alerts-card">
            <div className="flex flex-col">{alerts.slice(0, 8).map((a) => <div key={a.id} className={`flex items-center gap-3 h-8 border-b border-line/60 font-mono text-[11px] ${a.enabled ? "" : "opacity-50"}`}><button onClick={() => toggleAlert(a)} className={`h-2 w-2 rounded-full ${a.enabled ? "bg-bull live-dot" : "bg-t3"}`} data-testid="dashboard-alert-toggle" /><span className="text-t1">{a.symbol}</span><span className="text-t3">{a.condition}</span><span className="text-brand">{fmtNum(a.value, PRICE_DEC[a.symbol] ?? 2)}</span><span className="ml-auto text-t3">{a.triggered_at ? "fired " + fmtDate(a.triggered_at) : a.note}</span></div>)}{!alerts.length && <div className="text-xs text-t3">No alerts. Arm them from the terminal's ALERTS tab.</div>}</div>
          </Card>
          <Card title="Recent signals" className="md:col-span-3 xl:col-span-7" testid="signals-card">
            <div className="flex flex-col">{signals.slice(0, 8).map((s) => <div key={s.id} className="flex items-center gap-3 h-9 border-b border-line/60 font-mono text-[11px]"><span className="text-t3 w-28">{fmtDate(s.created_at)}</span><span className="text-t1 w-20">{s.symbol}</span><span className={`w-24 font-semibold ${s.bias === "LONG BIAS" ? "text-bull" : "text-bear"}`}>{s.bias}</span><ConfidencePill level={s.confidence} /><span className="ml-auto text-t2">@ {fmtNum(s.price, PRICE_DEC[s.symbol] ?? 2)}</span></div>)}{!signals.length && <div className="text-xs text-t3">Signals you see in the terminal are logged here automatically.</div>}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
