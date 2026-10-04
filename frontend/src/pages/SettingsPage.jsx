import { useState } from "react";
import { toast } from "sonner";
import { AppNav, Card } from "@/components/AppNav";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { EXCHANGES, SYMBOLS, TIMEFRAMES, DEPTHS } from "@/lib/marketEngine";

export default function SettingsPage() {
  const { user, setUser, updateSettings } = useAuth();
  const [name, setName] = useState(user.name);
  const [s, setS] = useState({ exchange: "BINANCE", symbol: "BTCUSDT", marketType: "spot", timeframe: "1m", depth: 20, imbalanceRatio: 3, stackedCount: 3, absorptionMultiplier: 1.8, largeTradeUsd: 50000, ...user.settings });
  const [busy, setBusy] = useState(false);
  const Sel = ({ k, options, label }) => <label className="flex flex-col gap-1"><span className="label">{label}</span><select className="field h-9 text-xs" value={s[k]} onChange={(e) => setS({ ...s, [k]: isNaN(+e.target.value) ? e.target.value : +e.target.value })} data-testid={`settings-${k}`}>{options.map((o) => <option key={o} value={o}>{String(o).toUpperCase()}</option>)}</select></label>;
  const Num = ({ k, label, step = 1 }) => <label className="flex flex-col gap-1"><span className="label">{label}</span><input type="number" step={step} className="field h-9 text-xs num" value={s[k]} onChange={(e) => setS({ ...s, [k]: +e.target.value })} data-testid={`settings-${k}`} /></label>;
  const save = async () => {
    setBusy(true);
    try { if (name !== user.name) { const { data } = await api.put("/me/profile", { name }); setUser(data); } await updateSettings(s); localStorage.setItem("flowx_settings", JSON.stringify({ ...JSON.parse(localStorage.getItem("flowx_settings") || "{}"), ...s })); toast.success("Settings saved"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-void" data-testid="settings-page">
      <AppNav />
      <div className="max-w-4xl mx-auto px-5 py-6">
        <span className="label text-brand">Account</span><h1 className="display text-2xl font-semibold text-t1 mt-1 mb-6">Settings</h1>
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Profile" testid="profile-card">
            <label className="flex flex-col gap-1 mb-3"><span className="label">Display name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} data-testid="settings-name-input" /></label>
            <div className="label">Email</div><div className="font-mono text-xs text-t2 mt-1">{user.email}</div>
            <div className="label mt-3">Role / Plan</div><div className="font-mono text-xs text-t2 mt-1">{user.role} · <span className="text-brand">{user.plan}</span></div>
          </Card>
          <Card title="Default market" testid="default-market-card">
            <div className="grid grid-cols-2 gap-3">
              <Sel k="exchange" options={EXCHANGES} label="Exchange" /><Sel k="symbol" options={SYMBOLS} label="Symbol" />
              <Sel k="marketType" options={["spot", "perp"]} label="Market type" /><Sel k="timeframe" options={TIMEFRAMES} label="Timeframe" />
              <Sel k="depth" options={DEPTHS} label="DOM depth" />
            </div>
          </Card>
          <Card title="Detection thresholds" className="md:col-span-2" testid="thresholds-card">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Num k="imbalanceRatio" label="Imbalance ratio" step={0.5} /><Num k="stackedCount" label="Stacked levels" /><Num k="absorptionMultiplier" label="Absorption volume ×" step={0.1} /><Num k="largeTradeUsd" label="Large trade USD" step={1000} />
            </div>
          </Card>
        </div>
        <button onClick={save} disabled={busy} className="btn-brand h-10 px-6 text-sm mt-5" data-testid="settings-save-button">{busy ? "Saving…" : "Save settings"}</button>
      </div>
    </div>
  );
}
