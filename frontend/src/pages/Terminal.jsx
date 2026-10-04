import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useMarket, useMediaQuery } from "@/hooks/useMarket";
import { buildAlerts, computeSignal } from "@/lib/analytics";
import { PRICE_DEC } from "@/lib/marketEngine";
import { TopBar } from "@/components/terminal/TopBar";
import { LeftToolbar } from "@/components/terminal/LeftToolbar";
import { FootprintChart } from "@/components/terminal/FootprintChart";
import { DomPanel } from "@/components/terminal/DomPanel";
import { TradeTape } from "@/components/terminal/TradeTape";
import { BottomPanel } from "@/components/terminal/BottomPanel";
import { SettingsSheet } from "@/components/terminal/SettingsSheet";
import { ReplayBar } from "@/components/terminal/ReplayBar";
import { MobileTerminal } from "@/components/terminal/MobileTerminal";

const DEFAULT_SETTINGS = { imbalanceRatio: 3, stackedCount: 3, absorptionMultiplier: 1.8, largeTradeUsd: 50000, soundAlerts: false };
const DEFAULT_OVERLAYS = { vwap: true, bands: true, session: true, pdhl: true, poc: true, va: true, profile: true };
const SKEYS = Object.keys(DEFAULT_SETTINGS);
const loadLocal = () => { try { return JSON.parse(localStorage.getItem("flowx_settings")) || {}; } catch { return {}; } };

