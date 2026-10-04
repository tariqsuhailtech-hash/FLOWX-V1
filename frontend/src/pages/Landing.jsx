import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Activity, BarChart3, Layers, Waves, BookOpen, Droplets, Scale, ShieldAlert, Radar, History, Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/terminal/ui";
import { TerminalPreview } from "@/components/landing/TerminalPreview";

const FEATURES = [
  { icon: Activity, title: "Live Footprint", text: "Bid × ask volume at every price level inside each candle, rebuilt tick-by-tick from the aggregated trade stream.", big: true },
  { icon: Waves, title: "Delta Analysis", text: "Per-bar and cumulative delta, max/min delta and divergence against price." },
  { icon: BarChart3, title: "Volume Profile", text: "Session profile with POC, value area, HVN and LVN rendered beside the chart." },
  { icon: Layers, title: "VWAP", text: "Session VWAP with ±σ bands, previous-day and session extremes." },
  { icon: BookOpen, title: "Order Book", text: "DOM with configurable depth up to 1000 levels, wall detection and liquidity imbalance." },
  { icon: Droplets, title: "Liquidity", text: "Resting size visualised as liquidity bars with best bid/ask and spread in bps." },
  { icon: Scale, title: "Imbalance Detection", text: "Diagonal bid/ask imbalances at a configurable ratio, with stacked-imbalance highlighting.", big: true },
  { icon: ShieldAlert, title: "Absorption Detection", text: "High volume, one-sided delta, muted price response — flagged as potential absorption." },
  { icon: Radar, title: "Trade Signals", text: "Long / short bias with Strong, Moderate, Weak or Neutral confidence. Never a guarantee." },
  { icon: History, title: "Replay & Backtesting", text: "Scrub through loaded footprint history and test imbalance, delta and absorption setups." },
];
const FAQ = [
  ["Where does the market data come from?", "FLOWX runs a real server-side pipeline that connects to official public exchange feeds — Binance and Bybit WebSockets and REST. Trades, order books, footprint, delta, CVD, VWAP, POC and volume profile are all computed from that real market data and streamed to your terminal. There is no simulated or random market data anywhere in the app."],
  ["Which exchanges and markets are live?", "Binance spot and Bybit spot + perpetual are live from our servers. Binance USDⓈ-M perpetuals are currently restricted from our server region and are shown as unavailable rather than faked. Gate.io is architecturally supported and marked \"Coming Later\" until its integration is enabled — it never shows placeholder data."],
  ["Is historical footprint data real?", "Yes. Historical candles load from real kline data (real volume and taker-buy volume, so delta is real), and recent bars are backfilled with real per-level footprint from the aggregated trade stream. Where tick-level history is not available for a bar, the footprint cells are simply left empty — never invented."],
  ["Are the signals trade recommendations?", "No. Signals are a deterministic, rules-based read of order-flow factors with explicit confidence states. No AI or prediction is used. They are an analytics aid, not financial advice, and never a guarantee."],
  ["Can I use FLOWX on mobile?", "Yes. The terminal switches to a dedicated swipeable mobile layout prioritising price, footprint, DOM, signals and alerts."],
];

