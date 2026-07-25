"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Loader,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { autoLabelImage, AutoLabelBox } from "@/lib/api";
import { BoundingBox } from "@/types";

interface Props {
  imageId:    string;
  imageWidth: number;
  imageHeight: number;
  onApprove:  (boxes: BoundingBox[]) => void;
}

// Confidence color coding
function confidenceColor(score: number): string {
  if (score >= 0.8) return "#10b981";   // green
  if (score >= 0.5) return "#f59e0b";   // amber
  return "#f43f5e";                      // red
}

function confidenceLabel(score: number): string {
  if (score >= 0.8) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

export default function AutoLabelPanel({
  imageId, imageWidth, imageHeight, onApprove,
}: Props) {
  const [loading,    setLoading]    = useState(false);
  const [boxes,      setBoxes]      = useState<AutoLabelBox[] | null>(null);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [confidence, setConfidence] = useState(0.25);
  const [expanded,   setExpanded]   = useState(true);
  const [ran,        setRan]        = useState(false);

  const handleRun = async () => {
    setLoading(true);
    setRan(true);
    try {
      const result = await autoLabelImage(imageId, confidence);
      setBoxes(result.boxes);

      // Auto-select all boxes with confidence >= 0.5
      const autoSelected = new Set(
        result.boxes
          .map((_, i) => i)
          .filter(i => result.boxes[i].confidence >= 0.5)
      );
      setSelected(autoSelected);

      if (result.total === 0) {
        toast.info("No objects detected", {
          description: "Try lowering the confidence threshold.",
        });
      } else {
        toast.success(`${result.total} object${result.total > 1 ? "s" : ""} detected`, {
          description: `${autoSelected.size} auto-selected (confidence ≥ 50%)`,
        });
      }
    } catch {
      toast.error("Auto-label failed", {
        description: "Check that the backend is running.",
      });
      setBoxes([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleBox = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleApproveSelected = () => {
    if (!boxes) return;
    const approved: BoundingBox[] = Array.from(selected).map(i => ({
      id:     crypto.randomUUID(),
      label:  boxes[i].label,
      x:      boxes[i].x,
      y:      boxes[i].y,
      width:  boxes[i].bbox_width,
      height: boxes[i].bbox_height,
    }));
    onApprove(approved);
    toast.success(`${approved.length} annotation${approved.length > 1 ? "s" : ""} added`, {
      description: "Boxes loaded into the canvas. Export when ready.",
    });
  };

  const handleApproveAll = () => {
    if (!boxes) return;
    setSelected(new Set(boxes.map((_, i) => i)));
    const approved: BoundingBox[] = boxes.map(b => ({
      id:     crypto.randomUUID(),
      label:  b.label,
      x:      b.x,
      y:      b.y,
      width:  b.bbox_width,
      height: b.bbox_height,
    }));
    onApprove(approved);
    toast.success(`All ${approved.length} annotations added`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background:          "var(--bg-card)",
        border:              "1px solid var(--border)",
        borderRadius:        "12px",
        overflow:            "hidden",
      }}>

      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          width:          "100%",
          padding:        "12px 16px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          background:     "none",
          border:         "none",
          cursor:         "pointer",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width:        "22px",
            height:       "22px",
            borderRadius: "6px",
            background:   "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))",
            border:       "1px solid rgba(139,92,246,0.3)",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
          }}>
            <Sparkles size={11} color="var(--accent)" />
          </div>
          <span style={{
            fontSize:   "12px",
            fontWeight: 600,
            color:      "var(--text-primary)",
          }}>
            AI Auto-Label
          </span>
          {boxes !== null && (
            <span style={{
              fontSize:   "10px",
              color:      "var(--accent)",
              fontFamily: "monospace",
              background: "rgba(139,92,246,0.1)",
              padding:    "1px 6px",
              borderRadius: "99px",
            }}>
              {boxes.length} detected
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp  size={14} color="var(--text-muted)" />
          : <ChevronDown size={14} color="var(--text-muted)" />}
      </button>

      {/* Collapsible body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}>
            <div style={{
              padding:       "0 16px 16px",
              display:       "flex",
              flexDirection: "column",
              gap:           "12px",
            }}>

              {/* Confidence slider */}
              <div>
                <div style={{
                  display:        "flex",
                  justifyContent: "space-between",
                  alignItems:     "center",
                  marginBottom:   "6px",
                }}>
                  <span style={{
                    fontSize: "11px",
                    color:    "var(--text-secondary)",
                    fontWeight: 500,
                  }}>
                    Min confidence
                  </span>
                  <span style={{
                    fontSize:   "11px",
                    color:      confidenceColor(confidence),
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}>
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1} max={0.9} step={0.05}
                  value={confidence}
                  onChange={e => setConfidence(Number(e.target.value))}
                  style={{
                    width:           "100%",
                    height:          "4px",
                    borderRadius:    "99px",
                    background:      `linear-gradient(90deg, ${
                      confidenceColor(confidence)
                    } ${confidence * 100}%, var(--bg-elevated) ${confidence * 100}%)`,
                    outline:         "none",
                    cursor:          "pointer",
                    WebkitAppearance: "none",
                    appearance:      "none",
                  }}
                />
                <div style={{
                  display:        "flex",
                  justifyContent: "space-between",
                  marginTop:      "3px",
                }}>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                    More detections
                  </span>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                    Higher precision
                  </span>
                </div>
              </div>

              {/* Run button */}
              <motion.button
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{   scale: loading ? 1 : 0.98 }}
                onClick={handleRun}
                disabled={loading}
                style={{
                  width:          "100%",
                  padding:        "10px",
                  borderRadius:   "8px",
                  border:         "none",
                  background:     loading
                    ? "rgba(139,92,246,0.2)"
                    : "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                  color:          "white",
                  fontWeight:     600,
                  fontSize:       "13px",
                  cursor:         loading ? "not-allowed" : "pointer",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  gap:            "7px",
                  boxShadow:      loading
                    ? "none"
                    : "0 0 16px rgba(139,92,246,0.3)",
                }}>
                {loading ? (
                  <><Loader size={13}
                    style={{ animation: "spin 0.8s linear infinite" }} />
                  Detecting objects...</>
                ) : (
                  <><Sparkles size={13} />
                  {ran ? "Re-run Detection" : "Detect Objects"}</>
                )}
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </motion.button>

              {/* Results list */}
              <AnimatePresence>
                {boxes !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{    opacity: 0 }}
                    style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

                    {boxes.length === 0 ? (
                      <div style={{
                        textAlign:  "center",
                        padding:    "16px",
                        borderRadius: "8px",
                        background: "var(--bg-elevated)",
                        border:     "1px solid var(--border)",
                      }}>
                        <AlertCircle size={18} color="var(--text-muted)"
                          style={{ margin: "0 auto 6px", display: "block" }} />
                        <p style={{
                          fontSize: "12px",
                          color:    "var(--text-secondary)",
                        }}>
                          No objects detected. Try lowering the confidence threshold.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Approve controls */}
                        <div style={{
                          display:    "flex",
                          gap:        "6px",
                          alignItems: "center",
                        }}>
                          <span style={{
                            fontSize: "11px",
                            color:    "var(--text-muted)",
                            flex:     1,
                          }}>
                            {selected.size} / {boxes.length} selected
                          </span>
                          <button
                            onClick={() => setSelected(new Set())}
                            style={{
                              fontSize:     "10px",
                              color:        "var(--text-muted)",
                              background:   "none",
                              border:       "none",
                              cursor:       "pointer",
                              padding:      "2px 6px",
                            }}>
                            None
                          </button>
                          <button
                            onClick={() =>
                              setSelected(new Set(boxes.map((_, i) => i)))}
                            style={{
                              fontSize:     "10px",
                              color:        "var(--accent-2)",
                              background:   "none",
                              border:       "none",
                              cursor:       "pointer",
                              padding:      "2px 6px",
                            }}>
                            All
                          </button>
                        </div>

                        {/* Box list */}
                        <div style={{
                          display:       "flex",
                          flexDirection: "column",
                          gap:           "5px",
                          maxHeight:     "200px",
                          overflowY:     "auto",
                        }}>
                          {boxes.map((box, i) => {
                            const isSelected = selected.has(i);
                            const color      = confidenceColor(box.confidence);
                            return (
                              <motion.div
                                key={i}
                                whileHover={{ x: 2 }}
                                onClick={() => toggleBox(i)}
                                style={{
                                  display:       "flex",
                                  alignItems:    "center",
                                  gap:           "8px",
                                  padding:       "7px 10px",
                                  borderRadius:  "7px",
                                  background:    isSelected
                                    ? "rgba(139,92,246,0.08)"
                                    : "var(--bg-elevated)",
                                  border:        `1px solid ${
                                    isSelected
                                      ? "rgba(139,92,246,0.25)"
                                      : "var(--border)"
                                  }`,
                                  cursor:        "pointer",
                                  transition:    "all 150ms",
                                }}>

                                {/* Checkbox */}
                                <div style={{
                                  width:          "14px",
                                  height:         "14px",
                                  borderRadius:   "3px",
                                  border:         `1.5px solid ${
                                    isSelected ? "var(--accent)" : "var(--text-muted)"
                                  }`,
                                  background:     isSelected
                                    ? "var(--accent)"
                                    : "transparent",
                                  display:        "flex",
                                  alignItems:     "center",
                                  justifyContent: "center",
                                  flexShrink:     0,
                                  transition:     "all 150ms",
                                }}>
                                  {isSelected && (
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                      <path d="M1 4L3 6L7 2"
                                        stroke="white" strokeWidth="1.5"
                                        strokeLinecap="round" />
                                    </svg>
                                  )}
                                </div>

                                {/* Label */}
                                <span style={{
                                  fontSize:   "12px",
                                  fontWeight: 500,
                                  color:      "var(--text-primary)",
                                  flex:       1,
                                  fontFamily: "monospace",
                                }}>
                                  {box.label}
                                </span>

                                {/* Confidence badge */}
                                <div style={{
                                  display:      "flex",
                                  alignItems:   "center",
                                  gap:          "4px",
                                  padding:      "2px 6px",
                                  borderRadius: "99px",
                                  background:   `${color}15`,
                                  border:       `1px solid ${color}30`,
                                }}>
                                  <span style={{
                                    fontSize:   "10px",
                                    color:      color,
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                  }}>
                                    {Math.round(box.confidence * 100)}%
                                  </span>
                                </div>

                                {/* Confidence label */}
                                <span style={{
                                  fontSize: "9px",
                                  color:    color,
                                  minWidth: "40px",
                                  textAlign: "right",
                                }}>
                                  {confidenceLabel(box.confidence)}
                                </span>
                              </motion.div>
                            );
                          })}
                        </div>

                        {/* Action buttons */}
                        {selected.size > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ display: "flex", gap: "6px" }}>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{   scale: 0.98 }}
                              onClick={handleApproveSelected}
                              style={{
                                flex:           1,
                                padding:        "9px",
                                borderRadius:   "8px",
                                border:         "1px solid rgba(16,185,129,0.3)",
                                background:     "rgba(16,185,129,0.1)",
                                color:          "var(--success)",
                                fontWeight:     600,
                                fontSize:       "12px",
                                cursor:         "pointer",
                                display:        "flex",
                                alignItems:     "center",
                                justifyContent: "center",
                                gap:            "5px",
                              }}
                              onMouseEnter={e =>
                                (e.currentTarget.style.background =
                                  "rgba(16,185,129,0.18)")}
                              onMouseLeave={e =>
                                (e.currentTarget.style.background =
                                  "rgba(16,185,129,0.1)")}>
                              <CheckCircle size={12} />
                              Add {selected.size} to Canvas
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{   scale: 0.98 }}
                              onClick={handleApproveAll}
                              style={{
                                padding:        "9px 12px",
                                borderRadius:   "8px",
                                border:         "1px solid rgba(139,92,246,0.3)",
                                background:     "rgba(139,92,246,0.1)",
                                color:          "var(--accent)",
                                fontWeight:     600,
                                fontSize:       "12px",
                                cursor:         "pointer",
                                display:        "flex",
                                alignItems:     "center",
                                justifyContent: "center",
                                gap:            "5px",
                                whiteSpace:     "nowrap",
                              }}
                              onMouseEnter={e =>
                                (e.currentTarget.style.background =
                                  "rgba(139,92,246,0.18)")}
                              onMouseLeave={e =>
                                (e.currentTarget.style.background =
                                  "rgba(139,92,246,0.1)")}>
                              All {boxes.length}
                            </motion.button>
                          </motion.div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}