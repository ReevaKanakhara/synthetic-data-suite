"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Maximize2, Hash, Layers } from "lucide-react";
import { BoundingBox, TaskStatusResponse } from "@/types";
import AnnotationCanvas from "@/components/AnnotationCanvas";
import ExportButton from "@/components/ExportButton";
import AutoLabelPanel from "@/components/AutoLabelPanel";

export default function AnnotatePage() {
  const { id } = useParams<{ id: string }>();
  const [imageData, setImageData] = useState<TaskStatusResponse | null>(null);
  const [boxes,     setBoxes]     = useState<BoundingBox[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Key trick: incrementing this forces AnnotationCanvas to remount
  // when we inject auto-label boxes, clearing and redrawing the canvas.
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    fetch(`/api/image/${id}`)
      .then(r => r.json())
      .then(setImageData)
      .finally(() => setLoading(false));
  }, [id]);

  const handleAutoLabelApprove = (newBoxes: BoundingBox[]) => {
    setBoxes(newBoxes);
    // Force canvas remount so it redraws with the new boxes
    setCanvasKey(k => k + 1);
  };

  if (loading) return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      minHeight:      "60vh",
      flexDirection:  "column",
      gap:            "12px",
    }}>
      <div style={{
        width:        "28px",
        height:       "28px",
        borderRadius: "50%",
        border:       "2px solid #16161E",
        borderTopColor: "var(--accent)",
        animation:    "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{
        fontSize:   "12px",
        color:      "var(--text-secondary)",
        fontFamily: "monospace",
      }}>
        // loading studio...
      </span>
    </div>
  );

  if (!imageData?.image_url) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <p style={{ color: "var(--error)", marginBottom: "12px" }}>
        Image not found
      </p>
      <Link href="/"
        style={{ fontSize: "13px", color: "var(--accent)" }}>
        ← Return to dashboard
      </Link>
    </div>
  );

  const sidebarStyle = {
    background:          "rgba(10,10,20,0.75)",
    border:              "1px solid rgba(255,255,255,0.06)",
    borderRadius:        "14px",
    padding:             "16px",
    backdropFilter:      "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow:           "0 8px 32px rgba(0,0,0,0.5)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "space-between",
      }}>
        <div>
          <Link href="/"
            style={{
              display:     "inline-flex",
              alignItems:  "center",
              gap:         "5px",
              fontSize:    "12px",
              color:       "var(--text-secondary)",
              textDecoration: "none",
              marginBottom: "8px",
            }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.color =
                "var(--text-primary)")}
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.color =
                "var(--text-secondary)")}>
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <h1 style={{
            fontSize:      "28px",
            fontWeight:    700,
            letterSpacing: "-0.04em",
            color:         "var(--text-primary)",
          }}>
            Annotation Studio
          </h1>
          <p style={{
            fontSize: "13px",
            color:    "var(--text-secondary)",
            marginTop: "4px",
          }}>
            Draw boxes manually or use AI Auto-Label ·{" "}
            <span style={{ color: "var(--accent-2)", fontFamily: "monospace" }}>
              {imageData.width}×{imageData.height}px
            </span>
          </p>
        </div>

        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        "6px",
          padding:    "6px 12px",
          borderRadius: "8px",
          background: "var(--bg-card)",
          border:     "1px solid var(--border)",
        }}>
          <Layers size={12} color="var(--accent)" />
          <span style={{
            fontSize:   "12px",
            color:      "var(--text-secondary)",
            fontFamily: "monospace",
          }}>
            {boxes.length} annotations
          </span>
        </div>
      </div>

      {/* Studio layout */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "1fr 272px",
        gap:                 "16px",
        alignItems:          "start",
      }}>

        {/* Canvas */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background:          "var(--bg-card)",
            border:              "1px solid var(--border)",
            borderRadius:        "16px",
            padding:             "20px",
            backdropFilter:      "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}>
          <AnnotationCanvas
            key={canvasKey}
            imageUrl={imageData.image_url!}
            imageWidth={imageData.width!}
            imageHeight={imageData.height!}
            initialBoxes={boxes}
            onBoxesChange={setBoxes}
          />
        </motion.div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* AI Auto-Label panel */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
            <AutoLabelPanel
              imageId={id!}
              imageWidth={imageData.width!}
              imageHeight={imageData.height!}
              onApprove={handleAutoLabelApprove}
            />
          </motion.div>

          {/* Image info */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={sidebarStyle}
            whileHover={{
              y: -2,
              boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
            }}
            // @ts-ignore
            transition={{ duration: 0.3 }}>
            <span style={{
              fontSize:      "10px",
              color:         "#6b6b8a",
              fontWeight:    600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}>
              Image Info
            </span>
            <div style={{
              marginTop:     "12px",
              display:       "flex",
              flexDirection: "column",
              gap:           "10px",
            }}>
              {[
                {
                  icon:  Maximize2,
                  label: "Dimensions",
                  value: `${imageData.width} × ${imageData.height}`,
                },
                {
                  icon:  Hash,
                  label: "Image ID",
                  value: `${id?.slice(0, 8)}...`,
                  mono:  true,
                },
                {
                  icon:   Layers,
                  label:  "Annotations",
                  value:  String(boxes.length),
                  accent: true,
                },
              ].map((row, i) => {
                const Icon = row.icon;
                return (
                  <div key={i} style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                  }}>
                    <div style={{
                      display:    "flex",
                      alignItems: "center",
                      gap:        "6px",
                    }}>
                      <Icon size={11} color="#6b6b8a" />
                      <span style={{
                        fontSize: "12px",
                        color:    "#a0a0b8",
                      }}>
                        {row.label}
                      </span>
                    </div>
                    <span style={{
                      fontSize:   "12px",
                      fontWeight: 600,
                      color:      row.accent
                        ? "var(--accent)"
                        : "var(--text-primary)",
                      fontFamily: row.mono ? "monospace" : "inherit",
                    }}>
                      {row.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Export */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}>
            <ExportButton
              imageId={id!}
              imageUrl={imageData.image_url!}     // ← ADD THIS
              imageWidth={imageData.width!}
              imageHeight={imageData.height!}
              boxes={boxes}
            />
          </motion.div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={sidebarStyle}
            whileHover={{
              y: -2,
              boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
            }}
            // @ts-ignore
            transition={{ duration: 0.3 }}>
            <span style={{
              fontSize:      "10px",
              color:         "#6b6b8a",
              fontWeight:    600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}>
              How to annotate
            </span>
            <div style={{
              marginTop:     "14px",
              display:       "flex",
              flexDirection: "column",
              gap:           "10px",
            }}>
              {[
                ["01", "Click 'Detect Objects' for AI suggestions"],
                ["02", "Approve or reject each detected box"],
                ["03", "Draw additional boxes manually"],
                ["04", "Export as COCO JSON when done"],
              ].map(([n, t]) => (
                <div key={n} style={{
                  display:    "flex",
                  gap:        "10px",
                  alignItems: "flex-start",
                }}>
                  <span style={{
                    fontSize:   "10px",
                    fontWeight: 700,
                    color:      "var(--accent)",
                    fontFamily: "monospace",
                    flexShrink: 0,
                    marginTop:  "1px",
                    minWidth:   "16px",
                  }}>
                    {n}
                  </span>
                  <span style={{
                    fontSize:   "12px",
                    color:      "#a0a0b8",
                    lineHeight: 1.5,
                  }}>
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}