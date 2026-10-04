import { decimalsOf, levelKey } from "./marketEngine";
import { fmtVol, signedVol } from "./format";

export function clusterCells(cells, cluster) {
  const out = {};
  for (const k in cells) { const lv = levelKey(+k, cluster); const o = out[lv] || (out[lv] = { bid: 0, ask: 0 }); o.bid += cells[k].bid; o.ask += cells[k].ask; }
  return out;
}

export function markImbalances(cells, cluster, ratio = 3, stackN = 3) {
  const d = decimalsOf(cluster); const key = (p) => p.toFixed(d);
  const prices = Object.keys(cells).map(Number).sort((a, b) => a - b);
  if (!prices.length) return {};
  let total = 0; prices.forEach((p) => { const c = cells[key(p)]; total += c.bid + c.ask; });
  const minVol = (total / prices.length) * 0.35;
  const out = {};
  prices.forEach((p) => {
    const c = cells[key(p)]; const below = cells[key(p - cluster)]; const above = cells[key(p + cluster)]; const f = {};
    if (below && c.ask >= minVol && c.ask >= ratio * Math.max(below.bid, minVol * 0.2)) f.askImb = true;
    if (above && c.bid >= minVol && c.bid >= ratio * Math.max(above.ask, minVol * 0.2)) f.bidImb = true;
    out[key(p)] = f;
  });
  const run = (flag, stacked) => {
    let streak = [];
    const flush = () => { if (streak.length >= stackN) streak.forEach((k) => (out[k][stacked] = true)); streak = []; };
    prices.forEach((p) => { const k = key(p); if (out[k][flag]) streak.push(k); else flush(); });
    flush();
  };
  run("askImb", "stackedAsk"); run("bidImb", "stackedBid");
  return out;
}

export function volumeProfile(candles, tick) {
  const agg = {}; let maxTotal = 0, sum = 0;
  candles.forEach((c) => { for (const k in c.cells) { const o = agg[k] || (agg[k] = { price: +k, bid: 0, ask: 0, total: 0 }); o.bid += c.cells[k].bid; o.ask += c.cells[k].ask; } });
  const levels = Object.values(agg).sort((a, b) => a.price - b.price);
  levels.forEach((l) => { l.total = l.bid + l.ask; maxTotal = Math.max(maxTotal, l.total); sum += l.total; });
  if (!levels.length) return { levels, poc: 0, vah: 0, val: 0, maxTotal: 0, sum: 0, hvn: [], lvn: [], pocVolume: 0 };
  const pocL = levels.reduce((a, b) => (b.total > a.total ? b : a));
  let lo = levels.indexOf(pocL), hi = lo, acc = pocL.total;
  while (acc < sum * 0.7 && (lo > 0 || hi < levels.length - 1)) {
    const dn = lo > 0 ? levels[lo - 1].total : -1, up = hi < levels.length - 1 ? levels[hi + 1].total : -1;
    if (up >= dn) { hi++; acc += up; } else { lo--; acc += dn; }
  }
  const avg = sum / levels.length;
  const hvn = levels.filter((l) => l.total > avg * 1.6).sort((a, b) => b.total - a.total);
  const lvn = levels.filter((l) => l.total < avg * 0.35 && l.price > levels[0].price && l.price < levels[levels.length - 1].price).sort((a, b) => a.total - b.total);
  return { levels, poc: pocL.price, vah: levels[hi].price, val: levels[lo].price, maxTotal, sum, hvn, lvn, pocVolume: pocL.total, tick };
}

export function vwapSeries(candles) {
  let pv = 0, pv2 = 0, vol = 0, day = null; const out = [];
  candles.forEach((c) => {
    const d = Math.floor(c.t / 86400000); if (d !== day) { day = d; pv = 0; pv2 = 0; vol = 0; }
    const tp = (c.h + c.l + c.c) / 3; pv += tp * c.vol; pv2 += tp * tp * c.vol; vol += c.vol;
    const vwap = vol ? pv / vol : tp; const sd = Math.sqrt(Math.max(0, vol ? pv2 / vol - vwap * vwap : 0));
    out.push({ vwap, upper: vwap + sd, lower: vwap - sd, upper2: vwap + 2 * sd, lower2: vwap - 2 * sd });
  });
  return out;
}

