import { useMemo, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, BarChart } from "recharts";
import { cumulativeDelta, detectAbsorption, markImbalances, volumeProfile } from "@/lib/analytics";
import { PRICE_DEC } from "@/lib/marketEngine";
import { fmtClock, fmtTime, fmtUsd, fmtVol, signedVol } from "@/lib/format";
import { Metric } from "../ui";

const tooltipStyle = { contentStyle: { background: "#121722", border: "1px solid #273042", fontSize: 11, fontFamily: "JetBrains Mono" }, labelStyle: { color: "#8B97AB" } };

export const OrderFlowTab = ({ market, settings }) => {
  const { candles } = market;
  const sess = useMemo(() => {
    if (!candles.length) return null;
    const day = Math.floor(candles[candles.length - 1].t / 86400000);
    const s = candles.filter((c) => Math.floor(c.t / 86400000) === day); const src = s.length ? s : candles;
    const buy = src.reduce((a, c) => a + c.buy, 0), sell = src.reduce((a, c) => a + c.sell, 0);
    let askI = 0, bidI = 0;
    candles.slice(-5).forEach((c) => Object.values(markImbalances(c.cells, market.tick, settings.imbalanceRatio, settings.stackedCount)).forEach((f) => { if (f.askImb) askI++; if (f.bidImb) bidI++; }));
    const abs = detectAbsorption(candles, settings.absorptionMultiplier);
    return { buy, sell, total: buy + sell, delta: candles[candles.length - 1].delta, cum: buy - sell, aggr: buy + sell ? (buy / (buy + sell)) * 100 : 50, askI, bidI, abs: abs.length, lastAbs: abs[abs.length - 1] };
  }, [market.version, settings]);
  if (!sess) return null;
  return (
    <div className="h-full grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-x-6 gap-y-4 p-4 content-start" data-testid="orderflow-tab">
      <Metric label="Buy Volume" value={fmtVol(sess.buy)} tone="bull" size="lg" testid="of-buy-volume" />
      <Metric label="Sell Volume" value={fmtVol(sess.sell)} tone="bear" size="lg" testid="of-sell-volume" />
      <Metric label="Total Volume" value={fmtVol(sess.total)} size="lg" testid="of-total-volume" />
      <Metric label="Delta · bar" value={signedVol(sess.delta)} tone={sess.delta >= 0 ? "bull" : "bear"} size="lg" testid="of-delta" />
      <Metric label="Cumulative Delta" value={signedVol(sess.cum)} tone={sess.cum >= 0 ? "bull" : "bear"} size="lg" testid="of-cum-delta" />
      <div className="flex flex-col gap-1" data-testid="of-aggression"><span className="label">Aggression</span><span className="num text-lg text-t1">{sess.aggr.toFixed(0)}<span className="text-xs text-t3">% buy</span></span><div className="h-1 bg-bear/50 relative rounded-sm overflow-hidden"><div className="absolute left-0 top-0 h-full bg-bull bar-anim" style={{ width: `${sess.aggr}%` }} /></div></div>
      <Metric label="Imbalance · 5 bars" value={`${sess.askI}↑ ${sess.bidI}↓`} tone={sess.askI > sess.bidI ? "bull" : sess.askI < sess.bidI ? "bear" : ""} size="lg" testid="of-imbalance" />
      <Metric label="Absorption" value={sess.abs ? `${sess.abs} zones` : "None"} tone={sess.abs ? "warn" : ""} sub={sess.lastAbs ? `${sess.lastAbs.label} @ ${sess.lastAbs.price.toFixed(PRICE_DEC[market.symbol])}` : "No absorption in last 30 bars"} size="lg" testid="of-absorption" />
    </div>
  );
};

