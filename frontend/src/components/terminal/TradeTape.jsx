import { useMemo } from "react";
import { PRICE_DEC } from "@/lib/marketEngine";
import { fmtTime, fmtUsd, fmtVol, priceDecimals } from "@/lib/format";
import { PanelHeader } from "./ui";

export const TradeTape = ({ market, largeUsd = 50000, compact, frozen }) => {
  const dec = useMemo(() => priceDecimals(market.trades.slice(0, 12).map((t) => t.price), PRICE_DEC[market.symbol]), [market.trades[0]?.id, market.symbol]);
  const base = market.symbol.replace("USDT", "");
  const rows = market.trades.slice(0, compact ? 40 : 90);
  const cols = "grid-cols-[58px_1fr_1fr_34px_1fr]";
  return (
    <section className="flex flex-col min-h-0 h-full" data-testid="trade-tape">
      <PanelHeader title="Time & Sales">{frozen ? <span className="label text-warn">REPLAY · PAUSED</span> : <span className="label text-t3">{market.msgRate} msg/s</span>}</PanelHeader>
      <div className={`grid ${cols} px-2 h-6 items-center label border-b border-line shrink-0`}><span>Time</span><span>Price</span><span className="text-right">Size {base}</span><span className="text-center">Side</span><span className="text-right">Value</span></div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.map((t) => {
          const big = t.value >= largeUsd; const buy = t.side === "buy";
          return (
            <div key={t.id} className={`tape-in grid ${cols} px-2 h-[18px] items-center font-mono text-[10px] ${big ? (buy ? "bg-bull/15" : "bg-bear/15") : ""}`} data-testid="tape-row">
              <span className="text-t3">{fmtTime(t.time)}</span>
              <span className={buy ? "text-bull" : "text-bear"}>{t.price.toFixed(dec)}</span>
              <span className={`text-right ${big ? "text-t1 font-semibold" : "text-t2"}`}>{fmtVol(t.qty)}</span>
              <span className={`text-center text-[9px] font-bold tracking-wider ${buy ? "text-bull" : "text-bear"}`}>{buy ? "BUY" : "SELL"}</span>
              <span className={`text-right ${big ? (buy ? "text-bull" : "text-bear") : "text-t2"}`}>{fmtUsd(t.value)}</span>
            </div>
          );
        })}
        {!rows.length && <div className="p-4 text-t3 font-mono text-xs">Waiting for prints…</div>}
      </div>
    </section>
  );
};