export default function Landing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [contact, setContact] = useState({ name: "", email: "", message: "" });
  useEffect(() => { api.get("/plans").then((r) => setPlans(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView(); }, []);
  const sendContact = async (e) => { e.preventDefault(); try { await api.post("/contact", contact); toast.success("Message sent — we'll reply by email"); setContact({ name: "", email: "", message: "" }); } catch (err) { toast.error(errMsg(err)); } };

  return (
    <div className="min-h-screen bg-void text-t1" data-testid="landing-page">
      <header className="h-14 glass sticky top-0 z-30 flex items-center px-5 lg:px-10 gap-8" data-testid="landing-nav">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-[11px] font-mono tracking-widest uppercase text-t2">
          <a href="#features" className="hover:text-t1" data-testid="nav-features">Features</a><a href="#pricing" className="hover:text-t1" data-testid="nav-pricing">Pricing</a><a href="#faq" className="hover:text-t1" data-testid="nav-faq">FAQ</a><a href="#contact" className="hover:text-t1" data-testid="nav-contact">Contact</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? <Link to="/dashboard" className="btn-ghost h-8 px-3 text-[11px] font-mono" data-testid="nav-dashboard-link">Dashboard</Link> : (<><Link to="/login" className="btn-ghost h-8 px-3 text-[11px] font-mono" data-testid="nav-login-link">Login</Link><Link to="/register" className="btn-ghost h-8 px-3 text-[11px] font-mono hidden sm:inline-flex" data-testid="nav-register-link">Register</Link></>)}
          <Link to="/terminal" className="btn-brand h-8 px-3 text-[11px] font-mono" data-testid="nav-terminal-link">Open Terminal</Link>
        </div>
      </header>

      <section className="relative px-5 lg:px-10 pt-16 lg:pt-24 pb-16 grain overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #38E1FF, transparent 65%)" }} />
        <div className="relative grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center max-w-[1500px] mx-auto">
          <div className="rise">
            <span className="label text-brand flex items-center gap-2"><span className="h-1.5 w-1.5 bg-bull rounded-full live-dot" />Real-time order-flow analytics</span>
            <h1 className="display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.02] mt-5 tracking-tight" data-testid="hero-title">SEE THE MARKET<br /><span className="text-brand">BEHIND</span> THE CANDLE</h1>
            <p className="text-t2 text-base md:text-lg mt-6 max-w-lg leading-relaxed" data-testid="hero-subtitle">Real-time order-flow analytics for traders who want to see buying, selling, liquidity and market pressure — not just price.</p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/terminal" className="btn-brand h-11 px-6 text-sm" data-testid="hero-open-terminal-button">Open Trading Terminal <ArrowRight size={16} /></Link>
              <a href="#features" className="btn-ghost h-11 px-6 text-sm" data-testid="hero-explore-features-button">Explore Features</a>
            </div>
            <div className="grid grid-cols-3 gap-6 mt-12 max-w-md">{[["BINANCE", "live WS feed"], ["1000", "DOM levels"], ["8", "analytics tabs"]].map(([v, l]) => <div key={l}><div className="num text-xl">{v}</div><div className="label mt-1">{l}</div></div>)}</div>
          </div>
          <div className="rise" style={{ animationDelay: "120ms" }}><TerminalPreview /></div>
        </div>
      </section>

      <section id="features" className="px-5 lg:px-10 py-20 border-t border-line">
        <div className="max-w-[1500px] mx-auto">
          <span className="label text-info">Capabilities</span>
          <h2 className="display text-base md:text-lg font-semibold mt-2 text-t2 max-w-xl">Everything a discretionary order-flow trader reads — in one terminal, rendered at sub-frame speed.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-px bg-line border border-line mt-10" data-testid="features-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className={`bg-panel p-6 hover:bg-elev transition-colors duration-200 ${f.big ? "xl:col-span-2" : ""}`} data-testid={`feature-${f.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                <f.icon size={18} className="text-brand" />
                <h3 className="display text-sm font-semibold mt-4 tracking-wide">{f.title}</h3>
                <p className="text-sm text-t2 mt-2 leading-relaxed">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-5 lg:px-10 py-20 border-t border-line">
        <div className="max-w-[1500px] mx-auto">
          <span className="label text-viol">Pricing</span>
          <h2 className="display text-base md:text-lg font-semibold mt-2 text-t2">Start free. Upgrade when the flow pays for it.</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-10" data-testid="pricing-grid">
            {plans.map((p) => (
              <article key={p.id} className={`panel p-6 flex flex-col ${p.highlight ? "border-brand/60 relative" : ""}`} data-testid={`plan-${p.id}`}>
                {p.highlight && <span className="absolute -top-2.5 left-6 bg-brand text-void label px-2 py-0.5 !text-void">Most popular</span>}
                <span className="display text-sm font-semibold tracking-widest uppercase">{p.name}</span>
                <div className="mt-4 flex items-baseline gap-1"><span className="num text-3xl">${p.price}</span><span className="text-t3 text-xs">/ {p.period}</span></div>
                <p className="text-xs text-t2 mt-2">{p.tagline}</p>
                <ul className="mt-5 flex flex-col gap-2 flex-1">{p.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-t2"><Check size={14} className="text-bull mt-0.5 shrink-0" />{f}</li>)}</ul>
                <button onClick={() => toast(p.price ? "Payments are not enabled yet" : "Starter is free — create an account", { description: p.price ? "Contact us below to arrange a seat." : "Register to get started." })} className={`${p.highlight ? "btn-brand" : "btn-ghost"} h-10 text-sm mt-6`} data-testid={`plan-subscribe-${p.id}`}>{p.price ? "Subscribe" : "Get started"}</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="px-5 lg:px-10 py-20 border-t border-line">
        <div className="max-w-[1500px] mx-auto grid lg:grid-cols-[0.6fr_1.4fr] gap-10">
          <div><span className="label text-warn">FAQ</span><h2 className="display text-base md:text-lg font-semibold mt-2 text-t2">Straight answers about data, signals and limits.</h2></div>
          <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
            {FAQ.map(([q, a], i) => <AccordionItem key={q} value={`q${i}`} className="border-line"><AccordionTrigger className="text-sm text-left hover:no-underline hover:text-brand" data-testid={`faq-q-${i}`}>{q}</AccordionTrigger><AccordionContent className="text-sm text-t2 leading-relaxed">{a}</AccordionContent></AccordionItem>)}
          </Accordion>
        </div>
      </section>

      <section id="contact" className="px-5 lg:px-10 py-20 border-t border-line">
        <div className="max-w-[1500px] mx-auto grid lg:grid-cols-3 gap-8">
          <div className="panel p-6" data-testid="risk-disclosure"><span className="label text-bear">Risk Disclosure</span><p className="text-xs text-t2 mt-3 leading-relaxed">Trading cryptocurrencies, futures and leveraged products involves substantial risk of loss and is not suitable for every investor. Past order-flow behaviour, backtest results and signal confidence states do not guarantee future results. FLOWX is an analytics tool and does not provide investment advice or execute trades.</p></div>
          <div className="panel p-6" data-testid="data-disclaimer"><span className="label text-info">Data Disclaimer</span><p className="text-xs text-t2 mt-3 leading-relaxed">All market data is sourced live from official public exchange APIs (Binance and Bybit) via a real server-side pipeline and may be delayed, incomplete or interrupted by the exchange. FLOWX never substitutes fake, random or sample values: when a feed is unavailable the terminal shows CONNECTING, STALE, DISCONNECTED or UNAVAILABLE instead. Latency is measured end-to-end and varies by network.</p></div>
          <form onSubmit={sendContact} className="panel p-6 flex flex-col gap-3" data-testid="contact-form">
            <span className="label text-brand">Contact</span>
            <input className="field" placeholder="Name" required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} data-testid="contact-name" />
            <input className="field" type="email" placeholder="Email" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} data-testid="contact-email" />
            <textarea className="field h-20 py-2 resize-none" placeholder="Tell us about your desk" required value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} data-testid="contact-message" />
            <button className="btn-brand h-9 text-xs" data-testid="contact-submit">Send message</button>
          </form>
        </div>
      </section>

      <footer className="px-5 lg:px-10 py-8 border-t border-line flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-t3">
        <Logo /><span>© {new Date().getFullYear()} FLOWX Analytics. Not financial advice.</span>
        <div className="flex gap-5"><Link to="/login" className="hover:text-t1" data-testid="footer-login">Login</Link><Link to="/register" className="hover:text-t1" data-testid="footer-register">Register</Link><Link to="/terminal" className="hover:text-t1" data-testid="footer-terminal">Terminal</Link></div>
      </footer>
    </div>
  );
}