export const DeltaTab = ({ market }) => {
  const data = useMemo(() => { const cum = cumulativeDelta(market.candles); return market.candles.slice(-80).map((c, i, arr) => ({ t: fmtClock(c.t), delta: +c.delta.toFixed(3), cum: +cum[market.candles.length - arr.length + i].toFixed(3) })); }, [market.version]);
  const last = data[data.length - 1];
  return (
    <div className="h-full flex" data-testid="delta-tab">
      <div className="w-44 shrink-0 p-4 flex flex-col gap-4 border-r border-line">
        <Metric label="Cumulative Δ" value={last ? signedVol(last.cum) : "—"} tone={last?.cum >= 0 ? "bull" : "bear"} size="lg" />
        <Metric label="Bar Δ" value={last ? signedVol(last.delta) : "—"} tone={last?.delta >= 0 ? "bull" : "bear"} />
        <Metric label="Max Δ · 80 bars" value={data.length ? signedVol(Math.max(...data.map((d) => d.delta))) : "—"} tone="bull" />
        <Metric label="Min Δ · 80 bars" value={data.length ? signedVol(Math.min(...data.map((d) => d.delta))) : "—"} tone="bear" />
      </div>
      <div className="flex-1 min-w-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
            <XAxis dataKey="t" tick={{ fill: "#5B677A", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="d" tick={{ fill: "#5B677A", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={44} tickFormatter={fmtVol} />
            <YAxis yAxisId="c" orientation="right" tick={{ fill: "#B388FF", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={48} tickFormatter={fmtVol} />
            <Tooltip {...tooltipStyle} />
            <ReferenceLine yAxisId="d" y={0} stroke="#273042" />
            <Bar yAxisId="d" dataKey="delta" isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={d.delta >= 0 ? "#22D38B" : "#FF4D6D"} fillOpacity={0.8} />)}</Bar>
            <Line yAxisId="c" type="monotone" dataKey="cum" stroke="#B388FF" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const VolumeTab = ({ market }) => {
  const dec = PRICE_DEC[market.symbol];
  const data = useMemo(() => market.candles.slice(-80).map((c) => ({ t: fmtClock(c.t), buy: +c.buy.toFixed(3), sell: +c.sell.toFixed(3) })), [market.version]);
  const prof = useMemo(() => volumeProfile(market.candles, market.tick), [market.version]);
  return (
    <div className="h-full flex" data-testid="volume-tab">
      <div className="w-64 shrink-0 p-4 border-r border-line grid grid-cols-3 gap-3 content-start">
        <Metric label="POC" value={prof.poc.toFixed(dec)} tone="brand" testid="vp-poc" />
        <Metric label="VAH" value={prof.vah.toFixed(dec)} tone="viol" testid="vp-vah" />
        <Metric label="VAL" value={prof.val.toFixed(dec)} tone="viol" testid="vp-val" />
        <div className="col-span-3"><span className="label">High Volume Nodes</span><div className="flex flex-wrap gap-1 mt-1">{prof.hvn.slice(0, 6).map((l) => <span key={l.price} className="px-1.5 py-0.5 bg-brand/10 text-brand font-mono text-[10px] border border-brand/30">{l.price.toFixed(dec)}</span>)}{!prof.hvn.length && <span className="text-t3 text-xs">—</span>}</div></div>
        <div className="col-span-3"><span className="label">Low Volume Nodes</span><div className="flex flex-wrap gap-1 mt-1">{prof.lvn.slice(0, 6).map((l) => <span key={l.price} className="px-1.5 py-0.5 bg-elev text-t2 font-mono text-[10px] border border-line2">{l.price.toFixed(dec)}</span>)}{!prof.lvn.length && <span className="text-t3 text-xs">—</span>}</div></div>
      </div>
      <div className="flex-1 min-w-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
            <XAxis dataKey="t" tick={{ fill: "#5B677A", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#5B677A", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={44} tickFormatter={fmtVol} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="buy" stackId="v" fill="#22D38B" fillOpacity={0.8} isAnimationActive={false} />
            <Bar dataKey="sell" stackId="v" fill="#FF4D6D" fillOpacity={0.8} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const TradesTab = ({ market, settings }) => {
  const [min, setMin] = useState(settings.largeTradeUsd / 5);
  const dec = PRICE_DEC[market.symbol];
  const rows = market.trades.filter((t) => t.value >= min);
  const buy = rows.filter((t) => t.side === "buy").reduce((a, t) => a + t.value, 0), sell = rows.filter((t) => t.side === "sell").reduce((a, t) => a + t.value, 0);
  return (
    <div className="h-full flex flex-col" data-testid="trades-tab">
      <div className="flex items-center gap-4 px-4 h-9 border-b border-line shrink-0">
        <span className="label">Min value</span>
        <input type="range" min={0} max={settings.largeTradeUsd * 4} step={1000} value={min} onChange={(e) => setMin(+e.target.value)} className="w-40 accent-[#F2C879]" data-testid="trades-min-value-slider" />
        <span className="num text-xs text-brand">{fmtUsd(min)}</span>
        <span className="ml-auto num text-xs text-bull">BUY {fmtUsd(buy)}</span><span className="num text-xs text-bear">SELL {fmtUsd(sell)}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full font-mono text-[11px]"><thead className="sticky top-0 bg-panel"><tr className="label h-6"><th className="text-left px-4 font-normal">Time</th><th className="text-left font-normal">Price</th><th className="text-right font-normal">Size</th><th className="text-center font-normal">Side</th><th className="text-right px-4 font-normal">Value</th></tr></thead>
          <tbody>{rows.slice(0, 200).map((t) => <tr key={t.id} className="h-[20px] border-t border-line/60"><td className="px-4 text-t3">{fmtTime(t.time)}</td><td className={t.side === "buy" ? "text-bull" : "text-bear"}>{t.price.toFixed(dec)}</td><td className="text-right text-t1">{fmtVol(t.qty)}</td><td className={`text-center text-[9px] font-bold ${t.side === "buy" ? "text-bull" : "text-bear"}`}>{t.side.toUpperCase()}</td><td className="text-right px-4 text-t1">{fmtUsd(t.value)}</td></tr>)}</tbody></table>
        {!rows.length && <div className="p-4 text-t3 text-xs font-mono">No prints above threshold yet.</div>}
      </div>
    </div>
  );
};
