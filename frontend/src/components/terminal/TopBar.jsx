import { Link, useNavigate } from "react-router-dom";
import { Settings, PlayCircle, Bell, Maximize2, Minimize2, SunMoon, User, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EXCHANGES, SYMBOLS, TIMEFRAMES, PRICE_DEC } from "@/lib/marketEngine";
import { fmtNum, fmtCompact, signed } from "@/lib/format";
import { useFlash } from "@/hooks/useMarket";
import { useAuth } from "@/context/AuthContext";
import { Logo, Segmented, StatusDot } from "./ui";

export const TopBar = ({ market, cfg, onCfg, onAction, alertCount, replayActive, fullscreen }) => {
  const { ticker, status, latency, msgRate, book } = market; const dec = PRICE_DEC[cfg.symbol];
  const flash = useFlash(ticker.last);
  const { user, logout } = useAuth(); const nav = useNavigate();
  const spread = book.asks[0] && book.bids[0] ? book.asks[0][0] - book.bids[0][0] : null;
  const up = ticker.changePct >= 0;
  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-3 border-b border-line bg-panel text-xs" data-testid="terminal-topbar">
      <Link to="/" className="shrink-0"><Logo /></Link>
      <div className="h-6 w-px bg-line" />
      <Segmented options={EXCHANGES} value={cfg.exchange} onChange={(v) => onCfg({ exchange: v })} testid="exchange" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-7 px-2.5 border border-line rounded-sm font-mono text-[12px] font-semibold text-t1 hover:border-brand/60 bg-void" data-testid="symbol-selector">{cfg.symbol} ▾</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-panel border-line min-w-[160px]">
          {SYMBOLS.map((s) => <DropdownMenuItem key={s} onClick={() => onCfg({ symbol: s })} className="font-mono text-xs" data-testid={`symbol-option-${s.toLowerCase()}`}>{s}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <Segmented options={["spot", "perp"]} value={cfg.marketType} onChange={(v) => onCfg({ marketType: v })} testid="market-type" render={(o) => (o === "spot" ? "Spot" : "Perp")} />
      <Segmented options={TIMEFRAMES} value={cfg.tf} onChange={(v) => onCfg({ tf: v })} testid="timeframe" render={(o) => o.toUpperCase()} />
      <div className="h-6 w-px bg-line" />
      <StatusDot status={status} />
      <div className="hidden lg:flex items-center gap-4 ml-1">
        <Stat label="LAST" value={<span className={`px-1 -mx-1 rounded-sm ${flash}`}>{ticker.last ? fmtNum(ticker.last, dec) : "—"}</span>} tone={ticker.dir >= 0 ? "text-bull" : "text-bear"} testid="last-price" />
        <Stat label="24H" value={signed(ticker.changePct, 2) + "%"} tone={up ? "text-bull" : "text-bear"} testid="change-24h" />
        <Stat label="VOL" value={fmtCompact(ticker.quoteVolume || ticker.volume * ticker.last)} tone="text-t1" testid="volume-24h" />
        <Stat label="SPREAD" value={spread != null ? spread.toFixed(dec) : "—"} tone="text-info" testid="spread" />
        <Stat label="LAT" value={`${latency}ms`} tone={latency < 150 ? "text-bull" : latency < 500 ? "text-warn" : "text-bear"} testid="latency" />
        <Stat label="MSG/S" value={String(msgRate)} tone="text-t2" testid="msg-rate" />
      </div>
      <div className="ml-auto flex items-center gap-0.5">
        <span className="hidden xl:inline label mr-2 text-[9px]">{market.source}</span>
        <button className="ibtn" title="Settings" onClick={() => onAction("settings")} data-testid="topbar-settings-button"><Settings size={15} /></button>
        <button className={`ibtn ${replayActive ? "ibtn-active" : ""}`} title="Replay" onClick={() => onAction("replay")} data-testid="topbar-replay-button"><PlayCircle size={15} /></button>
        <button className="ibtn relative" title="Alerts" onClick={() => onAction("alerts")} data-testid="topbar-alerts-button"><Bell size={15} />{alertCount > 0 && <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-sm bg-brand text-void text-[9px] font-mono font-bold flex items-center justify-center" data-testid="alert-count-badge">{alertCount}</span>}</button>
        <button className="ibtn" title="Fullscreen" onClick={() => onAction("fullscreen")} data-testid="topbar-fullscreen-button">{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
        <button className="ibtn" title="Theme" onClick={() => onAction("theme")} data-testid="topbar-theme-button"><SunMoon size={15} /></button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className="ibtn" title="Account" data-testid="topbar-account-button"><User size={15} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-panel border-line min-w-[200px]">
            {user ? (<>
              <div className="px-2 py-1.5"><div className="text-xs text-t1 font-medium">{user.name}</div><div className="text-[10px] text-t3 font-mono">{user.email} · {user.plan.toUpperCase()}</div></div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav("/dashboard")} className="text-xs gap-2" data-testid="account-dashboard-link"><LayoutDashboard size={13} />Dashboard</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav("/settings")} className="text-xs gap-2" data-testid="account-settings-link"><Settings size={13} />Account settings</DropdownMenuItem>
              {user.role === "admin" && <DropdownMenuItem onClick={() => nav("/admin")} className="text-xs gap-2" data-testid="account-admin-link"><Shield size={13} />Admin console</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-xs gap-2 text-bear" data-testid="account-logout-button"><LogOut size={13} />Sign out</DropdownMenuItem>
            </>) : (<>
              <DropdownMenuItem onClick={() => nav("/login")} className="text-xs" data-testid="account-login-link">Sign in</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav("/register")} className="text-xs" data-testid="account-register-link">Create account</DropdownMenuItem>
            </>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

const Stat = ({ label, value, tone, testid }) => (
  <div className="flex items-baseline gap-1.5" data-testid={testid}>
    <span className="label">{label}</span>
    <span className={`num text-[12px] font-medium ${tone}`}>{value}</span>
  </div>
);
