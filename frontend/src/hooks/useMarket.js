import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MarketEngine } from "@/lib/marketEngine";

export function useMarket(cfg) {
  const ref = useRef(null);
  if (!ref.current) ref.current = new MarketEngine(cfg);
  const engine = ref.current;
  const market = useSyncExternalStore(useCallback((cb) => engine.subscribe(cb), [engine]), () => engine.snapshot());
  useEffect(() => { engine.start(); return () => engine.stop(); }, [engine]);
  return { market, engine };
}

export function useMediaQuery(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const fn = (e) => setM(e.matches); mq.addEventListener("change", fn); return () => mq.removeEventListener("change", fn); }, [q]);
  return m;
}

export function useFlash(value) {
  const [cls, setCls] = useState("");
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current || !prev.current) { prev.current = value; return; }
    setCls(value > prev.current ? "flash-up" : "flash-down"); prev.current = value;
    const t = setTimeout(() => setCls(""), 400); return () => clearTimeout(t);
  }, [value]);
  return cls;
}
