import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Trash2 } from "lucide-react";
import { runBacktest } from "@/lib/analytics";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PRICE_DEC } from "@/lib/marketEngine";
import { fmtClock, fmtDate, fmtNum, signed } from "@/lib/format";
import { Metric, Empty } from "../ui";

export const BacktestTab = ({ market, settings }) => {
  const [p, setP] = useState({ strategy: "imbalance", hold: 6, stopTicks: 15, targetTicks: 30 });
  const [res, setRes] = useState(null);
  const dec = PRICE_DEC[market.symbol];
  const run = () => { const r = runBacktest(market.candles, market.tick, { ...p, ...settings }); setRes(r); toast(r.stats.count ? `Backtest complete · ${r.stats.count} trades` : "No setups found in loaded history", { description: `${market.symbol} · ${market.tf} · ${market.candles.length} bars` }); };
  const F = ({ k, label, min, max }) => <label className="flex flex-col gap-1"><span className="label">{label}</span><input type="number" min={min} max={max} className="field h-8 text-xs num" value={p[k]} onChange={(e) => setP({ ...p, [k]: +e.target.value })} data-testid={`backtest-${k}`} /></label>;
  return (
    <div className="h-full flex" data-testid="backtest-tab">
      <div className="w-64 shrink-0 p-4 border-r border-line flex flex-col gap-3">
        <label className="flex flex-col gap-1"><span className="label">Strategy</span>
          <select className="field h-8 text-xs" value={p.strategy} onChange={(e) => setP({ ...p, strategy: e.target.value })} data-testid="backtest-strategy"><option value="imbalance">Stacked imbalance continuation</option><option value="delta">Delta breakout</option><option value="absorption">Absorption reversal</option></select></label>
        <div className="grid grid-cols-3 gap-2"><F k="hold" label="Hold bars" min={1} max={50} /><F k="stopTicks" label="Stop · ticks" min={1} max={500} /><F k="targetTicks" label="Target · ticks" min={1} max={1000} /></div>
        <button onClick={run} className="btn-brand h-8 text-xs" data-testid="backtest-run-button">Run on {market.candles.length} bars</button>
        <p className="text-[10px] text-t3 leading-relaxed">Runs on the loaded {market.tf} history. Historical footprint cells are approximated from kline data; results are illustrative, not a performance promise.</p>
      </div>
      {res ? (
        <div className="flex-1 min-w-0 flex">
          <div className="w-56 shrink-0 p-4 grid grid-cols-2 gap-3 content-start border-r border-line">
            <Metric label="Trades" value={String(res.stats.count)} testid="bt-count" />
            <Metric label="Win rate" value={`${res.stats.winRate.toFixed(0)}%`} tone={res.stats.winRate >= 50 ? "bull" : "bear"} testid="bt-winrate" />
            <Metric label="Net P&L" value={`${signed(res.stats.pnlPct, 2)}%`} tone={res.stats.pnlPct >= 0 ? "bull" : "bear"} testid="bt-pnl" />
            <Metric label="Max DD" value={`${res.stats.maxDD.toFixed(2)}%`} tone="warn" />
            <Metric label="Avg win" value={`+${res.stats.avgWin.toFixed(2)}%`} tone="bull" />
            <Metric label="Avg loss" value={`-${res.stats.avgLoss.toFixed(2)}%`} tone="bear" />
            <Metric label="Profit factor" value={res.stats.pf.toFixed(2)} tone="viol" />
          </div>
          <div className="flex-1 min-w-0 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={res.equity} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
                <XAxis dataKey="i" tick={{ fill: "#5B677A", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5B677A", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "#121722", border: "1px solid #273042", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                <ReferenceLine y={0} stroke="#273042" />
                <Line type="stepAfter" dataKey="eq" stroke="#B388FF" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="w-64 shrink-0 border-l border-line overflow-y-auto font-mono text-[11px]">
            {res.trades.slice().reverse().map((t, i) => <div key={i} className="flex items-center gap-2 px-3 h-7 border-b border-line/60"><span className="text-t3">{fmtClock(t.t)}</span><span className={t.dir > 0 ? "text-bull" : "text-bear"}>{t.dir > 0 ? "LONG" : "SHORT"}</span><span className="text-t2">{t.entry.toFixed(dec)}</span><span className={`ml-auto ${t.pnl >= 0 ? "text-bull" : "text-bear"}`}>{signed(t.pnlPct, 2)}%</span><span className="label text-[8px] w-10 text-right">{t.reason}</span></div>)}
          </div>
        </div>
      ) : <Empty>Configure a strategy and run it against the loaded footprint history.</Empty>}
    </div>
  );
};

export const JournalTab = ({ market }) => {
  const { user } = useAuth(); const dec = PRICE_DEC[market.symbol];
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ side: "long", entry: "", exit: "", size: "", setup: "Stacked imbalance", notes: "", rating: 3 });
  useEffect(() => { if (user) api.get("/me/journal").then((r) => setEntries(r.data)).catch(() => {}); }, [user]);
  const submit = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post("/me/journal", { symbol: market.symbol, side: form.side, entry: +form.entry, exit: form.exit === "" ? null : +form.exit, size: +form.size || 0, setup: form.setup, notes: form.notes, rating: +form.rating }); setEntries((l) => [data, ...l]); setForm({ ...form, entry: "", exit: "", size: "", notes: "" }); toast.success("Trade journaled"); }
    catch (err) { toast.error(errMsg(err)); }
  };
  const remove = async (id) => { await api.delete(`/me/journal/${id}`); setEntries((l) => l.filter((x) => x.id !== id)); };
  if (!user) return <Empty><span><Link to="/login" className="text-brand underline" data-testid="journal-login-link">Sign in</Link> to keep a persistent trade journal.</span></Empty>;
  const pnl = entries.reduce((a, e) => a + (e.pnl || 0), 0);
  return (
    <div className="h-full flex" data-testid="journal-tab">
      <form onSubmit={submit} className="w-80 shrink-0 p-3 border-r border-line grid grid-cols-2 gap-2 content-start" data-testid="journal-form">
        <select className="field h-8 text-xs" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })} data-testid="journal-side"><option value="long">Long</option><option value="short">Short</option></select>
        <input className="field h-8 text-xs num" placeholder="Size" type="number" step="any" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} data-testid="journal-size" />
        <input className="field h-8 text-xs num" placeholder={`Entry (${market.ticker.last.toFixed(dec)})`} type="number" step="any" required value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} data-testid="journal-entry" />
        <input className="field h-8 text-xs num" placeholder="Exit (optional)" type="number" step="any" value={form.exit} onChange={(e) => setForm({ ...form, exit: e.target.value })} data-testid="journal-exit" />
        <select className="field h-8 text-xs" value={form.setup} onChange={(e) => setForm({ ...form, setup: e.target.value })} data-testid="journal-setup">{["Stacked imbalance", "Absorption reversal", "Delta divergence", "VWAP reclaim", "POC rejection", "Liquidity sweep", "Other"].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="field h-8 text-xs" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} data-testid="journal-rating">{[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>Execution {r}/5</option>)}</select>
        <textarea className="field h-14 py-1.5 text-xs col-span-2 resize-none" placeholder="What did the order flow tell you?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="journal-notes" />
        <button className="btn-brand h-8 text-xs col-span-2" data-testid="journal-submit">Log trade · {market.symbol}</button>
      </form>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="hdr"><span className="label text-t2">{entries.length} entries</span><span className={`num text-xs ${pnl >= 0 ? "text-bull" : "text-bear"}`}>Net {signed(pnl, 2)}</span></div>
        <div className="flex-1 overflow-y-auto">
          {entries.map((e) => (
            <div key={e.id} className="grid grid-cols-[90px_60px_1fr_1fr_1fr_60px_24px] items-center gap-2 px-3 h-9 border-b border-line/60 font-mono text-[11px]" data-testid="journal-entry-row">
              <span className="text-t3">{fmtDate(e.created_at)}</span><span className={e.side === "long" ? "text-bull" : "text-bear"}>{e.side.toUpperCase()}</span>
              <span className="text-t1">{e.symbol} · {fmtNum(e.entry, PRICE_DEC[e.symbol] ?? 2)}{e.exit != null ? ` → ${fmtNum(e.exit, PRICE_DEC[e.symbol] ?? 2)}` : ""}</span>
              <span className="text-t2 truncate">{e.setup}</span><span className="text-t3 truncate">{e.notes}</span>
              <span className={`text-right ${e.pnl >= 0 ? "text-bull" : "text-bear"}`}>{signed(e.pnl, 2)}</span>
              <button onClick={() => remove(e.id)} className="text-t3 hover:text-bear" data-testid="journal-delete"><Trash2 size={12} /></button>
            </div>
          ))}
          {!entries.length && <Empty>No journal entries yet. Log your first trade on the left.</Empty>}
        </div>
      </div>
    </div>
  );
};
