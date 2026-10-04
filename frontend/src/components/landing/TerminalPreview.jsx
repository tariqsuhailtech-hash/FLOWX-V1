import { useMarket, useFlash } from "@/hooks/useMarket";
import { FootprintChart } from "@/components/terminal/FootprintChart";
import { DomPanel } from "@/components/terminal/DomPanel";
import { TradeTape } from "@/components/terminal/TradeTape";
import { fmtNum, signed } from "@/lib/format";

const OVERLAYS = { vwap: true, bands: false, session: false, pdhl: false, poc: true, va: true, profile: true };
const SETTINGS = { imbalanceRatio: 3, stackedCount: 3, absorptionMultiplier: 1.8, largeTradeUsd: 50000 };

export const TerminalPreview = () => {
  const { market } = useMarket({ exchange: "BYBIT", symbol: "BTCUSDT", tf: "1m", marketType: "perp", depth: 12 });
  const flash = useFlash(market.ticker.last);
  return (
    <div className="panel relative overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]" data-testid="terminal-preview">
      <div className="h-9 border-b border-line bg-panel flex items-center px-3 gap-3 text-[10px] font-mono">
        <span className="text-brand font-bold tracking-widest">FLOWX</span><span className="text-t3">BTCUSDT · PERP · 1M</span>
        <span className={`num ${market.ticker.dir >= 0 ? "text-bull" : "text-bear"} ${flash} px-1 rounded-sm`}>{fmtNum(market.ticker.last, 1)}</span>
        <span className={market.ticker.changePct >= 0 ? "text-bull" : "text-bear"}>{signed(market.ticker.changePct, 2)}%</span>
        <span className="ml-auto text-warn tracking-widest">PREVIEW · SIMULATED DATA</span>
      </div>
      <div className="grid grid-cols-[1fr_220px] h-[440px]">
        <div className="relative min-w-0"><FootprintChart market={market} overlays={OVERLAYS} settings={SETTINGS} tool="crosshair" compact /></div>
        <div className="border-l border-line flex flex-col min-h-0"><div className="flex-[3] min-h-0 border-b border-line"><DomPanel market={market} depth={12} compact /></div><div className="flex-[2] min-h-0"><TradeTape market={market} compact /></div></div>
      </div>
    </div>
  );
};
