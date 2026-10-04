export const Logo = ({ size = "md" }) => (
  <div className="flex items-center gap-2 select-none" data-testid="flowx-logo">
    <svg width={size === "lg" ? 30 : 20} height={size === "lg" ? 30 : 20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 17L9 7l4 6 3-4 5 8" stroke="#F2C879" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M3 20h18" stroke="#38E1FF" strokeWidth="1.4" />
    </svg>
    <span className={`display font-bold tracking-[0.18em] ${size === "lg" ? "text-2xl" : "text-sm"} text-t1`}>FLOW<span className="text-brand">X</span></span>
  </div>
);

export const Segmented = ({ options, value, onChange, testid, render }) => (
  <div className="seg" data-testid={`${testid}-selector`}>
    {options.map((o) => (
      <button key={o} type="button" className={o === value ? "on" : ""} onClick={() => onChange(o)} data-testid={`${testid}-${String(o).toLowerCase().replace(/[^a-z0-9]/g, "")}`}>{render ? render(o) : o}</button>
    ))}
  </div>
);

export const Metric = ({ label, value, tone = "", sub, testid, size = "md" }) => (
  <div className="flex flex-col gap-0.5 min-w-0" data-testid={testid}>
    <span className="label truncate">{label}</span>
    <span className={`num leading-none ${size === "lg" ? "text-lg" : "text-sm"} ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : tone === "info" ? "text-info" : tone === "warn" ? "text-warn" : tone === "viol" ? "text-viol" : tone === "brand" ? "text-brand" : "text-t1"}`}>{value}</span>
    {sub && <span className="text-[10px] text-t3 font-mono truncate">{sub}</span>}
  </div>
);

export const PanelHeader = ({ title, children, testid }) => (
  <div className="hdr" data-testid={testid}>
    <span className="label text-t2">{title}</span>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

const STATUS_MAP = {
  live: { label: "LIVE", dot: "bg-bull", text: "text-bull", pulse: true },
  connecting: { label: "CONNECTING", dot: "bg-t3", text: "text-t2", pulse: false },
  reconnecting: { label: "RECONNECTING", dot: "bg-warn", text: "text-warn", pulse: true },
  stale: { label: "STALE", dot: "bg-warn", text: "text-warn", pulse: false },
  disconnected: { label: "DISCONNECTED", dot: "bg-bear", text: "text-bear", pulse: false },
  error: { label: "ERROR", dot: "bg-bear", text: "text-bear", pulse: true },
};

export const StatusDot = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.connecting;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px]" data-testid="connection-status">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${s.pulse ? "live-dot" : ""}`} />
      <span className={s.text}>{s.label}</span>
    </span>
  );
};

export const ConfidencePill = ({ level }) => {
  const map = { Strong: "bg-bull/15 text-bull border-bull/40", Moderate: "bg-info/15 text-info border-info/40", Weak: "bg-warn/15 text-warn border-warn/40", Neutral: "bg-elev text-t2 border-line2" };
  return <span className={`px-2 py-0.5 border text-[10px] font-mono tracking-widest uppercase ${map[level] || map.Neutral}`} data-testid="signal-confidence">{level}</span>;
};

export const Empty = ({ children }) => <div className="h-full flex items-center justify-center text-t3 font-mono text-xs px-6 text-center">{children}</div>;