export function sessionLevels(candles) {
  if (!candles.length) return { high: 0, low: 0 };
  const day = Math.floor(candles[candles.length - 1].t / 86400000);
  const sess = candles.filter((c) => Math.floor(c.t / 86400000) === day);
  const src = sess.length ? sess : candles;
  return { high: Math.max(...src.map((c) => c.h)), low: Math.min(...src.map((c) => c.l)) };
}

export function cumulativeDelta(candles) { let acc = 0; return candles.map((c) => (acc += c.delta)); }

export function detectAbsorption(candles, mult = 1.8) {
  if (candles.length < 10) return [];
  const recent = candles.slice(-40);
  const avgVol = recent.reduce((a, c) => a + c.vol, 0) / recent.length;
  const avgRange = recent.reduce((a, c) => a + (c.h - c.l), 0) / recent.length;
  const out = [];
  candles.slice(-30).forEach((c) => {
    if (!c.vol || c.vol < avgVol * mult) return;
    const range = c.h - c.l; if (range > avgRange * 0.8) return;
    const ratio = c.delta / c.vol; const response = range < avgRange * 0.5 ? "Weak" : "Muted";
    if (ratio < -0.25 && c.c >= c.l + range * 0.4) out.push({ t: c.t, price: c.c, side: "sell", volume: c.sell, delta: c.delta, ratio, response, label: "Potential Seller Absorption", bias: "bullish" });
    else if (ratio > 0.25 && c.c <= c.h - range * 0.4) out.push({ t: c.t, price: c.c, side: "buy", volume: c.buy, delta: c.delta, ratio, response, label: "Potential Buyer Absorption", bias: "bearish" });
  });
  return out;
}

export function computeSignal(candles, tick, settings) {
  if (candles.length < 5) return { bias: "NO TRADE", confidence: "Neutral", score: 0, factors: [] };
  const last = candles[candles.length - 1]; const vw = vwapSeries(candles); const vwap = vw[vw.length - 1].vwap;
  const recent = candles.slice(-10); const cum = recent.reduce((a, c) => a + c.delta, 0);
  const cumPrev = candles.slice(-20, -10).reduce((a, c) => a + c.delta, 0);
  let score = 0; const factors = [];
  const add = (label, value, dir, w = 1) => { score += dir * w; factors.push({ label, value, dir }); };
  add("Cumulative delta · 10 bars", signedVol(cum), cum > 0 ? 1 : cum < 0 ? -1 : 0, 1.5);
  add("Delta momentum", cum > cumPrev ? "Rising" : "Falling", cum > cumPrev ? 1 : -1);
  add("Price vs VWAP", last.c > vwap ? "Above" : "Below", last.c > vwap ? 1 : -1);
  let askI = 0, bidI = 0;
  candles.slice(-5).forEach((c) => { Object.values(markImbalances(c.cells, tick, settings.imbalanceRatio, settings.stackedCount)).forEach((x) => { if (x.askImb) askI++; if (x.bidImb) bidI++; }); });
  add("Imbalances · 5 bars", `${askI} buy / ${bidI} sell`, askI > bidI ? 1 : askI < bidI ? -1 : 0);
  const abs = detectAbsorption(candles, settings.absorptionMultiplier).slice(-1)[0];
  if (abs) add("Absorption", abs.label, abs.bias === "bullish" ? 1 : -1, 1.5); else factors.push({ label: "Absorption", value: "None detected", dir: 0 });
  const priceUp = last.c > recent[0].o; const aligned = (priceUp && cum > 0) || (!priceUp && cum < 0);
  add("Delta / price alignment", aligned ? "Aligned" : "Divergent", aligned ? (priceUp ? 1 : -1) : priceUp ? -1 : 1);
  const a = Math.abs(score);
  const confidence = a >= 5 ? "Strong" : a >= 3.5 ? "Moderate" : a >= 2 ? "Weak" : "Neutral";
  const bias = confidence === "Neutral" ? "NO TRADE" : score > 0 ? "LONG BIAS" : "SHORT BIAS";
  return { bias, confidence, score, factors, vwap, cum };
}

