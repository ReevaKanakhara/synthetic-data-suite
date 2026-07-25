"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { getTaskStatus } from "@/lib/api";
import { TaskStatusResponse } from "@/types";

interface Props { taskId: string; imageId: string; }

function LaserShimmer() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{
        position: "relative", width: "100%", height: "200px",
        borderRadius: "10px", overflow: "hidden",
        background: "linear-gradient(135deg, #0D0D14 0%, #16161E 100%)",
        border: "1px solid var(--border)",
      }}>
        {[0, 55, 110].map((top, i) => (
          <div key={i} style={{
            position: "absolute", left: "12px", right: "12px",
            top: `${30 + top}px`, height: "12px", borderRadius: "4px",
            background:
              "linear-gradient(90deg, #16161E 25%, #1e1e2e 50%, #16161E 75%)",
            backgroundSize: "200% 100%",
            animation: `shimmer 2s ease-in-out infinite ${i * 0.2}s`,
            opacity: 1 - i * 0.2,
          }} />
        ))}

        {/* Laser scan line */}
        <div style={{
          position: "absolute", left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, transparent, #06B6D4, transparent)",
          boxShadow: "0 0 16px rgba(6,182,212,0.9), 0 0 32px rgba(6,182,212,0.4)",
          animation: "laserscan 2s ease-in-out infinite",
        }} />

        <div style={{
          position: "absolute", bottom: "12px", right: "12px",
          fontSize: "10px", fontFamily: "monospace",
          color: "rgba(6,182,212,0.7)", letterSpacing: "0.08em",
        }}>
          GPU PROCESSING
        </div>

        <style>{`
          @keyframes shimmer {
            0%  { background-position: 200% 0; }
            100%{ background-position: -200% 0; }
          }
          @keyframes laserscan {
            0%  { top: 0%;   opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100%{ top: 100%; opacity: 0; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>

      {["60%", "40%"].map((w, i) => (
        <div key={i} style={{
          height: "11px", borderRadius: "4px", width: w,
          background:
            "linear-gradient(90deg, #16161E 25%, #1e1e2e 50%, #16161E 75%)",
          backgroundSize: "200% 100%",
          animation: `shimmer 2s ease-in-out infinite ${i * 0.15}s`,
        }} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; border: string }> = {
    PENDING:    { color: "var(--warning)",  bg: "var(--warning-bg)",     border: "var(--warning-border)" },
    PROCESSING: { color: "var(--accent-2)", bg: "rgba(6,182,212,0.08)",  border: "rgba(6,182,212,0.2)" },
    SUCCESS:    { color: "var(--success)",  bg: "var(--success-bg)",     border: "var(--success-border)" },
    FAILURE:    { color: "var(--error)",    bg: "var(--error-bg)",       border: "var(--error-border)" },
  };
  const s = cfg[status] ?? cfg.PENDING;
  return (
    <div style={{
      padding: "4px 10px", borderRadius: "6px",
      background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <span style={{
        fontSize: "11px", color: s.color, fontWeight: 600,
        letterSpacing: "0.05em", fontFamily: "monospace",
      }}>
        {status}
      </span>
    </div>
  );
}

export default function TaskPoller({ taskId, imageId }: Props) {
  const [status, setStatus] = useState<TaskStatusResponse | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!taskId) return;
    const poll = async () => {
      try {
        const data = await getTaskStatus(taskId);
        setStatus(data);
        if (data.status === "SUCCESS" || data.status === "FAILURE") {
          clearInterval(iv);
        }
      } catch {
        clearInterval(iv);
      }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [taskId]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `/api/images/${imageId}/download`;
    a.download = `synthetic_${imageId.slice(0, 8)}.png`;
    a.click();
    toast.success("Downloading image...");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "16px", padding: "24px",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        display: "flex", flexDirection: "column", gap: "20px",
      }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "var(--accent-2)", boxShadow: "0 0 8px var(--accent-2)",
            }} />
            <span style={{
              fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>
              Live Feed
            </span>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.03em" }}>
            Generation Status
          </h2>
        </div>
        {status && <StatusBadge status={status.status} />}
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        {!status ||
         status.status === "PENDING" ||
         status.status === "PROCESSING" ? (
          <motion.div key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LaserShimmer />
            <p style={{
              fontSize: "12px", color: "var(--text-secondary)",
              marginTop: "10px", textAlign: "center", fontFamily: "monospace",
            }}>
              {!status
                ? "// connecting to pipeline..."
                : status.status === "PENDING"
                ? "// task queued — awaiting worker..."
                : "// running diffusion inference..."}
            </p>
          </motion.div>

        ) : status.status === "SUCCESS" && status.image_url ? (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* Image preview */}
            <div style={{
              position: "relative", borderRadius: "10px", overflow: "hidden",
              border: "1px solid rgba(139,92,246,0.2)",
              boxShadow: "0 0 30px rgba(139,92,246,0.12)",
            }}>
              <img src={status.image_url} alt="Generated"
                style={{
                  width: "100%", display: "block",
                  maxHeight: "260px", objectFit: "cover",
                }} />
              <div style={{
                position: "absolute", bottom: "8px", left: "8px",
                padding: "3px 8px", borderRadius: "5px",
                fontSize: "10px", fontWeight: 600,
                background: "rgba(0,0,0,0.8)",
                color: "rgba(255,255,255,0.8)",
                backdropFilter: "blur(4px)", fontFamily: "monospace",
              }}>
                {status.width}×{status.height}px
              </div>
              <div style={{ position: "absolute", top: "8px", right: "8px" }}>
                <CheckCircle size={16} color="var(--success)" />
              </div>
            </div>

            {/* Download button */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleDownload}
              style={{
                width: "100%", padding: "10px", borderRadius: "10px",
                border: "1px solid rgba(6,182,212,0.25)",
                background: "rgba(6,182,212,0.08)", color: "var(--accent-2)",
                fontWeight: 600, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px",
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = "rgba(6,182,212,0.15)")}
              onMouseLeave={e =>
                (e.currentTarget.style.background = "rgba(6,182,212,0.08)")}>
              <Download size={13} /> Download Image
            </motion.button>

            {/* Annotate button */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/annotate/${imageId}`)}
              style={{
                width: "100%", padding: "12px", borderRadius: "10px",
                border: "1px solid rgba(16,185,129,0.25)",
                background: "rgba(16,185,129,0.08)", color: "var(--success)",
                fontWeight: 600, fontSize: "14px", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px",
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = "rgba(16,185,129,0.15)")}
              onMouseLeave={e =>
                (e.currentTarget.style.background = "rgba(16,185,129,0.08)")}>
              Open Annotation Studio <ArrowRight size={14} />
            </motion.button>
          </motion.div>

        ) : (
          <motion.div key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              padding: "16px", borderRadius: "10px",
              background: "var(--error-bg)",
              border: "1px solid var(--error-border)",
              display: "flex", gap: "10px", alignItems: "flex-start",
            }}>
            <XCircle size={16} color="var(--error)"
              style={{ flexShrink: 0, marginTop: "1px" }} />
            <div>
              <p style={{ fontSize: "13px", color: "var(--error)", fontWeight: 600 }}>
                Generation failed
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {status?.error_message ?? "Unknown error"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}