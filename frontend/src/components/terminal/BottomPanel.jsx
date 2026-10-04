import { OrderFlowTab, DeltaTab, VolumeTab, TradesTab } from "./tabs/FlowTabs";
import { SignalsTab, AlertsTab } from "./tabs/SignalTabs";
import { BacktestTab, JournalTab } from "./tabs/WorkTabs";

export const TABS = [["orderflow", "ORDER FLOW"], ["delta", "DELTA"], ["volume", "VOLUME"], ["trades", "TRADES"], ["signals", "SIGNALS"], ["alerts", "ALERTS"], ["backtest", "BACKTEST"], ["journal", "JOURNAL"]];

export const BottomPanel = ({ tab, setTab, market, settings, signal, alerts, rules, setRules }) => (
  <section className="h-[264px] shrink-0 border-t border-line bg-panel flex flex-col" data-testid="bottom-panel">
    <nav className="h-8 flex items-stretch border-b border-line shrink-0 overflow-x-auto" data-testid="bottom-tabs">
      {TABS.map(([id, label]) => (
        <button key={id} onClick={() => setTab(id)} data-testid={`bottom-tab-${id}`}
          className={`px-4 text-[10px] font-mono tracking-[0.14em] border-b-2 transition-colors duration-150 whitespace-nowrap ${tab === id ? "border-brand text-brand" : "border-transparent text-t3 hover:text-t1"}`}>
          {label}{id === "alerts" && alerts.length > 0 && <span className="ml-1.5 text-warn">{alerts.length}</span>}{id === "signals" && signal.bias !== "NO TRADE" && <span className={`ml-1.5 ${signal.bias === "LONG BIAS" ? "text-bull" : "text-bear"}`}>●</span>}
        </button>
      ))}
    </nav>
    <div className="flex-1 min-h-0">
      {tab === "orderflow" && <OrderFlowTab market={market} settings={settings} />}
      {tab === "delta" && <DeltaTab market={market} />}
      {tab === "volume" && <VolumeTab market={market} />}
      {tab === "trades" && <TradesTab market={market} settings={settings} />}
      {tab === "signals" && <SignalsTab signal={signal} market={market} />}
      {tab === "alerts" && <AlertsTab alerts={alerts} market={market} rules={rules} setRules={setRules} />}
      {tab === "backtest" && <BacktestTab market={market} settings={settings} />}
      {tab === "journal" && <JournalTab market={market} />}
    </div>
  </section>
);