export function buildAlerts(candles, tick, symbol, settings) {
  const out = []; const dec = decimalsOf(tick) + (tick >= 1 ? 0 : 0);
  detectAbsorption(candles, settings.absorptionMultiplier).slice(-4).forEach((a) => out.push({
    id: `abs-${a.t}-${a.side}`, t: a.t, type: "ABSORPTION DETECTED", tone: a.bias === "bullish" ? "bull" : "bear", symbol,
    rows: [["Price", a.price.toFixed(dec)], [a.side === "sell" ? "Sell Volume" : "Buy Volume", fmtVol(a.volume)], ["Delta", signedVol(a.delta)], ["Price Response", a.response]],
    note: a.label, strength: Math.abs(a.ratio) > 0.4 ? "HIGH" : "MODERATE",
  }));
  candles.slice(-6).forEach((c) => {
    const f = markImbalances(c.cells, tick, settings.imbalanceRatio, settings.stackedCount);
    const sa = Object.keys(f).filter((k) => f[k].stackedAsk).map(Number), sb = Object.keys(f).filter((k) => f[k].stackedBid).map(Number);
    if (sa.length) out.push({ id: `sa-${c.t}`, t: c.t, type: "STACKED BUY IMBALANCE", tone: "bull", symbol, rows: [["Range", `${Math.min(...sa).toFixed(dec)} – ${Math.max(...sa).toFixed(dec)}`], ["Levels", String(sa.length)], ["Candle Delta", signedVol(c.delta)]], note: "Aggressive buying stacked across consecutive levels", strength: sa.length >= 5 ? "HIGH" : "MODERATE" });
    if (sb.length) out.push({ id: `sb-${c.t}`, t: c.t, type: "STACKED SELL IMBALANCE", tone: "bear", symbol, rows: [["Range", `${Math.min(...sb).toFixed(dec)} – ${Math.max(...sb).toFixed(dec)}`], ["Levels", String(sb.length)], ["Candle Delta", signedVol(c.delta)]], note: "Aggressive selling stacked across consecutive levels", strength: sb.length >= 5 ? "HIGH" : "MODERATE" });
  });
  return out.sort((a, b) => b.t - a.t).slice(0, 12);
}

export function runBacktest(candles, tick, p) {
  const trades = []; const n = candles.length; let i = 5;
  while (i < n - 1) {
    const c = candles[i]; let dir = 0;
    if (p.strategy === "imbalance") { const v = Object.values(markImbalances(c.cells, tick, p.imbalanceRatio, p.stackedCount)); if (v.some((x) => x.stackedAsk)) dir = 1; else if (v.some((x) => x.stackedBid)) dir = -1; }
    else if (p.strategy === "delta") { const prev = candles[i - 1]; if (c.delta > 0 && prev.delta > 0 && c.c > prev.h) dir = 1; else if (c.delta < 0 && prev.delta < 0 && c.c < prev.l) dir = -1; }
    else { const abs = detectAbsorption(candles.slice(0, i + 1), p.absorptionMultiplier).find((a) => a.t === c.t); if (abs) dir = abs.bias === "bullish" ? 1 : -1; }
    if (!dir) { i++; continue; }
    const entry = candles[i + 1].o; const stop = entry - dir * p.stopTicks * tick, target = entry + dir * p.targetTicks * tick;
    let exit = null, exitIdx = null, reason = "time";
    for (let j = i + 1; j < Math.min(n, i + 1 + p.hold); j++) {
      const b = candles[j];
      if (dir > 0 ? b.l <= stop : b.h >= stop) { exit = stop; exitIdx = j; reason = "stop"; break; }
      if (dir > 0 ? b.h >= target : b.l <= target) { exit = target; exitIdx = j; reason = "target"; break; }
    }
    if (exit === null) { exitIdx = Math.min(n - 1, i + p.hold); exit = candles[exitIdx].c; }
    const pnl = (exit - entry) * dir;
    trades.push({ t: candles[i + 1].t, dir, entry, exit, pnl, pnlPct: (pnl / entry) * 100, reason, bars: exitIdx - i });
    i = exitIdx + 1;
  }
  let eq = 0, peak = 0, dd = 0;
  const equity = [{ i: 0, eq: 0 }].concat(trades.map((t, idx) => { eq += t.pnlPct; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); return { i: idx + 1, eq: +eq.toFixed(3) }; }));
  const wins = trades.filter((t) => t.pnl > 0), losses = trades.filter((t) => t.pnl <= 0);
  const gw = wins.reduce((a, t) => a + t.pnlPct, 0), gl = Math.abs(losses.reduce((a, t) => a + t.pnlPct, 0));
  return { trades, equity, stats: { count: trades.length, winRate: trades.length ? (wins.length / trades.length) * 100 : 0, pnlPct: eq, maxDD: dd, avgWin: wins.length ? gw / wins.length : 0, avgLoss: losses.length ? gl / losses.length : 0, pf: gl ? gw / gl : gw ? 99 : 0 } };
}
