import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppNav, Card } from "@/components/AppNav";
import { api, errMsg } from "@/lib/api";
import { Metric } from "@/components/terminal/ui";
import { Switch } from "@/components/ui/switch";
import { ago, fmtDate, fmtNum } from "@/lib/format";

export default function Admin() {
  const [ov, setOv] = useState(null); const [users, setUsers] = useState([]); const [sys, setSys] = useState(null); const [saving, setSaving] = useState(false);
  const load = () => api.get("/admin/overview").then((r) => setOv(r.data)).catch(() => {});
  useEffect(() => { load(); api.get("/admin/users").then((r) => setUsers(r.data)); api.get("/admin/settings").then((r) => setSys(r.data)); const id = setInterval(load, 2000); return () => clearInterval(id); }, []);
  const patchUser = async (id, patch) => { try { const { data } = await api.patch(`/admin/users/${id}`, patch); setUsers((u) => u.map((x) => (x.id === id ? data : x))); toast.success("User updated"); } catch (e) { toast.error(errMsg(e)); } };
  const saveSys = async () => { setSaving(true); try { const { data } = await api.put("/admin/settings", sys); setSys(data); toast.success("System settings saved"); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); } };
  const Num = ({ k, label, step = 1 }) => <label className="flex flex-col gap-1"><span className="label">{label}</span><input type="number" step={step} className="field h-8 text-xs num" value={sys[k]} onChange={(e) => setSys({ ...sys, [k]: +e.target.value })} data-testid={`sys-${k}`} /></label>;

  return (
    <div className="min-h-screen bg-void" data-testid="admin-dashboard">
      <AppNav />
      <div className="max-w-[1500px] mx-auto px-5 py-6">
        <span className="label text-viol">Admin console</span><h1 className="display text-2xl font-semibold text-t1 mt-1 mb-6">System overview</h1>
        {ov && (
          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-px bg-line border border-line mb-4" data-testid="admin-overview">
            {[["Total users", ov.totalUsers], ["Active 24h", ov.activeUsers], ["Online", ov.onlineUsers, "bull"], ["Subscriptions", ov.subscriptions], ["MRR", `$${fmtNum(ov.mrr, 0)}`, "brand"], ["API connections", ov.apiConnections, "info"], ["WebSocket health", `${ov.wsHealth}%`, ov.wsHealth === 100 ? "bull" : "warn"], ["Exchanges up", `${ov.feeds.filter((f) => f.status === "connected").length}/${ov.feeds.length}`], ["System latency", `${ov.systemLatencyMs}ms`, "info"], ["Error rate", `${ov.errorRate}%`, ov.errorRate > 1 ? "bear" : "bull"]].map(([l, v, tone]) => <div key={l} className="bg-panel p-3"><Metric label={l} value={String(v)} tone={tone} size="lg" testid={`admin-metric-${l.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} /></div>)}
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-4 mb-4" data-testid="data-source-monitoring">
          {(ov?.feeds || []).map((f) => { const up = f.status === "connected"; return (
            <section key={f.exchange} className={`panel p-4 border-t-2 ${up ? "border-t-bull" : f.status === "connecting" ? "border-t-warn" : "border-t-bear"}`} data-testid={`feed-${f.exchange.toLowerCase().replace(/[^a-z]/g, "")}`}>
              <div className="flex items-center justify-between mb-3"><span className="display font-semibold tracking-widest text-sm text-t1">{f.exchange}</span><span className={`font-mono text-[11px] flex items-center gap-1.5 ${up ? "text-bull" : "text-bear"}`}><span className={`h-1.5 w-1.5 rounded-full ${up ? "bg-bull live-dot" : "bg-bear"}`} />{f.status.toUpperCase()}</span></div>
              <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                <Metric label="Messages/sec" value={String(f.rate)} tone="info" /><Metric label="Last tick" value={ago(f.last_tick)} /><Metric label="Last book" value={ago(f.last_book)} />
                <Metric label="Uptime" value={f.connected_at && up ? ago(f.connected_at).replace(" ago", "") : "—"} /><Metric label="Reconnects" value={String(f.reconnects)} tone={f.reconnects > 3 ? "warn" : ""} /><Metric label="Latency" value={f.latency_ms != null ? `${f.latency_ms}ms` : "—"} tone={f.latency_ms < 300 ? "bull" : "warn"} />
              </div>
              <div className="mt-3 font-mono text-[10px] text-t3 truncate">{f.last_price ? `BTCUSDT ${fmtNum(f.last_price, 1)} · ` : ""}{(f.messages || 0).toLocaleString()} msgs total{f.error ? ` · ${f.error}` : ""}</div>
            </section>); })}
        </div>
        <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4">
          <Card title={`User management · ${users.length}`} testid="user-management-card">
            <div className="overflow-x-auto"><table className="w-full font-mono text-[11px]"><thead><tr className="label h-7 text-left"><th className="font-normal">User</th><th className="font-normal">Role</th><th className="font-normal">Plan</th><th className="font-normal">Status</th><th className="font-normal">Last seen</th><th className="font-normal">Sessions</th></tr></thead>
              <tbody>{users.map((u) => <tr key={u.id} className="h-10 border-t border-line/60" data-testid={`admin-user-row-${u.email}`}>
                <td><div className="text-t1">{u.name}</div><div className="text-t3">{u.email}</div></td>
                <td><span className={u.role === "admin" ? "text-viol" : "text-t2"}>{u.role}</span></td>
                <td><select value={u.plan} onChange={(e) => patchUser(u.id, { plan: e.target.value })} className="bg-void border border-line h-7 px-1 text-[11px] text-brand" data-testid="admin-user-plan-select"><option value="free">free</option><option value="pro">pro</option><option value="institutional">institutional</option></select></td>
                <td><button onClick={() => patchUser(u.id, { status: u.status === "active" ? "suspended" : "active" })} className={`px-2 h-6 border text-[10px] tracking-widest ${u.status === "active" ? "border-bull/40 text-bull" : "border-bear/40 text-bear"}`} data-testid="admin-user-status-toggle">{u.status.toUpperCase()}</button></td>
                <td className="text-t2">{ago(u.last_seen)}</td><td className="text-t2">{u.login_count}</td>
              </tr>)}</tbody></table></div>
          </Card>
          {sys && (
            <Card title="System configuration" testid="system-settings-card" action={<button onClick={saveSys} disabled={saving} className="label text-brand hover:underline" data-testid="sys-save-button">{saving ? "Saving…" : "Save"}</button>}>
              <div className="flex flex-col gap-4">
                <div><span className="label">Exchange feeds</span><div className="flex gap-4 mt-2">{Object.keys(sys.exchanges).map((x) => <label key={x} className="flex items-center gap-2 font-mono text-[11px] text-t1"><Switch checked={!!sys.exchanges[x]} onCheckedChange={(v) => setSys({ ...sys, exchanges: { ...sys.exchanges, [x]: v } })} data-testid={`sys-exchange-${x.toLowerCase().replace(/[^a-z]/g, "")}`} />{x}</label>)}</div></div>
                <label className="flex flex-col gap-1"><span className="label">Symbols</span><input className="field h-8 text-xs font-mono" value={sys.symbols.join(", ")} onChange={(e) => setSys({ ...sys, symbols: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })} data-testid="sys-symbols" /></label>
                <div className="grid grid-cols-2 gap-3"><Num k="dataRetentionDays" label="Data retention · days" /><Num k="alertCooldownSec" label="Alert cooldown · sec" /><Num k="imbalanceThreshold" label="Imbalance threshold" step={0.5} /><Num k="absorptionThreshold" label="Absorption threshold" step={0.1} /><Num k="rateLimitPerMin" label="Rate limit / min" /></div>
                <div><span className="label">Feature flags</span><div className="grid grid-cols-2 gap-2 mt-2">{Object.keys(sys.featureFlags).map((f) => <label key={f} className="flex items-center gap-2 font-mono text-[11px] text-t1"><Switch checked={!!sys.featureFlags[f]} onCheckedChange={(v) => setSys({ ...sys, featureFlags: { ...sys.featureFlags, [f]: v } })} data-testid={`sys-flag-${f}`} />{f}</label>)}</div></div>
                {sys.updated_at && <div className="text-[10px] text-t3 font-mono">Updated {fmtDate(sys.updated_at)}</div>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
