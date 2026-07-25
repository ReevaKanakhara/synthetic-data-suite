"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, Clock,
  Loader, Download, Images, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { getTaskStatus, buildAndDownloadZip, ZipExportItem } from "@/lib/api";
import { TaskStatusResponse, BoundingBox } from "@/types";

interface BatchTask {
  task_id:  string;
  image_id: string;
}

interface Props {
  tasks:       BatchTask[];
  prompt:      string;
  onComplete?: (successCount: number) => void;
}

interface TaskState extends TaskStatusResponse {}

// ---------------------------------------------------------------------------
// Mini step progress bar shown inside each cell during PROCESSING
// ---------------------------------------------------------------------------
function StepBar({
  current, total,
}: {
  current: number | null;
  total:   number | null;
}) {
  if (!current || !total) return null;
  const pct = Math.round((current / total) * 100);
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: "3px",
      background: "rgba(0,0,0,0.5)",
    }}>
      <motion.div
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          height: "100%",
          background: "linear-gradient(90deg, #8B5CF6, #06B6D4)",
          boxShadow: "0 0 4px rgba(139,92,246,0.8)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single task cell
// ---------------------------------------------------------------------------
function TaskCell({
  state, index, onClick,
}: {
  state:   TaskState;
  index:   number;
  onClick: () => void;
}) {
  const isProcessing = state.status === "PROCESSING";
  const isSuccess    = state.status === "SUCCESS";
  const isFailure    = state.status === "FAILURE";
  const isPending    = state.status === "PENDING";

  const borderColor = isSuccess    ? "rgba(16,185,129,0.4)"
                    : isFailure    ? "rgba(244,63,94,0.4)"
                    : isProcessing ? "rgba(6,182,212,0.4)"
                    : "rgba(255,255,255,0.07)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={isSuccess ? onClick : undefined}
      title={`Image ${index + 1} — ${state.status}${
        isProcessing && state.current_step && state.total_steps
          ? ` (${state.current_step}/${state.total_steps} steps)`
          : ""
      }`}
      style={{
        width: "44px", height: "44px", borderRadius: "8px",
        border: `1px solid ${borderColor}`,
        background: isSuccess && state.image_url
          ? "transparent"
          : "var(--bg-elevated)",
        overflow: "hidden", position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: isSuccess ? "pointer" : "default",
        boxShadow: isSuccess
          ? "0 0 8px rgba(16,185,129,0.2)"
          : isProcessing
          ? "0 0 8px rgba(6,182,212,0.15)"
          : "none",
        transition: "border-color 300ms, box-shadow 300ms",
      }}>

      {/* Thumbnail or icon */}
      {isSuccess && state.image_url ? (
        <img src={state.image_url} alt={`img ${index + 1}`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : isPending ? (
        <Clock size={12} color="#f59e0b" />
      ) : isProcessing ? (
        <Loader size={12} color="#06B6D4"
          style={{ animation: "spin 1s linear infinite" }} />
      ) : isFailure ? (
        <XCircle size={12} color="#f43f5e" />
      ) : null}

      {/* Step progress bar — shown during PROCESSING */}
      {isProcessing && (
        <StepBar
          current={state.current_step}
          total={state.total_steps}
        />
      )}

      {/* Step counter overlay — shown during PROCESSING */}
      {isProcessing && state.current_step && state.total_steps && (
        <div style={{
          position: "absolute", top: "1px", left: "0", right: "0",
          textAlign: "center",
          fontSize: "7px", color: "rgba(6,182,212,0.9)",
          fontFamily: "monospace", fontWeight: 700,
          lineHeight: 1,
          textShadow: "0 0 4px rgba(0,0,0,0.8)",
        }}>
          {state.current_step}/{state.total_steps}
        </div>
      )}

      {/* Index */}
      <div style={{
        position: "absolute", bottom: "1px", right: "2px",
        fontSize: "7px", color: "rgba(255,255,255,0.4)",
        fontFamily: "monospace", fontWeight: 700,
        pointerEvents: "none",
      }}>
        {index + 1}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function BatchProgress({ tasks, prompt, onComplete }: Props) {
  const router = useRouter();

  const [states, setStates] = useState<TaskState[]>(
    tasks.map(t => ({
      task_id:      t.task_id,
      image_id:     t.image_id,
      status:       "PENDING",
      image_url:    null,
      width:        null,
      height:       null,
      current_step: null,
      total_steps:  null,
      error_message: null,
    }))
  );
  const [done,    setDone]    = useState(false);
  const [zipping, setZipping] = useState(false);

  const successCount = states.filter(s => s.status === "SUCCESS").length;
  const failCount    = states.filter(s => s.status === "FAILURE").length;
  const totalDone    = successCount + failCount;
  const progress     = Math.round((totalDone / tasks.length) * 100);
  const allDone      = totalDone === tasks.length;

  // Poll all tasks every 1.5s
  useEffect(() => {
    if (done) return;

    const poll = async () => {
      const updates = await Promise.allSettled(
        tasks.map(t => getTaskStatus(t.task_id))
      );
      setStates(prev =>
        prev.map((s, i) => {
          const r = updates[i];
          return r.status === "fulfilled" ? { ...s, ...r.value } : s;
        })
      );
    };

    poll();
    const iv = setInterval(poll, 1500);
    return () => clearInterval(iv);
  }, [tasks, done]);

  // Detect completion
  useEffect(() => {
    if (allDone && !done) {
      setDone(true);
      onComplete?.(successCount);
      if (successCount > 0) {
        toast.success("Batch complete!", {
          description: `${successCount} image${successCount > 1 ? "s" : ""} generated.`,
        });
      }
    }
  }, [allDone, done, successCount, onComplete]);

  const handleZipExport = async () => {
    const successes = states.filter(
      s => s.status === "SUCCESS" && s.image_url
    );
    if (!successes.length) {
      toast.error("No successful images to export");
      return;
    }
    setZipping(true);
    try {
      const items: ZipExportItem[] = successes.map(s => ({
        imageId:     s.image_id,
        imageUrl:    s.image_url!,
        annotations: [] as BoundingBox[],
        width:       s.width  ?? 512,
        height:      s.height ?? 512,
      }));
      await buildAndDownloadZip(items, prompt);
      toast.success("Dataset downloaded!", {
        description: `${items.length} images + COCO JSON in ZIP.`,
      });
    } catch {
      toast.error("ZIP export failed");
    } finally {
      setZipping(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "16px", padding: "24px",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex", flexDirection: "column", gap: "20px",
      }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px",
          }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: allDone ? "#10b981" : "#06B6D4",
              boxShadow: `0 0 8px ${allDone ? "#10b981" : "#06B6D4"}`,
              animation: !allDone ? "blink 1.2s ease-in-out infinite" : "none",
            }} />
            <span style={{
              fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>
              {allDone ? "Batch Complete" : "Batch Processing"}
            </span>
            <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
          </div>
          <h2 style={{
            fontSize: "18px", fontWeight: 600, letterSpacing: "-0.03em",
          }}>
            {totalDone} / {tasks.length} Generated
          </h2>
        </div>

        <div style={{
          padding: "4px 10px", borderRadius: "6px",
          background: "rgba(139,92,246,0.1)",
          border: "1px solid rgba(139,92,246,0.2)",
        }}>
          <span style={{
            fontSize: "11px", color: "var(--accent)",
            fontWeight: 700, fontFamily: "monospace",
          }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{
        width: "100%", height: "6px", borderRadius: "99px",
        background: "var(--bg-elevated)", overflow: "hidden",
      }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            height: "100%", borderRadius: "99px",
            background: allDone
              ? "linear-gradient(90deg, #10b981, #06B6D4)"
              : "linear-gradient(90deg, #8B5CF6, #06B6D4)",
            boxShadow: "0 0 8px rgba(139,92,246,0.5)",
          }}
        />
      </div>

      {/* Mini stats */}
      <div style={{ display: "flex", gap: "8px" }}>
        {[
          { label: "Queued",    value: tasks.length,          color: "var(--text-secondary)" },
          { label: "Done",      value: successCount,          color: "#10b981" },
          { label: "Failed",    value: failCount,             color: "#f43f5e" },
          { label: "Remaining", value: tasks.length-totalDone, color: "#06B6D4" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: "8px 10px", borderRadius: "8px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)", textAlign: "center",
          }}>
            <div style={{
              fontSize: "16px", fontWeight: 700,
              color: s.color, fontFamily: "monospace",
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize: "10px", color: "var(--text-muted)", marginTop: "2px",
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Task grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
        gap: "6px",
      }}>
        {states.map((s, i) => (
          <TaskCell
            key={s.task_id}
            state={s}
            index={i}
            onClick={() => router.push(`/annotate/${s.image_id}`)}
          />
        ))}
      </div>

      {/* Prompt label */}
      <div style={{
        padding: "8px 12px", borderRadius: "8px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
      }}>
        <span style={{
          fontSize: "10px", color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
        }}>
          Prompt
        </span>
        <p style={{
          fontSize: "12px", color: "var(--text-secondary)",
          marginTop: "2px", fontFamily: "monospace", lineHeight: 1.5,
        }}>
          "{prompt.slice(0, 80)}{prompt.length > 80 ? "..." : ""}"
        </p>
      </div>

      {/* Actions — visible when batch is done */}
      <AnimatePresence>
        {allDone && successCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleZipExport}
              disabled={zipping}
              style={{
                width: "100%", padding: "12px", borderRadius: "10px",
                border: "none",
                background: zipping
                  ? "linear-gradient(135deg, #4c1d95, #164e63)"
                  : "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                color: "white", fontWeight: 600, fontSize: "14px",
                cursor: zipping ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px",
                boxShadow: zipping ? "none" : "0 0 24px rgba(139,92,246,0.35)",
              }}>
              {zipping ? (
                <><Loader size={14}
                  style={{ animation: "spin 0.8s linear infinite" }} />
                  Building ZIP...</>
              ) : (
                <><Download size={14} />
                  Export Dataset ZIP ({successCount} images)</>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/gallery")}
              style={{
                width: "100%", padding: "10px", borderRadius: "10px",
                border: "1px solid rgba(139,92,246,0.25)",
                background: "rgba(139,92,246,0.08)",
                color: "var(--accent)", fontWeight: 600,
                fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px",
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = "rgba(139,92,246,0.15)")}
              onMouseLeave={e =>
                (e.currentTarget.style.background = "rgba(139,92,246,0.08)")}>
              <Images size={13} /> View in Gallery <ArrowRight size={13} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}