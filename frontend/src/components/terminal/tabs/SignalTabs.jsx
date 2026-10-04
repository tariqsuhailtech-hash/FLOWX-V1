import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PRICE_DEC } from "@/lib/marketEngine";
import { fmtNum } from "@/lib/format";
import { AlertCard } from "../AlertCard";
import { ConfidencePill, Empty } from "../ui";

export const SignalsTab = ({ signal, market }) => {
  const long = signal.bias === "LONG BIAS", short = signal.bias === "SHORT BIAS";
  return (
    <div className="h-full flex" data-testid="signals-tab">
      <div className={`w-72 shrink-0 p-5 border-r border-line flex flex-col justify-between ${long ? "bg-bull/5" : short ? "bg-bear/5" : ""}`}>
        <div>
          <span className="label">Order-flow bias · {market.symbol}</span>
          <div className={`display text-3xl font-bold tracking-wider mt-2 ${long ? "text-bull" : short ? "text-bear" : "text-t2"}`} data-testid="signal-bias">{signal.bias}</div>
          <div className="mt-3 flex items-center gap-3"><ConfidencePill level={signal.confidence} /><span className="num text-xs text-t3">score {signal.score > 0 ? "+" : ""}{signal.score.toFixed(1)}</span></div>
        </div>
        <p className="text-[10px] text-t3 leading-relaxed">Probabilistic read of current order flow. Not financial advice and never a guarantee — confidence reflects factor agreement, not outcome certainty.</p>
      </div>
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 content-start">
        {signal.factors.map((f) => (
          <div key={f.label} className="flex items-center justify-between border-b border-line/70 py-1.5 font-mono text-[11px]" data-testid="signal-factor">
            <span className="text-t2">{f.label}</span>
            <span className={`flex items-center gap-2 ${f.dir > 0 ? "text-bull" : f.dir < 0 ? "text-bear" : "text-t3"}`}>{f.value}<span className="w-3 text-center">{f.dir > 0 ? "▲" : f.dir < 0 ? "▼" : "•"}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AlertsTab = ({ alerts, market, rules, setRules }) => {
  const { user } = useAuth(); const dec = PRICE_DEC[market.symbol];
  const [form, setForm] = useState({ condition: "above", value: "", note: "" });
  useEffect(() => { if (market.ticker.last && !form.value) setForm((f) => ({ ...f, value: market.ticker.last.toFixed(dec) })); }, [market.ticker.last]);
  const add = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post("/me/alerts", { symbol: market.symbol, condition: form.condition, value: +form.value, note: form.note }); setRules((r) => [data, ...r]); toast.success("Price alert armed", { description: `${market.symbol} ${form.condition} ${fmtNum(+form.value, dec)}` }); setForm((f) => ({ ...f, note: "" })); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const remove = async (id) => { await api.delete(`/me/alerts/${id}`); setRules((r) => r.filter((x) => x.id !== id)); };
  const toggle = async (rule) => { const { data } = await api.patch(`/me/alerts/${rule.id}`, { enabled: !rule.enabled }); setRules((r) => r.map((x) => (x.id === rule.id ? data : x))); };
  return (
    <div className="h-full flex" data-testid="alerts-tab">
      <div className="flex-1 min-w-0 p-3 overflow-x-auto">
        <span className="label block mb-2">Live detections · absorption & stacked imbalance</span>
        {alerts.length ? <div className="flex gap-3">{alerts.map((a) => <AlertCard key={a.id} alert={a} />)}</div> : <Empty>No absorption or stacked imbalance detected in recent bars. Detection runs continuously on live footprint data.</Empty>}
      </div>
      <div className="w-80 shrink-0 border-l border-line flex flex-col">
        <div className="hdr"><span className="label text-t2">Price alerts</span><span className="label">{rules.filter((r) => r.enabled).length} armed</span></div>
        {user ? (<>
          <form onSubmit={add} className="p-3 grid grid-cols-[72px_1fr] gap-2 border-b border-line" data-testid="price-alert-form">
            <select className="field h-8 text-xs" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} data-testid="price-alert-condition"><option value="above">Above</option><option value="below">Below</option></select>
            <input className="field h-8 text-xs num" type="number" step="any" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required data-testid="price-alert-value" />
            <input className="field h-8 text-xs col-span-2" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} data-testid="price-alert-note" />
            <button className="btn-brand h-8 text-xs col-span-2" data-testid="price-alert-submit">Arm alert · {market.symbol}</button>
          </form>
          <div className="flex-1 overflow-y-auto">
            {rules.map((r) => (
              <div key={r.id} className={`flex items-center gap-2 px-3 h-9 border-b border-line/60 font-mono text-[11px] ${r.enabled ? "" : "opacity-50"}`} data-testid="price-alert-rule">
                <button onClick={() => toggle(r)} className={`h-2 w-2 rounded-full ${r.enabled ? "bg-bull live-dot" : "bg-t3"}`} title="Toggle" data-testid="price-alert-toggle" />
                <span className="text-t1">{r.symbol}</span><span className="text-t3">{r.condition}</span><span className="text-brand">{fmtNum(r.value, PRICE_DEC[r.symbol] ?? 2)}</span>
                <span className="ml-auto text-t3 truncate max-w-[80px]">{r.triggered_at ? "fired" : r.note}</span>
                <button onClick={() => remove(r.id)} className="text-t3 hover:text-bear" data-testid="price-alert-delete"><Trash2 size={12} /></button>
              </div>
            ))}
            {!rules.length && <Empty>No price alerts yet.</Empty>}
          </div>
        </>) : <Empty><span><Link to="/login" className="text-brand underline" data-testid="alerts-login-link">Sign in</Link> to arm persistent price alerts.</span></Empty>}
      </div>
    </div>
  );
};
