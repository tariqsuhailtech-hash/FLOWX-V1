import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Link } from "react-router-dom";
import { CandlestickChart, BookOpen, ListOrdered, Radar, Bell } from "lucide-react";
import { EXCHANGES, SYMBOLS, TIMEFRAMES, PRICE_DEC } from "@/lib/marketEngine";
import { fmtNum, signed } from "@/lib/format";
import { useFlash } from "@/hooks/useMarket";
import { FootprintChart } from "./FootprintChart";
import { DomPanel } from "./DomPanel";
import { TradeTape } from "./TradeTape";
import { SignalsTab } from "./tabs/SignalTabs";
import { AlertCard } from "./AlertCard";
import { Logo, StatusDot, Empty } from "./ui";

const PANELS = [["chart", "Footprint", CandlestickChart], ["dom", "DOM", BookOpen], ["tape", "Tape", ListOrdered], ["signals", "Signals", Radar], ["alerts", "Alerts", Bell]];

export const MobileTerminal = ({ market, cfg, onCfg, overlays, settings, signal, alerts }) => {
  const [ref, api] = useEmblaCarousel({ loop: false, watchDrag: (_, evt) => !evt.target?.closest?.("[data-no-swipe]") });
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (!api) return; const fn = () => setIdx(api.selectedScrollSnap()); api.on("select", fn); return () => api.off("select", fn); }, [api]);
  const dec = PRICE_DEC[cfg.symbol]; const flash = useFlash(market.ticker.last);
  const Chips = ({ options, value, k, render }) => <div className="flex gap-1 overflow-x-auto no-scrollbar">{options.map((o) => <button key={o} onClick={() => onCfg({ [k]: o })} className={`px-2 h-6 text-[10px] font-mono whitespace-nowrap border rounded-sm ${o === value ? "bg-brand text-void border-brand font-semibold" : "border-line text-t2"}`} data-testid={`m-${k}-${String(o).toLowerCase().replace(/[^a-z0-9]/g, "")}`}>{render ? render(o) : o}</button>)}</div>;
  return (
    <div className="h-[100dvh] flex flex-col bg-void" data-testid="mobile-terminal">
      <header className="shrink-0 border-b border-line bg-panel px-3 pt-2 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between"><Link to="/"><Logo /></Link><StatusDot status={market.status} /></div>
        <div className="flex items-end justify-between">
          <div><div className="font-mono text-[11px] text-t2">{cfg.symbol} · {cfg.exchange} · {cfg.marketType.toUpperCase()}</div>
            <div className={`num text-2xl font-semibold leading-none mt-1 px-1 -mx-1 rounded-sm ${market.ticker.dir >= 0 ? "text-bull" : "text-bear"} ${flash}`} data-testid="m-last-price">{fmtNum(market.ticker.last, dec)}</div></div>
          <div className="text-right font-mono text-[11px]"><div className={market.ticker.changePct >= 0 ? "text-bull" : "text-bear"}>{signed(market.ticker.changePct, 2)}% 24h</div><div className="text-t3">lat {market.latency}ms</div></div>
        </div>
        <Chips options={EXCHANGES} value={cfg.exchange} k="exchange" />
        <div className="flex gap-2"><Chips options={SYMBOLS} value={cfg.symbol} k="symbol" /></div>
        <Chips options={TIMEFRAMES} value={cfg.tf} k="tf" render={(o) => o.toUpperCase()} />
      </header>
      <div ref={ref} className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full">
          <div className="flex-[0_0_100%] min-w-0 h-full relative"><FootprintChart market={market} overlays={overlays} settings={settings} tool="crosshair" compact /></div>
          <div className="flex-[0_0_100%] min-w-0 h-full"><DomPanel market={market} depth={cfg.depth} onDepth={(d) => onCfg({ depth: d })} /></div>
          <div className="flex-[0_0_100%] min-w-0 h-full"><TradeTape market={market} largeUsd={settings.largeTradeUsd} /></div>
          <div className="flex-[0_0_100%] min-w-0 h-full overflow-y-auto"><SignalsTab signal={signal} market={market} /></div>
          <div className="flex-[0_0_100%] min-w-0 h-full overflow-y-auto p-3 flex flex-col gap-3">{alerts.length ? alerts.map((a) => <AlertCard key={a.id} alert={a} compact />) : <Empty>No absorption or stacked imbalance detected in recent bars.</Empty>}</div>
        </div>
      </div>
      <nav className="shrink-0 h-14 border-t border-line bg-panel grid grid-cols-5" data-testid="mobile-nav">
        {PANELS.map(([id, label, Icon], i) => <button key={id} onClick={() => api?.scrollTo(i)} className={`flex flex-col items-center justify-center gap-1 text-[9px] font-mono tracking-widest uppercase ${idx === i ? "text-brand" : "text-t3"}`} data-testid={`mobile-nav-${id}`}><Icon size={16} />{label}</button>)}
      </nav>
    </div>
  );
};
