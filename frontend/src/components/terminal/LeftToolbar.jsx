import { Crosshair, TrendingUp, Minus, Square, BarChart3, Ruler, ZoomIn, ZoomOut, RotateCcw, Camera, Eraser } from "lucide-react";

const TOOLS = [
  { id: "crosshair", icon: Crosshair, label: "Crosshair" },
  { id: "trend", icon: TrendingUp, label: "Trend line" },
  { id: "hline", icon: Minus, label: "Horizontal line" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "measure", icon: Ruler, label: "Measure" },
  { id: "divider" },
  { id: "profile", icon: BarChart3, label: "Volume profile", toggle: true },
  { id: "zoomin", icon: ZoomIn, label: "Zoom in", action: true },
  { id: "zoomout", icon: ZoomOut, label: "Zoom out", action: true },
  { id: "reset", icon: RotateCcw, label: "Reset view", action: true },
  { id: "clear", icon: Eraser, label: "Clear drawings", action: true },
  { id: "screenshot", icon: Camera, label: "Screenshot", action: true },
];

export const LeftToolbar = ({ tool, onTool, profileOn }) => (
  <aside className="w-11 shrink-0 border-r border-line bg-panel flex flex-col items-center py-1.5 gap-0.5" data-testid="left-toolbar">
    {TOOLS.map((t) => t.id === "divider" ? <div key="d" className="h-px w-6 bg-line my-1.5" /> : (
      <button key={t.id} title={t.label} onClick={() => onTool(t.id)} data-testid={`tool-${t.id}`}
        className={`ibtn ${(t.id === tool) || (t.toggle && profileOn) ? "ibtn-active" : ""}`}><t.icon size={15} /></button>
    ))}
  </aside>
);