export default function Terminal() {
  const { user, updateSettings } = useAuth();
  const saved = useMemo(() => ({ ...loadLocal(), ...(user?.settings || {}) }), []);
  const [cfg, setCfg] = useState({ exchange: saved.exchange || "BINANCE", symbol: saved.symbol || "BTCUSDT", tf: saved.timeframe || "1m", marketType: saved.marketType || "spot", depth: saved.depth || 20 });
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...Object.fromEntries(SKEYS.filter((k) => saved[k] != null).map((k) => [k, saved[k]])) });
  const [overlays, setOverlays] = useState({ ...DEFAULT_OVERLAYS, ...(saved.overlays || {}) });
  const [tool, setTool] = useState("crosshair");
  const [tab, setTab] = useState("orderflow");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replay, setReplay] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("flowx_theme") || "void");
  const [fullscreen, setFullscreen] = useState(false);
  const [rules, setRules] = useState([]);
  const chartRef = useRef(null);
  const { market, engine } = useMarket(cfg);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("flowx_theme", theme); }, [theme]);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } engine.configure({ exchange: cfg.exchange, symbol: cfg.symbol, tf: cfg.tf, marketType: cfg.marketType }); setReplay(null); }, [cfg.exchange, cfg.symbol, cfg.tf, cfg.marketType]);
  useEffect(() => { engine.setDepth(cfg.depth); }, [cfg.depth]);
  useEffect(() => { localStorage.setItem("flowx_settings", JSON.stringify({ exchange: cfg.exchange, symbol: cfg.symbol, timeframe: cfg.tf, marketType: cfg.marketType, depth: cfg.depth, overlays, ...settings })); }, [cfg, overlays, settings]);
  useEffect(() => { if (user) api.get("/me/alerts").then((r) => setRules(r.data)).catch(() => {}); else setRules([]); }, [user]);
  useEffect(() => { const fn = () => setFullscreen(!!document.fullscreenElement); document.addEventListener("fullscreenchange", fn); return () => document.removeEventListener("fullscreenchange", fn); }, []);

  const view = useMemo(() => (replay ? { ...market, candles: market.candles.slice(0, replay.idx), trades: [] } : market), [market, replay]);
  const alerts = useMemo(() => buildAlerts(view.candles, view.tick, view.symbol, settings), [view.version, replay?.idx, settings]);
  const signal = useMemo(() => computeSignal(view.candles, view.tick, settings), [view.version, replay?.idx, settings]);

  useEffect(() => { if (!replay?.playing) return; const id = setInterval(() => setReplay((r) => (!r || r.idx >= market.candles.length ? (r ? { ...r, playing: false } : r) : { ...r, idx: r.idx + 1 })), 700 / replay.speed); return () => clearInterval(id); }, [replay?.playing, replay?.speed, market.candles.length]);

  const seen = useRef(new Set()), warm = useRef(Date.now());
  useEffect(() => { seen.current.clear(); warm.current = Date.now(); }, [cfg.symbol, cfg.exchange, cfg.tf]);
  useEffect(() => {
    if (replay) return;
    const warming = Date.now() - warm.current < 5000;
    alerts.forEach((a) => { if (seen.current.has(a.id)) return; seen.current.add(a.id); if (!warming) { toast(a.type, { description: `${a.symbol} · ${a.rows[0][0]} ${a.rows[0][1]} · ${a.note}`, className: a.tone === "bull" ? "!border-l-2 !border-l-bull" : "!border-l-2 !border-l-bear" }); if (settings.soundAlerts) beep(); } });
  }, [alerts]);

  const lastBias = useRef("");
  useEffect(() => {
    if (!user || replay || signal.bias === "NO TRADE") return;
    const key = `${cfg.symbol}:${signal.bias}:${signal.confidence}`; if (key === lastBias.current || !market.ticker.last) return; lastBias.current = key;
    api.post("/me/signals", { symbol: cfg.symbol, exchange: cfg.exchange, bias: signal.bias, confidence: signal.confidence, score: signal.score, price: market.ticker.last, factors: signal.factors }).catch(() => {});
  }, [signal.bias, signal.confidence]);

  useEffect(() => {
    const last = market.ticker.last; if (!last) return;
    rules.forEach((r) => {
      if (!r.enabled || r.symbol !== cfg.symbol) return;
      if ((r.condition === "above" && last >= r.value) || (r.condition === "below" && last <= r.value)) {
        toast.warning(`PRICE ALERT · ${r.symbol} ${r.condition} ${r.value.toFixed(PRICE_DEC[r.symbol] ?? 2)}`, { description: r.note || `Last ${last.toFixed(PRICE_DEC[r.symbol] ?? 2)}` });
        setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: false, triggered_at: new Date().toISOString() } : x)));
        api.patch(`/me/alerts/${r.id}`, { enabled: false, triggered_at: new Date().toISOString() }).catch(() => {});
      }
    });
  }, [market.ticker.last]);

  const onCfg = useCallback((patch) => setCfg((c) => ({ ...c, ...patch })), []);
  const onTool = (t) => {
    const c = chartRef.current;
    if (t === "zoomin") c?.zoomIn(); else if (t === "zoomout") c?.zoomOut(); else if (t === "reset") c?.reset(); else if (t === "screenshot") c?.screenshot(); else if (t === "clear") c?.clearDrawings();
    else if (t === "profile") setOverlays((o) => ({ ...o, profile: !o.profile })); else setTool(t);
  };
  const onAction = (a) => {
    if (a === "settings") setSettingsOpen(true);
    else if (a === "alerts") setTab("alerts");
    else if (a === "theme") setTheme((t) => (t === "void" ? "graphite" : "void"));
    else if (a === "fullscreen") { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
    else if (a === "replay") { if (replay) setReplay(null); else if (market.candles.length > 5) setReplay({ idx: Math.max(5, market.candles.length - 30), playing: false, speed: 1 }); else toast("Replay needs loaded history"); }
  };
  const save = async () => {
    if (!user) { toast("Sign in to sync settings to your account"); return; }
    setSaving(true);
    try { await updateSettings({ exchange: cfg.exchange, symbol: cfg.symbol, timeframe: cfg.tf, marketType: cfg.marketType, depth: cfg.depth, overlays, ...settings }); toast.success("Settings saved to account"); } catch { toast.error("Could not save settings"); } finally { setSaving(false); }
  };

  if (isMobile) return <MobileTerminal market={view} cfg={cfg} onCfg={onCfg} overlays={overlays} settings={settings} signal={signal} alerts={alerts} />;

  return (
    <div className="h-screen flex flex-col bg-void overflow-hidden" data-testid="trading-terminal">
      <TopBar market={market} cfg={cfg} onCfg={onCfg} onAction={onAction} alertCount={alerts.length} replayActive={!!replay} fullscreen={fullscreen} />
      <div className="flex flex-1 min-h-0">
        <LeftToolbar tool={tool} onTool={onTool} profileOn={overlays.profile} />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">
            <FootprintChart ref={chartRef} market={view} overlays={overlays} settings={settings} tool={tool} />
            {replay && <ReplayBar replay={replay} setReplay={setReplay} total={market.candles.length} candles={market.candles} />}
          </div>
          <BottomPanel tab={tab} setTab={setTab} market={view} settings={settings} signal={signal} alerts={alerts} rules={rules} setRules={setRules} />
        </main>
        <aside className="w-[300px] xl:w-[330px] shrink-0 border-l border-line bg-panel flex flex-col min-h-0">
          <div className="flex-[3] min-h-0 border-b border-line"><DomPanel market={market} depth={cfg.depth} onDepth={(d) => onCfg({ depth: d })} /></div>
          <div className="flex-[2] min-h-0"><TradeTape market={view} largeUsd={settings.largeTradeUsd} frozen={!!replay} /></div>
        </aside>
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} overlays={overlays} setOverlays={setOverlays} settings={settings} setSettings={setSettings} onSave={save} saving={saving} />
    </div>
  );
}

function beep() {
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; g.gain.value = 0.04; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.12); } catch {}
}
