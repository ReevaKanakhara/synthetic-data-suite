"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Download, ChevronDown, FileJson,
  FileText, FileCode, Table,
} from "lucide-react";
import { BoundingBox } from "@/types";
import {
  ExportFormat,
  ExportImageData,
  downloadSingleImageExport,
} from "@/lib/exportFormats";

interface Props {
  imageId:     string;
  imageUrl:    string;
  imageWidth:  number;
  imageHeight: number;
  boxes:       BoundingBox[];
}

const FORMATS: {
  id:      ExportFormat;
  label:   string;
  desc:    string;
  icon:    React.ElementType;
  color:   string;
}[] = [
  {
    id:    "coco",
    label: "COCO JSON",
    desc:  "PyTorch · Detectron2 · MMDetection",
    icon:  FileJson,
    color: "#f59e0b",
  },
  {
    id:    "yolo",
    label: "YOLO .txt",
    desc:  "Ultralytics YOLOv8 · YOLO formats",
    icon:  FileText,
    color: "#8B5CF6",
  },
  {
    id:    "voc",
    label: "Pascal VOC",
    desc:  "TensorFlow OD API · OpenCV",
    icon:  FileCode,
    color: "#06B6D4",
  },
  {
    id:    "csv",
    label: "CSV",
    desc:  "Excel · Pandas · Data analysis",
    icon:  Table,
    color: "#10b981",
  },
];

