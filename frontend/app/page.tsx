"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GenerateForm, { GenerateFormHandle } from "@/components/GenerateForm";
import TaskPoller from "@/components/TaskPoller";
import BatchProgress from "@/components/BatchProgress";
import EmptyState from "@/components/EmptyState";
import { GenerateResponse } from "@/types";
import { generateImage } from "@/lib/api";
import { useBatchSession } from "@/hooks/useBatchSession";
import { toast } from "sonner";

interface BatchTask {
  task_id:  string;
  image_id: string;
}

type RightPanel =
  | { type: "empty" }
  | { type: "single"; task: GenerateResponse }
  | { type: "batch";  tasks: BatchTask[]; prompt: string };

export default function Home() {
  const [panel,       setPanel]       = useState<RightPanel>({ type: "empty" });
  const [chipLoading, setChipLoading] = useState(false);
  const formRef = useRef<GenerateFormHandle>(null);

  // Batch session persistence
  const { session, hydrated, saveSession, clearSession } = useBatchSession();

  // On mount — restore any active batch session from localStorage
  useEffect(() => {
    if (!hydrated) return;
    if (session && panel.type === "empty") {
      setPanel({
        type:   "batch",
        tasks:  session.tasks,
        prompt: session.prompt,
      });
      toast.info("Restored active batch session", {
        description: `${session.tasks.length} tasks re-hooked from background.`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const handleSingleCreated = (data: GenerateResponse) => {
    clearSession();   // clear any stale batch session
    setPanel({ type: "single", task: data });
  };

  const handleBatchCreated = (tasks: BatchTask[], prompt: string) => {
    saveSession(tasks, prompt);
    setPanel({ type: "batch", tasks, prompt });
  };

  const handleBatchComplete = (successCount: number) => {
    clearSession();   // batch done — remove from localStorage
  };

  const handleChipSelect = async (prompt: string) => {
    if (chipLoading) return;
    setChipLoading(true);
    formRef.current?.setPrompt(prompt);
    try {
      const data = await generateImage(prompt);
      clearSession();
      setPanel({ type: "single", task: data });
      toast.success("Generation queued", {
        description: "Chip prompt sent to pipeline.",
      });
    } catch {
      toast.error("Service unavailable", {
        description: "Is the backend running on port 8000?",
      });
    } finally {
      setChipLoading(false);
    }
  };

  // Don't render until localStorage hydration is done
  // prevents flash of empty state before session restore
  if (!hydrated) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px",
        }}>
          <div style={{
            height: "1px", width: "20px",
            background: "linear-gradient(90deg, transparent, var(--accent))",
          }} />
          <span style={{
            fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.12em",
          }}>
            AI Research Platform
          </span>
        </div>
        <h1 style={{
          fontSize: "34px", fontWeight: 700,
          letterSpacing: "-0.04em", color: "var(--text-primary)", lineHeight: 1.15,
        }}>
          Synthetic Data{" "}
          <span style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Generator
          </span>
        </h1>
        <p style={{
          fontSize: "14px", color: "var(--text-secondary)",
          marginTop: "8px", maxWidth: "460px", lineHeight: 1.6,
        }}>
          Generate AI images and annotate them with precision bounding
          boxes for CV training datasets.
        </p>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: "flex", gap: "1px", borderRadius: "12px",
          overflow: "hidden", border: "1px solid var(--border)",
        }}>
        {[
          { label: "Model",     value: "SD v1.5" },
          { label: "Resolution",value: "512 × 512" },
          { label: "Format",    value: "COCO JSON" },
          { label: "Batch Max", value: "20 images" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: "12px 16px", background: "var(--bg-card)",
            borderRight: i < 3 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{
              fontSize: "10px", color: "#6b6b8a", marginBottom: "4px",
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: "13px", fontWeight: 600,
              color: "#F1F0FF", fontFamily: "monospace",
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Main grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: "16px", alignItems: "start",
        }}>

        {/* Left — form */}
        <div style={{ position: "relative" }}>
          <GenerateForm
            ref={formRef}
            onTaskCreated={handleSingleCreated}
            onBatchCreated={handleBatchCreated}
            disabled={chipLoading}
          />

          {chipLoading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                position: "absolute", inset: 0, borderRadius: "16px",
                background: "rgba(2,2,5,0.6)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                display: "flex", alignItems: "center",
                justifyContent: "center", flexDirection: "column",
                gap: "10px", zIndex: 10,
              }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                style={{ animation: "spin 0.8s linear infinite" }}>
                <circle cx="10" cy="10" r="8"
                  stroke="rgba(139,92,246,0.3)" strokeWidth="2" />
                <path d="M10 2A8 8 0 0118 10"
                  stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span style={{
                fontSize: "12px", color: "var(--accent)",
                fontFamily: "monospace", fontWeight: 600,
              }}>
                // queuing from chip...
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </motion.div>
          )}
        </div>

        {/* Right — dynamic panel */}
        <AnimatePresence mode="wait">
          {panel.type === "empty" && (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}>
              <EmptyState
                onSelect={handleChipSelect}
                chipLoading={chipLoading}
              />
            </motion.div>
          )}

          {panel.type === "single" && (
            <motion.div key="single"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}>
              <TaskPoller
                taskId={panel.task.task_id}
                imageId={panel.task.image_id}
              />
            </motion.div>
          )}

          {panel.type === "batch" && (
            <motion.div key="batch"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}>
              <BatchProgress
                tasks={panel.tasks}
                prompt={panel.prompt}
                onComplete={handleBatchComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}