import { useEffect, useMemo, useRef } from "react";
import { DEPTHS, PRICE_DEC } from "@/lib/marketEngine";
import { fmtVol, priceDecimals } from "@/lib/format";
import { PanelHeader } from "./ui";

export const DomPanel = ({ market, depth, onDepth, compact }) => {
  const { book, symbol, exchange } = market;
  const dec = useMemo(() => priceDecimals(book.asks.concat(book.bids).map((x) => x[0]), PRICE_DEC[symbol]), [book, symbol]);
  const spreadRef = useRef(null);
  const n = compact ? Math.min(depth, 12) : depth;
  const asks = useMemo(() => book.asks.slice(0, n).reverse(), [book, n]);
  const bids = useMemo(() => book.bids.slice(0, n), [book, n]);
  const all = asks.concat(bids); const maxSize = Math.max(1e-9, ...all.map((x) => x[1]));
  const avg = all.length ? all.reduce((a, x) => a + x[1], 0) / all.length : 0;
  const bestAsk = book.asks[0]?.[0], bestBid = book.bids[0]?.[0];
  const spread = bestAsk && bestBid ? bestAsk - bestBid : null;
  const bidTot = bids.reduce((a, x) => a + x[1], 0), askTot = asks.reduce((a, x) => a + x[1], 0);
  const bidPct = bidTot + askTot ? (bidTot / (bidTot + askTot)) * 100 : 50;
  useEffect(() => { const el = spreadRef.current; const parent = el?.parentElement; if (el && parent) parent.scrollTop = el.offsetTop - parent.clientHeight / 2; }, [depth, symbol, exchange, asks.length]);
  const maxDepth = exchange === "BINANCE" ? 1000 : 50;

  const Row = ({ p, q, side, best }) => {
    const wall = q > avg * 2.5 && q > maxSize * 0.45; const w = (q / maxSize) * 100;
    return (
      <div className={`relative grid grid-cols-[1fr_1fr_1.3fr] items-center h-[18px] px-2 font-mono text-[11px] ${wall ? (side === "ask" ? "bg-bear/10" : "bg-bull/10") : ""}`} data-testid={`dom-row-${side}`}>
        <span className={`${side === "ask" ? "text-bear" : "text-bull"} ${best ? "font-bold" : ""}`}>{p.toFixed(dec)}</span>
        <span className={`text-right ${wall ? "text-t1 font-semibold" : "text-t2"}`}>{fmtVol(q)}</span>
        <span className="relative h-[10px] ml-2"><span className={`absolute left-0 top-0 h-full bar-anim ${side === "ask" ? "bg-bear/60" : "bg-bull/60"} ${wall ? "!bg-opacity-100" : ""}`} style={{ width: `${w}%` }} /></span>
        {wall && <span className={`absolute right-1 top-0 text-[8px] tracking-widest ${side === "ask" ? "text-bear" : "text-bull"}`}>WALL</span>}
      </div>
    );
  };

  return (
    <section className="flex flex-col min-h-0 h-full" data-testid="dom-panel">
      <PanelHeader title="Order Book · DOM">
        {!compact && (
          <select value={depth} onChange={(e) => onDepth(+e.target.value)} className="bg-void border border-line text-[10px] font-mono text-t2 h-6 px-1 rounded-sm" data-testid="dom-depth-select">
            {DEPTHS.filter((d) => d <= maxDepth).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </PanelHeader>
      <div className="px-2 py-1.5 border-b border-line shrink-0">
        <div className="flex justify-between label mb-1"><span className="text-bull">BID {bidPct.toFixed(0)}%</span><span>LIQUIDITY IMBALANCE</span><span className="text-bear">ASK {(100 - bidPct).toFixed(0)}%</span></div>
        <div className="h-1 bg-bear/50 relative overflow-hidden rounded-sm"><div className="absolute left-0 top-0 h-full bg-bull bar-anim" style={{ width: `${bidPct}%` }} /></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1.3fr] px-2 h-6 items-center label shrink-0 border-b border-line"><span>Price</span><span className="text-right">Size</span><span className="pl-2">Liquidity</span></div>
      <div className="flex-1 min-h-0 overflow-y-auto relative">
        {asks.map(([p, q], i) => <Row key={`a${i}`} p={p} q={q} side="ask" best={i === asks.length - 1} />)}
        <div ref={spreadRef} className="h-7 flex items-center justify-between px-2 bg-elev border-y border-line font-mono text-[11px]" data-testid="dom-spread-row">
          <span className="label">SPREAD</span>
          <span className="text-info">{spread != null ? spread.toFixed(dec) : "—"}</span>
          <span className="text-t3">{spread != null && bestBid ? `${((spread / bestBid) * 1e4).toFixed(2)} bps` : ""}</span>
        </div>
        {bids.map(([p, q], i) => <Row key={`b${i}`} p={p} q={q} side="bid" best={i === 0} />)}
      </div>
      <div className="h-7 grid grid-cols-2 px-2 items-center font-mono text-[10px] border-t border-line shrink-0">
        <span className="text-t3">BEST BID <span className="text-bull">{bestBid?.toFixed(dec) ?? "—"}</span></span>
        <span className="text-t3 text-right">BEST ASK <span className="text-bear">{bestAsk?.toFixed(dec) ?? "—"}</span></span>
      </div>
    </section>
  );
};
