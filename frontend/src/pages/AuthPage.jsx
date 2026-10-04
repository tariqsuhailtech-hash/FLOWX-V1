import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { Logo } from "@/components/terminal/ui";

const TICKS = ["REAL-TIME FOOTPRINT", "BID × ASK AT EVERY LEVEL", "LIVE DELTA & CVD", "DOM UP TO 1000 LEVELS", "STACKED IMBALANCE DETECTION", "POTENTIAL ABSORPTION", "VWAP · POC · VALUE AREA", "BINANCE + BYBIT LIVE FEEDS"];

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth(); const nav = useNavigate(); const loc = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try { const u = isLogin ? await login(form.email, form.password) : await register(form.email, form.password, form.name); toast.success(isLogin ? `Welcome back, ${u.name}` : "Account created"); nav(loc.state?.from || (u.role === "admin" ? "/admin" : "/dashboard")); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-void" data-testid={`${mode}-page`}>
      <aside className="hidden lg:flex flex-col justify-between p-12 border-r border-line relative overflow-hidden grain">
        <Link to="/"><Logo size="lg" /></Link>
        <div className="relative z-10 max-w-md">
          <span className="label text-brand">Professional order-flow analytics</span>
          <h1 className="display text-4xl font-bold mt-4 leading-tight text-t1">See the market<br />behind the candle.</h1>
          <p className="text-t2 mt-5 leading-relaxed text-sm">Footprint, delta, DOM liquidity, absorption and imbalance detection — streamed live and rendered at terminal speed.</p>
          <div className="mt-10 grid grid-cols-3 gap-6">{[["REAL", "live feeds"], ["2", "exchanges live"], ["1000", "DOM depth"]].map(([v, l]) => <div key={l}><div className="num text-xl text-t1">{v}</div><div className="label mt-1">{l}</div></div>)}</div>
        </div>
        <div className="relative z-10 overflow-hidden whitespace-nowrap border-y border-line py-2"><div className="marquee inline-block font-mono text-[11px] text-t3">{TICKS.concat(TICKS).map((t, i) => <span key={i} className="mx-6">{t}</span>)}</div></div>
        <div className="absolute -right-32 top-1/3 h-[480px] w-[480px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #F2C879 0%, transparent 65%)" }} />
      </aside>
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm panel p-8 rise" data-testid={`${mode}-form`}>
          <div className="lg:hidden mb-6"><Logo /></div>
          <h2 className="display text-xl font-semibold text-t1">{isLogin ? "Sign in to FLOWX" : "Create your account"}</h2>
          <p className="text-xs text-t3 mt-1 mb-6">{isLogin ? "Access your terminal, alerts and journal." : "Start on the Starter plan. No card required."}</p>
          {!isLogin && <label className="block mb-3"><span className="label">Name</span><input className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Trader" data-testid="register-name-input" /></label>}
          <label className="block mb-3"><span className="label">Email</span><input className="field mt-1" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@desk.io" data-testid={`${mode}-email-input`} /></label>
          <label className="block mb-4"><span className="label">Password</span><input className="field mt-1" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" data-testid={`${mode}-password-input`} /></label>
          {error && <div className="mb-4 px-3 py-2 border border-bear/40 bg-bear/10 text-bear text-xs font-mono" data-testid="auth-error">{error}</div>}
          <button disabled={busy} className="btn-brand w-full h-10 text-sm" data-testid={`${mode}-submit-button`}>{busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}</button>
          <div className="mt-5 text-xs text-t3 text-center">
            {isLogin ? <>No account? <Link to="/register" className="text-brand hover:underline" data-testid="goto-register-link">Register</Link></> : <>Have an account? <Link to="/login" className="text-brand hover:underline" data-testid="goto-login-link">Sign in</Link></>}
          </div>
          {isLogin && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-[11px] text-t3 leading-relaxed">Use your FLOWX account to sync alerts, signals and your trade journal. The public terminal is available without signing in.</p>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
