import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

const OVERLAYS = [["vwap", "VWAP"], ["bands", "VWAP bands (±1σ)"], ["session", "Session high / low"], ["pdhl", "Previous day high / low"], ["poc", "Point of control"], ["va", "Value area (VAH / VAL)"], ["profile", "Volume profile panel"]];

export const SettingsSheet = ({ open, onOpenChange, overlays, setOverlays, settings, setSettings, onSave, saving }) => {
  const Num = ({ k, label, step = 1, min = 0, hint }) => (
    <label className="flex items-center justify-between gap-3 py-2 border-b border-line/60">
      <span className="text-xs text-t1">{label}{hint && <span className="block text-[10px] text-t3">{hint}</span>}</span>
      <input type="number" step={step} min={min} className="field h-8 w-24 text-xs num text-right" value={settings[k]} onChange={(e) => setSettings({ ...settings, [k]: +e.target.value })} data-testid={`setting-${k}`} />
    </label>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-panel border-line w-[360px] sm:max-w-[360px] overflow-y-auto" data-testid="settings-sheet">
        <SheetHeader><SheetTitle className="display tracking-widest text-sm text-t1">TERMINAL SETTINGS</SheetTitle></SheetHeader>
        <div className="mt-4">
          <span className="label">Chart overlays</span>
          <div className="mt-1">{OVERLAYS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-line/60"><span className="text-xs text-t1">{label}</span><Switch checked={!!overlays[k]} onCheckedChange={(v) => setOverlays({ ...overlays, [k]: v })} data-testid={`overlay-${k}`} /></div>
          ))}</div>
        </div>
        <div className="mt-5">
          <span className="label">Detection thresholds</span>
          <Num k="imbalanceRatio" label="Imbalance ratio" step={0.5} min={1.5} hint="Diagonal ask/bid ratio (e.g. 300% = 3)" />
          <Num k="stackedCount" label="Stacked imbalance levels" min={2} hint="Consecutive levels to flag stacked" />
          <Num k="absorptionMultiplier" label="Absorption volume ×" step={0.1} min={1} hint="Bar volume vs 40-bar average" />
          <Num k="largeTradeUsd" label="Large trade · USD" step={1000} min={1000} hint="Highlight threshold on tape" />
        </div>
        <div className="mt-5 flex items-center justify-between py-2"><span className="text-xs text-t1">Sound on alerts</span><Switch checked={!!settings.soundAlerts} onCheckedChange={(v) => setSettings({ ...settings, soundAlerts: v })} data-testid="setting-soundAlerts" /></div>
        <button onClick={onSave} disabled={saving} className="btn-brand w-full h-9 mt-4 text-xs" data-testid="settings-save-button">{saving ? "Saving…" : "Save to account"}</button>
        <p className="text-[10px] text-t3 mt-2">Settings apply instantly and persist in this browser. Saving syncs them to your FLOWX account.</p>
      </SheetContent>
    </Sheet>
  );
};
