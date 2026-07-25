"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { BoundingBox } from "@/types";
import { Trash2 } from "lucide-react";

const NEON = ["#8B5CF6","#06B6D4","#10b981","#f59e0b","#f43f5e","#ec4899","#84cc16","#f97316"];

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  initialBoxes?: BoundingBox[];      
  onBoxesChange: (boxes: BoundingBox[]) => void;
}

// Fixed: Destructured initialBoxes in the argument list below
export default function AnnotationCanvas({ imageUrl, imageWidth, imageHeight, initialBoxes, onBoxesChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<BoundingBox[]>(initialBoxes ?? []);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [label, setLabel] = useState("object");
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const color = (i: number) => NEON[i % NEON.length];

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const redraw = useCallback((boxList: BoundingBox[], cur?: typeof currentBox | null, hov?: string | null) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid background
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 28) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 28) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Saved boxes — neon glow
    boxList.forEach((box, i) => {
      const c = color(i);
      const cx = box.x * scale.x, cy = box.y * scale.y;
      const cw = box.width * scale.x, ch = box.height * scale.y;
      const isHov = hov === box.id;

      // Glow fill
      ctx.fillStyle = isHov ? `${c}28` : `${c}12`;
      ctx.fillRect(cx, cy, cw, ch);

      // Neon border with glow
      ctx.save();
      ctx.shadowColor = c;
      ctx.shadowBlur = isHov ? 16 : 8;
      ctx.strokeStyle = c;
      ctx.lineWidth = isHov ? 2 : 1.5;
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.restore();

      // Corner accents
      const cs = 6;
      [[cx, cy], [cx + cw - cs, cy], [cx, cy + ch - cs], [cx + cw - cs, cy + ch - cs]].forEach(([px, py]) => {
        ctx.fillStyle = c;
        ctx.fillRect(px, py, cs, cs);
      });

      // Label pill
      ctx.font = "500 11px Inter, sans-serif";
      const lw = ctx.measureText(box.label).width;
      const pw = lw + 12, ph = 20;
      ctx.save();
      ctx.shadowColor = c; ctx.shadowBlur = 10;
      ctx.fillStyle = c;
      roundRect(ctx, cx, cy - ph - 2, pw, ph, 4);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "white";
      ctx.fillText(box.label, cx + 6, cy - 2 - 5);

      // Hover tooltip
      if (isHov) {
        const dim = `${Math.round(box.width)} × ${Math.round(box.height)}px`;
        ctx.font = "500 11px monospace";
        const dw = ctx.measureText(dim).width + 16;
        const tx = cx + cw / 2 - dw / 2, ty = cy + ch / 2 - 12;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        roundRect(ctx, tx, ty, dw, 24, 6);
        ctx.fill();
        ctx.save();
        ctx.shadowColor = c; ctx.shadowBlur = 8;
        ctx.fillStyle = c;
        ctx.fillText(dim, tx + 8, ty + 16);
        ctx.restore();
      }
    });

    // Drawing preview
    if (cur && (Math.abs(cur.w) > 3 || Math.abs(cur.h) > 3)) {
      ctx.save();
      ctx.shadowColor = "var(--accent)"; ctx.shadowBlur = 12;
      ctx.strokeStyle = "#8B5CF6"; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cur.x, cur.y, cur.w, cur.h);
      ctx.restore();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(139,92,246,0.08)";
      ctx.fillRect(cur.x, cur.y, cur.w, cur.h);
    }
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current, canvas = canvasRef.current;
    if (!container || !canvas) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      const w = container.clientWidth;
      const h = w * (imageHeight / imageWidth);
      canvas.width = w; canvas.height = h;
      setScale({ x: w / imageWidth, y: h / imageHeight });
      redraw([]);
    };
  }, [imageUrl, imageWidth, imageHeight]);

  useEffect(() => { redraw(boxes, currentBox, hoveredId); }, [boxes, currentBox, hoveredId, scale, redraw]);

  const getPos = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const findBox = (x: number, y: number) => {
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (x >= b.x * scale.x && x <= (b.x + b.width) * scale.x &&
          y >= b.y * scale.y && y <= (b.y + b.height) * scale.y) return b.id;
    }
    return null;
  };

  const removeBox = (id: string) => {
    const updated = boxes.filter(b => b.id !== id);
    setBoxes(updated); onBoxesChange(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 14px", borderRadius: "10px",
        background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>Label</span>
        <input value={label} onChange={e => setLabel(e.target.value)}
          style={{ width: "140px", padding: "5px 10px", borderRadius: "6px",
            background: "var(--bg-input)", border: "1px solid var(--border)",
            color: "var(--text-primary)", fontSize: "12px", fontFamily: "monospace" }} />
        <div style={{ width: "1px", height: "14px", background: "var(--border)" }} />
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Drag to draw · Right-click to delete
        </span>
        {boxes.length > 0 && (
          <button onClick={() => { setBoxes([]); onBoxesChange([]); }}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px",
              fontSize: "11px", color: "var(--error)", background: "var(--error-bg)",
              border: "1px solid var(--error-border)", padding: "4px 10px",
              borderRadius: "6px", cursor: "pointer" }}>
            <Trash2 size={11} /> Clear all
          </button>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ width: "100%", borderRadius: "12px", overflow: "hidden",
        border: "1px solid var(--border)", background: "#060610", cursor: "crosshair",
        boxShadow: "inset 0 0 40px rgba(0,0,0,0.5)" }}>
        <canvas ref={canvasRef}
          onMouseDown={e => { setDrawing(true); setStartPos(getPos(e)); }}
          onMouseMove={e => {
            const p = getPos(e);
            setHoveredId(findBox(p.x, p.y));
            if (drawing) setCurrentBox({ x: startPos.x, y: startPos.y, w: p.x - startPos.x, h: p.y - startPos.y });
          }}
          onMouseUp={e => {
            if (!drawing) return;
            setDrawing(false);
            const p = getPos(e);
            const cw = Math.abs(p.x - startPos.x), ch = Math.abs(p.y - startPos.y);
            if (cw < 8 || ch < 8) { setCurrentBox(null); return; }
            const nb: BoundingBox = {
              id: crypto.randomUUID(), label,
              x: Math.min(startPos.x, p.x) / scale.x,
              y: Math.min(startPos.y, p.y) / scale.y,
              width: cw / scale.x, height: ch / scale.y,
            };
            const updated = [...boxes, nb];
            setBoxes(updated); onBoxesChange(updated); setCurrentBox(null);
          }}
          onMouseLeave={() => { setHoveredId(null); if (drawing) { setDrawing(false); setCurrentBox(null); } }}
          onContextMenu={e => { e.preventDefault(); const p = getPos(e); const id = findBox(p.x, p.y); if (id) removeBox(id); }}
          style={{ width: "100%", display: "block", cursor: "crosshair" }} />
      </div>

      {/* Box list */}
      {boxes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Annotations — {boxes.length}
          </span>
          {boxes.map((box, i) => (
            <div key={box.id}
              onMouseEnter={() => setHoveredId(box.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 12px", borderRadius: "8px",
                background: hoveredId === box.id ? "var(--bg-elevated)" : "var(--bg-card)",
                border: `1px solid ${hoveredId === box.id ? color(i) + "40" : "var(--border)"}`,
                boxShadow: hoveredId === box.id ? `0 0 12px ${color(i)}15` : "none",
                transition: "all 150ms", cursor: "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "2px",
                  background: color(i), boxShadow: `0 0 6px ${color(i)}`, flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)",
                  fontFamily: "monospace" }}>{box.label}</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {Math.round(box.x)},{Math.round(box.y)} {Math.round(box.width)}×{Math.round(box.height)}
                </span>
              </div>
              <button onClick={() => removeBox(box.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", display: "flex", alignItems: "center",
                  padding: "4px", borderRadius: "4px" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--error)"; e.currentTarget.style.background = "var(--error-bg)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}