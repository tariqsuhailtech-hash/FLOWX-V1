import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { clusterCells, markImbalances, sessionLevels, volumeProfile, vwapSeries } from "@/lib/analytics";
import { PRICE_DEC, levelNum } from "@/lib/marketEngine";
import { fmtVol, signedVol } from "@/lib/format";

const C = { bg: "#07090E", grid: "#10141D", t1: "#E8ECF2", t2: "#8B97AB", t3: "#5B677A", bull: "#22D38B", bear: "#FF4D6D", info: "#38E1FF", warn: "#FFB020", viol: "#B388FF", gold: "#F2C879", mag: "#FF2EC4", orange: "#FF8A3D" };
const PROFILE_W = 118, AXIS_W = 74, TIME_H = 20, STATS_H = 34;
const MONO = '"JetBrains Mono", monospace';

export const FootprintChart = forwardRef(function FootprintChart({ market, overlays, settings, tool, compact }, ref) {
  const canvasRef = useRef(null), wrapRef = useRef(null), raf = useRef(0);
  const v = useRef({ spacing: compact ? 74 : 104, offset: 0, drag: null, mouse: null, drawings: [], pending: null, layout: null });
  const m = useRef(market); m.current = market;
  const p = useRef({ overlays, settings, tool, compact }); p.current = { overlays, settings, tool, compact };

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; draw(canvasRef.current, wrapRef.current, m.current, v.current, p.current); });
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => { v.current.spacing = Math.min(240, v.current.spacing * 1.2); schedule(); },
    zoomOut: () => { v.current.spacing = Math.max(34, v.current.spacing / 1.2); schedule(); },
    reset: () => { v.current.spacing = compact ? 74 : 104; v.current.offset = 0; v.current.drawings = []; v.current.pending = null; schedule(); },
    screenshot: () => { const a = document.createElement("a"); a.download = `flowx-${m.current.symbol}-${Date.now()}.png`; a.href = canvasRef.current.toDataURL("image/png"); a.click(); },
    clearDrawings: () => { v.current.drawings = []; schedule(); },
  }));

  useEffect(() => { schedule(); }, [market.version, overlays, settings, tool, schedule]);
  useEffect(() => { const ro = new ResizeObserver(schedule); ro.observe(wrapRef.current); return () => ro.disconnect(); }, [schedule]);
  useEffect(() => {
    const el = wrapRef.current;
    const onWheel = (e) => { e.preventDefault(); v.current.spacing = Math.max(34, Math.min(240, v.current.spacing * (e.deltaY < 0 ? 1.1 : 0.9))); schedule(); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [schedule]);

  const pos = (e) => { const r = wrapRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onDown = (e) => { v.current.drag = { x: e.clientX, offset: v.current.offset, moved: false }; };
  const onMove = (e) => {
    const s = v.current; s.mouse = pos(e);
    if (s.drag) { const dx = e.clientX - s.drag.x; if (Math.abs(dx) > 4) s.drag.moved = true; const d = Math.round(dx / s.spacing); s.offset = Math.max(0, Math.min((m.current.candles.length || 1) - 3, s.drag.offset + d)); }
    schedule();
  };
  const onUp = (e) => {
    const s = v.current; const moved = s.drag?.moved; s.drag = null;
    if (moved || !s.layout || !s.mouse) return;
    const L = s.layout; const { x, y } = s.mouse; const { tool: t } = p.current;
    if (x > L.chartW || y > L.chartH) return;
    const price = L.hi - (y / L.chartH) * (L.hi - L.lo);
    const i = Math.min(L.end - 1, L.start + Math.floor(x / L.spacing)); const ct = m.current.candles[i]?.t; if (!ct) return;
    if (t === "hline") s.drawings.push({ type: "hline", price });
    else if (["trend", "rect", "measure"].includes(t)) { if (!s.pending) s.pending = { type: t, p1: { t: ct, price } }; else { s.drawings.push({ ...s.pending, p2: { t: ct, price } }); s.pending = null; } }
    schedule();
  };
  const onLeave = () => { v.current.mouse = null; v.current.drag = null; schedule(); };

  return (
    <div ref={wrapRef} data-testid="footprint-chart" data-no-swipe className="absolute inset-0 select-none" style={{ cursor: tool === "crosshair" ? "crosshair" : tool === "zoom" ? "zoom-in" : "cell" }}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave} onDoubleClick={() => { v.current.offset = 0; schedule(); }}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
});

function draw(canvas, wrap, mk, v, { overlays: ov, settings, tool, compact }) {
  if (!canvas || !wrap) return;
  const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight; if (!W || !H) return;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px"; }
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const candles = mk.candles, tick = mk.tick, dec = PRICE_DEC[mk.symbol] ?? 2;
  const profW = ov.profile ? (compact ? 70 : PROFILE_W) : 0, axisW = compact ? 56 : AXIS_W;
  const chartW = W - axisW - profW, chartH = H - TIME_H - STATS_H;
  ctx.font = `11px ${MONO}`; ctx.textBaseline = "middle";
  if (!candles.length) { ctx.fillStyle = C.t3; ctx.fillText(mk.status === "connecting" ? "Connecting to market feed…" : "Waiting for trades…", 16, 24); return; }

  const visible = Math.max(3, Math.floor(chartW / v.spacing));
  const end = Math.max(1, candles.length - v.offset), start = Math.max(0, end - visible), vis = candles.slice(start, end);
  let pMin = Infinity, pMax = -Infinity; vis.forEach((c) => { pMin = Math.min(pMin, c.l); pMax = Math.max(pMax, c.h); });
  const vw = vwapSeries(candles), prof = volumeProfile(candles, tick), sess = sessionLevels(candles);
  pMin -= tick * 2; pMax += tick * 2;
  const maxRows = Math.max(6, Math.floor(chartH / 15));
  const k = Math.max(1, Math.ceil((pMax - pMin) / tick / maxRows)); const cluster = tick * k;
  const lo = levelNum(pMin, cluster), hi = levelNum(pMax, cluster) + cluster; const rows = Math.max(1, Math.round((hi - lo) / cluster)); const rowH = chartH / rows;
  const yOf = (price) => chartH - ((price - lo) / (hi - lo)) * chartH;
  const xOfI = (i) => (i - start) * v.spacing;
  const tIdx = new Map(candles.map((c, i) => [c.t, i]));
  v.layout = { start, end, spacing: v.spacing, lo, hi, chartW, chartH, cluster };

  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) { const y = Math.round(r * rowH) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke(); }

  let maxCell = 0;
  const clustered = vis.map((c) => { const cells = clusterCells(c.cells, cluster); Object.values(cells).forEach((x) => { maxCell = Math.max(maxCell, x.bid, x.ask); }); return cells; });
  maxCell = maxCell || 1;
  const fontSize = Math.max(8, Math.min(11, Math.floor(rowH - 3))); const showText = rowH >= 9 && v.spacing >= 58;
  const candleFont = `${fontSize}px ${MONO}`;

  vis.forEach((c, j) => {
    const x = xOfI(start + j), w = v.spacing - 2, cells = clustered[j]; const mid = x + 1 + w / 2;
    const imb = markImbalances(cells, cluster, settings.imbalanceRatio, settings.stackedCount);
    const up = c.c >= c.o; const yTop = yOf(levelNum(c.h, cluster) + cluster), yBot = yOf(levelNum(c.l, cluster));
    ctx.fillStyle = up ? "rgba(34,211,139,0.04)" : "rgba(255,77,109,0.04)"; ctx.fillRect(x + 1, yTop, w, yBot - yTop);
    const yO = yOf(c.o), yC = yOf(c.c);
    ctx.fillStyle = up ? "rgba(34,211,139,0.12)" : "rgba(255,77,109,0.12)"; ctx.fillRect(x + 1, Math.min(yO, yC), w, Math.max(1, Math.abs(yO - yC)));
    ctx.strokeStyle = up ? "rgba(34,211,139,0.55)" : "rgba(255,77,109,0.55)"; ctx.strokeRect(x + 1.5, yTop + 0.5, w - 1, yBot - yTop - 1);
    ctx.font = candleFont;
    Object.entries(cells).forEach(([lv, cell]) => {
      const pr = +lv, y = yOf(pr + cluster), cy = y + rowH / 2; const bi = cell.bid / maxCell, ai = cell.ask / maxCell;
      ctx.fillStyle = `rgba(255,77,109,${(0.05 + bi * 0.4).toFixed(3)})`; ctx.fillRect(x + 1, y, w / 2, rowH);
      ctx.fillStyle = `rgba(34,211,139,${(0.05 + ai * 0.4).toFixed(3)})`; ctx.fillRect(mid, y, w / 2, rowH);
      const f = imb[lv] || {};
      if (f.bidImb) { ctx.strokeStyle = f.stackedBid ? C.mag : C.bear; ctx.lineWidth = f.stackedBid ? 1.5 : 1; ctx.strokeRect(x + 2.5, y + 1.5, w / 2 - 3, rowH - 3); ctx.lineWidth = 1; }
      if (f.askImb) { ctx.strokeStyle = f.stackedAsk ? C.mag : C.bull; ctx.lineWidth = f.stackedAsk ? 1.5 : 1; ctx.strokeRect(mid + 1.5, y + 1.5, w / 2 - 3, rowH - 3); ctx.lineWidth = 1; }
      if (showText) {
        ctx.textAlign = "right"; ctx.fillStyle = f.bidImb ? "#fff" : bi > 0.45 ? C.t1 : C.t2; ctx.fillText(fmtVol(cell.bid), mid - 4, cy);
        ctx.textAlign = "left"; ctx.fillStyle = f.askImb ? "#fff" : ai > 0.45 ? C.t1 : C.t2; ctx.fillText(fmtVol(cell.ask), mid + 4, cy);
      }
    });
    ctx.strokeStyle = "rgba(27,34,48,0.9)"; ctx.beginPath(); ctx.moveTo(Math.round(mid) + 0.5, yTop); ctx.lineTo(Math.round(mid) + 0.5, yBot); ctx.stroke();
    if (c.approx) { ctx.fillStyle = "rgba(139,151,171,0.35)"; ctx.fillRect(x + 1, yTop - 3, w, 1); }
    ctx.font = `10px ${MONO}`; ctx.textAlign = "center";
    ctx.fillStyle = c.delta >= 0 ? C.bull : C.bear; ctx.fillText(signedVol(c.delta), mid, chartH + 9);
    ctx.fillStyle = C.t2; ctx.fillText(fmtVol(c.vol), mid, chartH + 24);
    ctx.fillStyle = C.t3; ctx.fillText(new Date(c.t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" }), mid, chartH + STATS_H + TIME_H / 2);
  });
  ctx.fillStyle = "rgba(12,15,22,0.9)"; ctx.fillRect(0, chartH, W, 1);

  // overlays
  const axisX = chartW + profW; const lastX = xOfI(end - 1) + v.spacing / 2;
  const hline = (price, color, label, dash = [4, 4], labelSide = "right") => {
    if (!price || price < lo || price > hi) return; const y = Math.round(yOf(price)) + 0.5;
    ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(axisX, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `9px ${MONO}`; ctx.textAlign = labelSide === "right" ? "left" : "right"; ctx.fillStyle = color; ctx.fillText(label, labelSide === "right" ? 4 : chartW - 4, y - 6);
  };
  if (ov.vwap) {
    const line = (key, color, width, dash) => { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, chartH); ctx.clip(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); vis.forEach((c, j) => { const y = yOf(vw[start + j][key]); const x = xOfI(start + j) + v.spacing / 2; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore(); ctx.lineWidth = 1; };
    line("vwap", C.info, 1.5, []);
    if (ov.bands) { line("upper", "rgba(56,225,255,0.4)", 1, [3, 4]); line("lower", "rgba(56,225,255,0.4)", 1, [3, 4]); }
    const vy = vw[end - 1].vwap; if (vy > lo && vy < hi) { ctx.font = `9px ${MONO}`; ctx.textAlign = "left"; ctx.fillStyle = C.info; ctx.fillText("VWAP", Math.min(lastX + 6, chartW - 34), yOf(vy) - 6); }
  }
  if (ov.poc) hline(prof.poc, C.gold, "POC", [6, 3]);
  if (ov.va) { hline(prof.vah, C.viol, "VAH", [2, 3]); hline(prof.val, C.viol, "VAL", [2, 3]); }
  if (ov.session) { hline(sess.high, C.warn, "SESSION HIGH", [1, 3], "left"); hline(sess.low, C.warn, "SESSION LOW", [1, 3], "left"); }
  if (ov.pdhl) { hline(mk.pdh, C.orange, "PDH", [8, 4], "left"); hline(mk.pdl, C.orange, "PDL", [8, 4], "left"); }

  // profile
  if (profW) {
    ctx.fillStyle = "rgba(12,15,22,0.6)"; ctx.fillRect(chartW, 0, profW, chartH);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(chartW + 0.5, 0); ctx.lineTo(chartW + 0.5, chartH); ctx.stroke();
    const agg = {}; let pmax = 0;
    prof.levels.forEach((l) => { if (l.price < lo - cluster || l.price > hi) return; const key = levelNum(l.price, cluster); const o = agg[key] || (agg[key] = { bid: 0, ask: 0 }); o.bid += l.bid; o.ask += l.ask; pmax = Math.max(pmax, o.bid + o.ask); });
    const pocK = levelNum(prof.poc, cluster), vahK = levelNum(prof.vah, cluster), valK = levelNum(prof.val, cluster);
    Object.entries(agg).forEach(([key, o]) => {
      const pr = +key, y = yOf(pr + cluster), tot = o.bid + o.ask, wTot = (tot / (pmax || 1)) * (profW - 10); const inVA = pr >= valK && pr <= vahK;
      const wb = wTot * (o.bid / tot), wa = wTot - wb;
      ctx.fillStyle = inVA ? "rgba(255,77,109,0.55)" : "rgba(255,77,109,0.22)"; ctx.fillRect(chartW + 4, y + 1, wb, rowH - 2);
      ctx.fillStyle = inVA ? "rgba(34,211,139,0.55)" : "rgba(34,211,139,0.22)"; ctx.fillRect(chartW + 4 + wb, y + 1, wa, rowH - 2);
      if (pr === pocK) { ctx.fillStyle = C.gold; ctx.fillRect(chartW + 4, y + 1, wTot, rowH - 2); }
    });
    ctx.font = `9px ${MONO}`; ctx.textAlign = "left"; ctx.fillStyle = C.t3; ctx.fillText("VOLUME PROFILE", chartW + 6, 10);
  }

  // axis
  ctx.fillStyle = "#0A0D14"; ctx.fillRect(axisX, 0, axisW, H);
  ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(axisX + 0.5, 0); ctx.lineTo(axisX + 0.5, chartH); ctx.stroke();
  ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; const step = Math.max(1, Math.ceil(14 / rowH));
  for (let r = 0; r < rows; r += step) { const pr = lo + r * cluster; const y = yOf(pr + cluster) + rowH / 2; ctx.fillStyle = C.t3; ctx.fillText(pr.toFixed(dec), axisX + 6, y); }
  const last = mk.ticker.last;
  if (last >= lo && last <= hi) {
    const y = yOf(last); const upc = mk.ticker.dir >= 0;
    ctx.fillStyle = upc ? C.bull : C.bear; ctx.fillRect(axisX + 1, y - 8, axisW - 2, 16);
    ctx.fillStyle = "#06080D"; ctx.font = `bold 10px ${MONO}`; ctx.fillText(last.toFixed(dec), axisX + 6, y);
    ctx.setLineDash([2, 3]); ctx.strokeStyle = upc ? "rgba(34,211,139,0.5)" : "rgba(255,77,109,0.5)"; ctx.beginPath(); ctx.moveTo(lastX, Math.round(y) + 0.5); ctx.lineTo(axisX, Math.round(y) + 0.5); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.font = `9px ${MONO}`; ctx.fillStyle = C.t3; ctx.fillText("Δ", axisX + 6, chartH + 9); ctx.fillText("VOL", axisX + 6, chartH + 24);

  // drawings
  const xOfT = (t) => { const i = tIdx.get(t); return i == null ? null : xOfI(i) + v.spacing / 2; };
  const drawShape = (d, ghost) => {
    ctx.strokeStyle = ghost ? "rgba(242,200,121,0.5)" : C.gold; ctx.setLineDash(ghost ? [4, 4] : []);
    if (d.type === "hline") { const y = Math.round(yOf(d.price)) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke(); ctx.fillStyle = C.gold; ctx.fillRect(axisX + 1, y - 7, axisW - 2, 14); ctx.fillStyle = "#06080D"; ctx.font = `bold 10px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(d.price.toFixed(dec), axisX + 6, y); ctx.setLineDash([]); return; }
    const x1 = xOfT(d.p1.t), x2 = d.p2 ? xOfT(d.p2.t) : v.mouse?.x; const y1 = yOf(d.p1.price), y2 = d.p2 ? yOf(d.p2.price) : v.mouse?.y;
    if (x1 == null || x2 == null || y2 == null) { ctx.setLineDash([]); return; }
    if (d.type === "trend") { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    else { ctx.fillStyle = d.type === "measure" ? "rgba(179,136,255,0.12)" : "rgba(242,200,121,0.08)"; ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); ctx.strokeStyle = d.type === "measure" ? C.viol : C.gold; ctx.strokeRect(Math.min(x1, x2) + 0.5, Math.min(y1, y2) + 0.5, Math.abs(x2 - x1), Math.abs(y2 - y1)); }
    if (d.type === "measure") { const p2 = d.p2 ? d.p2.price : hi - (y2 / chartH) * (hi - lo); const dp = p2 - d.p1.price; const bars = Math.round(Math.abs(x2 - x1) / v.spacing); ctx.fillStyle = C.viol; ctx.font = `10px ${MONO}`; ctx.textAlign = "center"; ctx.fillText(`${dp >= 0 ? "+" : ""}${dp.toFixed(dec)}  (${((dp / d.p1.price) * 100).toFixed(2)}%)  ${bars} bars`, (x1 + x2) / 2, Math.min(y1, y2) - 8); }
    ctx.setLineDash([]);
  };
  v.drawings.forEach((d) => drawShape(d, false)); if (v.pending) drawShape(v.pending, true);

  // crosshair + tooltip
  if (v.mouse && v.mouse.x < chartW && v.mouse.y < chartH) {
    const { x, y } = v.mouse; ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(139,151,171,0.5)";
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, chartH + STATS_H); ctx.moveTo(0, y + 0.5); ctx.lineTo(axisX, y + 0.5); ctx.stroke(); ctx.setLineDash([]);
    const price = hi - (y / chartH) * (hi - lo); ctx.fillStyle = "#1B2230"; ctx.fillRect(axisX + 1, y - 8, axisW - 2, 16); ctx.fillStyle = C.t1; ctx.font = `10px ${MONO}`; ctx.textAlign = "left"; ctx.fillText(price.toFixed(dec), axisX + 6, y);
    const i = start + Math.floor(x / v.spacing); const c = candles[i];
    if (c && !compact) {
      const info = [["O", c.o.toFixed(dec)], ["H", c.h.toFixed(dec)], ["L", c.l.toFixed(dec)], ["C", c.c.toFixed(dec)], ["VOL", fmtVol(c.vol)], ["Δ", signedVol(c.delta)], ["MAXΔ", signedVol(c.maxDelta)], ["MINΔ", signedVol(c.minDelta)], ["TRADES", c.approx ? "hist" : String(c.trades)]];
      ctx.fillStyle = "rgba(12,15,22,0.92)"; ctx.fillRect(8, 8, 118, 14 + info.length * 14); ctx.strokeStyle = C.grid; ctx.strokeRect(8.5, 8.5, 118, 14 + info.length * 14);
      ctx.font = `10px ${MONO}`; info.forEach(([k, val], r) => { const yy = 20 + r * 14; ctx.textAlign = "left"; ctx.fillStyle = C.t3; ctx.fillText(k, 14, yy); ctx.textAlign = "right"; ctx.fillStyle = k === "Δ" ? (c.delta >= 0 ? C.bull : C.bear) : C.t1; ctx.fillText(val, 120, yy); });
    }
  }
  if (v.offset > 0) { ctx.fillStyle = "rgba(242,200,121,0.9)"; ctx.font = `9px ${MONO}`; ctx.textAlign = "right"; ctx.fillText(`◀ ${v.offset} bars back · double-click to follow`, chartW - 8, 10); }
  if (tool && tool !== "crosshair" && !compact) { ctx.fillStyle = C.gold; ctx.font = `9px ${MONO}`; ctx.textAlign = "right"; ctx.fillText(`TOOL: ${tool.toUpperCase()}${v.pending ? " · click second point" : ""}`, chartW - 8, chartH - 10); }
}
