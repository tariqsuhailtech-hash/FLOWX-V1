import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react";
import { fmtClock } from "@/lib/format";

export const ReplayBar = ({ replay, setReplay, total, candles }) => {
  const set = (idx) => setReplay((r) => ({ ...r, idx: Math.max(1, Math.min(total, idx)) }));
  const cur = candles[replay.idx - 1];
  return (
    <div className="absolute left-3 right-3 bottom-3 h-10 glass flex items-center gap-3 px-3 z-10" data-testid="replay-bar">
      <span className="label text-warn">REPLAY</span>
      <button className="ibtn" onClick={() => set(replay.idx - 1)} data-testid="replay-step-back"><SkipBack size={14} /></button>
      <button className="ibtn ibtn-active" onClick={() => setReplay((r) => ({ ...r, playing: !r.playing }))} data-testid="replay-play-pause">{replay.playing ? <Pause size={14} /> : <Play size={14} />}</button>
      <button className="ibtn" onClick={() => set(replay.idx + 1)} data-testid="replay-step-forward"><SkipForward size={14} /></button>
      <input type="range" min={1} max={total} value={replay.idx} onChange={(e) => set(+e.target.value)} className="flex-1 accent-[#F2C879]" data-testid="replay-slider" />
      <span className="num text-[11px] text-t2 w-28 text-right">{cur ? fmtClock(cur.t) : "—"} · {replay.idx}/{total}</span>
      <select value={replay.speed} onChange={(e) => setReplay((r) => ({ ...r, speed: +e.target.value }))} className="bg-void border border-line text-[10px] font-mono text-t2 h-6 px-1 rounded-sm" data-testid="replay-speed">{[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}</select>
      <button className="ibtn" onClick={() => setReplay(null)} data-testid="replay-exit"><X size={14} /></button>
    </div>
  );
};
