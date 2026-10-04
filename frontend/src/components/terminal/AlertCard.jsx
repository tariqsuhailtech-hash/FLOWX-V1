import { fmtClock } from "@/lib/format";
import { AlertTriangle, Layers } from "lucide-react";

export const AlertCard = ({ alert, compact }) => {
  const bull = alert.tone === "bull"; const abs = alert.type.startsWith("ABSORPTION");
  return (
    <article className={`relative panel p-3 border-l-2 ${bull ? "border-l-bull" : "border-l-bear"} ${compact ? "" : "min-w-[220px]"}`} data-testid="alert-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {abs ? <AlertTriangle size={12} className={bull ? "text-bull" : "text-bear"} /> : <Layers size={12} className="text-mag" />}
          <span className={`display text-[11px] font-semibold tracking-widest ${bull ? "text-bull" : "text-bear"}`}>{alert.type}</span>
        </div>
        <span className="font-mono text-[10px] text-t3">{fmtClock(alert.t)}</span>
      </div>
      <div className="font-mono text-[11px] text-t1 mb-1.5">{alert.symbol}</div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px]">
        {alert.rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-t3">{k}</dt><dd className="text-right text-t1">{v}</dd></div>)}
      </dl>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-t2 italic">{alert.note}</span>
        <span className={`label ${alert.strength === "HIGH" ? "text-warn" : "text-t2"}`}>{alert.strength}</span>
      </div>
    </article>
  );
};