export default function ExportButton({
  imageId, imageUrl, imageWidth, imageHeight, boxes,
}: Props) {
  const [format,    setFormat]    = useState<ExportFormat>("coco");
  const [open,      setOpen]      = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported,  setExported]  = useState(false);

  const selectedFmt = FORMATS.find(f => f.id === format)!;

  const handleExport = async () => {
    if (boxes.length === 0) {
      toast.error("No annotations", {
        description: "Draw or auto-label at least one bounding box first.",
      });
      return;
    }

    setExporting(true);
    try {
      const imgData: ExportImageData = {
        imageId,
        fileName:    `${imageId.slice(0, 8)}.png`,
        imageUrl,
        width:       imageWidth,
        height:      imageHeight,
        annotations: boxes,
      };
      await downloadSingleImageExport(imgData, format);
      setExported(true);
      toast.success(`Exported as ${selectedFmt.label}`, {
        description: `${boxes.length} annotation${boxes.length > 1 ? "s" : ""} saved.`,
      });
      setTimeout(() => setExported(false), 3000);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>

      {/* Format selector */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(p => !p)}
          style={{
            width:          "100%",
            padding:        "8px 12px",
            borderRadius:   "8px",
            border:         `1px solid ${open
              ? "rgba(139,92,246,0.4)"
              : "var(--border)"}`,
            background:     "var(--bg-elevated)",
            color:          "var(--text-primary)",
            display:        "flex",
            alignItems:     "center",
            gap:            "8px",
            cursor:         "pointer",
            transition:     "border-color 150ms",
          }}>
          <selectedFmt.icon
            size={13}
            color={selectedFmt.color}
          />
          <span style={{ fontSize: "12px", fontWeight: 600, flex: 1, textAlign: "left" }}>
            {selectedFmt.label}
          </span>
          <span style={{
            fontSize: "10px",
            color:    "var(--text-muted)",
            flex:     1,
            textAlign: "left",
          }}>
            {selectedFmt.desc}
          </span>
          <ChevronDown
            size={12}
            color="var(--text-muted)"
            style={{
              transform:  open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms",
            }}
          />
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{    opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                position:    "absolute",
                top:         "calc(100% + 4px)",
                left:        0,
                right:       0,
                zIndex:      50,
                background:  "var(--bg-elevated)",
                border:      "1px solid var(--border-hover)",
                borderRadius: "10px",
                overflow:    "hidden",
                boxShadow:   "0 8px 24px rgba(0,0,0,0.5)",
              }}>
              {FORMATS.map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => { setFormat(fmt.id); setOpen(false); setExported(false); }}
                  style={{
                    width:       "100%",
                    padding:     "10px 12px",
                    display:     "flex",
                    alignItems:  "center",
                    gap:         "10px",
                    background:  fmt.id === format
                      ? "rgba(139,92,246,0.1)"
                      : "transparent",
                    border:      "none",
                    cursor:      "pointer",
                    borderBottom: "1px solid var(--border)",
                    transition:  "background 100ms",
                  }}
                  onMouseEnter={e =>
                    (e.currentTarget.style.background =
                      fmt.id === format
                        ? "rgba(139,92,246,0.15)"
                        : "rgba(255,255,255,0.03)")}
                  onMouseLeave={e =>
                    (e.currentTarget.style.background =
                      fmt.id === format
                        ? "rgba(139,92,246,0.1)"
                        : "transparent")}>
                  <div style={{
                    width:        "26px",
                    height:       "26px",
                    borderRadius: "6px",
                    background:   `${fmt.color}18`,
                    border:       `1px solid ${fmt.color}30`,
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent: "center",
                    flexShrink:   0,
                  }}>
                    <fmt.icon size={12} color={fmt.color} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{
                      fontSize:   "12px",
                      fontWeight: 600,
                      color:      fmt.id === format
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    }}>
                      {fmt.label}
                    </div>
                    <div style={{
                      fontSize: "10px",
                      color:    "var(--text-muted)",
                      marginTop: "1px",
                    }}>
                      {fmt.desc}
                    </div>
                  </div>
                  {fmt.id === format && (
                    <div style={{
                      marginLeft:   "auto",
                      width:        "6px",
                      height:       "6px",
                      borderRadius: "50%",
                      background:   "var(--accent)",
                    }} />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Export button */}
      <motion.button
        whileHover={{ scale: boxes.length > 0 && !exporting ? 1.02 : 1 }}
        whileTap={{   scale: boxes.length > 0 && !exporting ? 0.98 : 1 }}
        onClick={handleExport}
        disabled={exporting || boxes.length === 0}
        style={{
          width:          "100%",
          padding:        "11px 16px",
          borderRadius:   "10px",
          border:         exported
            ? "1px solid var(--success-border)"
            : "none",
          background:     exported
            ? "var(--success-bg)"
            : boxes.length > 0
            ? `linear-gradient(135deg, ${selectedFmt.color}, #6366f1)`
            : "var(--bg-elevated)",
          color:          exported
            ? "var(--success)"
            : boxes.length > 0
            ? "white"
            : "var(--text-muted)",
          fontWeight:     600,
          fontSize:       "13px",
          cursor:         boxes.length > 0 && !exporting
            ? "pointer"
            : "not-allowed",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "7px",
          transition:     "all 200ms",
          boxShadow:      boxes.length > 0 && !exported && !exporting
            ? `0 0 20px ${selectedFmt.color}30`
            : "none",
        }}>
        {exporting ? (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
              style={{ animation: "spin 0.8s linear infinite" }}>
              <circle cx="6.5" cy="6.5" r="5"
                stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <path d="M6.5 1.5A5 5 0 0111.5 6.5"
                stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Exporting...
          </>
        ) : exported ? (
          "✓ Exported successfully"
        ) : (
          <>
            <Download size={13} />
            Export {selectedFmt.label}
            {boxes.length > 0 && (
              <span style={{
                fontSize:     "10px",
                opacity:      0.8,
                background:   "rgba(255,255,255,0.15)",
                padding:      "1px 6px",
                borderRadius: "99px",
              }}>
                {boxes.length}
              </span>
            )}
          </>
        )}
      </motion.button>

      {/* Format hint */}
      {boxes.length > 0 && !exported && (
        <p style={{
          fontSize:  "10px",
          color:     "var(--text-muted)",
          textAlign: "center",
          lineHeight: 1.4,
        }}>
          {selectedFmt.desc}
        </p>
      )}
    </div>
  );
}