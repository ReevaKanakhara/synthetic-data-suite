"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Trash2, Download,
  PenLine, ImageIcon, RefreshCw, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getGallery, deleteImage } from "@/lib/api";
import { TaskStatusResponse } from "@/types";

const STATUS_CFG: Record<string, {
  color: string; bg: string; border: string;
}> = {
  SUCCESS:    { color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)" },
  PENDING:    { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)" },
  PROCESSING: { color: "#06B6D4", bg: "rgba(6,182,212,0.08)",   border: "rgba(6,182,212,0.2)" },
  FAILURE:    { color: "#f43f5e", bg: "rgba(244,63,94,0.08)",   border: "rgba(244,63,94,0.2)" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <div style={{
      padding: "3px 8px", borderRadius: "5px",
      background: s.bg, border: `1px solid ${s.border}`,
      display: "inline-block",
    }}>
      <span style={{
        fontSize: "10px", color: s.color,
        fontWeight: 700, letterSpacing: "0.06em", fontFamily: "monospace",
      }}>
        {status}
      </span>
    </div>
  );
}

function ImageCard({
  image, index, onDelete,
}: {
  image: TaskStatusResponse;
  index: number;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Permanently delete this image and all its annotations?")) return;
    setDeleting(true);
    try {
      await deleteImage(image.image_id);
      onDelete(image.image_id);
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete image");
      setDeleting(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = `/api/images/${image.image_id}/download`;
    a.download = `synthetic_${image.image_id.slice(0, 8)}.png`;
    a.click();
    toast.success("Download started");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.35,
        delay: index * 0.04,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${hovered
          ? "rgba(139,92,246,0.25)"
          : "var(--border)"}`,
        borderRadius: "14px", overflow: "hidden",
        boxShadow: hovered
          ? "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)"
          : "none",
        transition: "border-color 200ms, box-shadow 200ms",
      }}>

      {/* Thumbnail area */}
      <div style={{
        position: "relative", paddingBottom: "75%",
        background: "var(--bg-elevated)", overflow: "hidden",
      }}>
        {image.image_url && image.status === "SUCCESS" ? (
          <img
            src={image.image_url}
            alt="Generated synthetic image"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%", objectFit: "cover",
              transform: hovered ? "scale(1.05)" : "scale(1)",
              transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column", gap: "8px",
          }}>
            {image.status === "FAILURE"
              ? <AlertCircle size={24} color="var(--error)" />
              : <ImageIcon size={24} color="var(--text-muted)" />}
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {image.status === "FAILURE" ? "Failed" : "Processing..."}
            </span>
          </div>
        )}

        {/* Hover action overlay */}
        <AnimatePresence>
          {hovered && image.status === "SUCCESS" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "absolute", inset: 0,
                background:
                  "linear-gradient(to top, rgba(2,2,5,0.92) 0%, rgba(2,2,5,0.3) 55%, transparent 100%)",
                display: "flex", alignItems: "flex-end",
                padding: "12px", gap: "6px",
              }}>

              {/* Annotate */}
              <motion.button
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/annotate/${image.image_id}`)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: "8px",
                  border: "none", background: "rgba(139,92,246,0.92)",
                  color: "white", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: "5px",
                }}>
                <PenLine size={12} /> Annotate
              </motion.button>

              {/* Download */}
              <motion.button
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
                onClick={handleDownload}
                style={{
                  width: "34px", height: "34px", borderRadius: "8px",
                  border: "none", background: "rgba(6,182,212,0.92)",
                  color: "white", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <Download size={14} />
              </motion.button>

              {/* Delete */}
              <motion.button
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
                onClick={handleDelete} disabled={deleting}
                style={{
                  width: "34px", height: "34px", borderRadius: "8px",
                  border: "none", background: "rgba(244,63,94,0.92)",
                  color: "white", cursor: deleting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: deleting ? 0.6 : 1,
                }}>
                {deleting
                  ? <RefreshCw size={14}
                      style={{ animation: "spin 1s linear infinite" }} />
                  : <Trash2 size={14} />}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status badge — always visible */}
        <div style={{ position: "absolute", top: "8px", right: "8px" }}>
          <StatusBadge status={image.status} />
        </div>
      </div>

      {/* Card footer */}
      <div style={{ padding: "10px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace",
        }}>
          {image.image_id.slice(0, 8)}...
        </span>
        {image.width && (
          <span style={{
            fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace",
          }}>
            {image.width}×{image.height}
          </span>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

const FILTERS = ["ALL", "SUCCESS", "PROCESSING", "PENDING", "FAILURE"] as const;

export default function GalleryPage() {
  const [images, setImages] = useState<TaskStatusResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getGallery(0, 100);
      setImages(data.images);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load gallery",
        { description: "Is the backend running on port 8000?" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (id: string) => {
    setImages(prev => prev.filter(img => img.image_id !== id));
    setTotal(prev => prev - 1);
  };

  const successCount  = images.filter(i => i.status === "SUCCESS").length;
  const failCount     = images.filter(i => i.status === "FAILURE").length;
  const storageEst    = (successCount * 0.2).toFixed(1);

  const filtered = filter === "ALL"
    ? images
    : images.filter(img => img.status === filter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between",
      }}>
        <div>
          <Link href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "12px", color: "var(--text-secondary)",
              textDecoration: "none", marginBottom: "8px",
            }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}>
            <ArrowLeft size={12} /> Dashboard
          </Link>

          <div style={{
            display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px",
          }}>
            <div style={{
              height: "1px", width: "20px",
              background: "linear-gradient(90deg, transparent, var(--accent))",
            }} />
            <span style={{
              fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.12em",
            }}>
              Dataset Vault
            </span>
          </div>

          <h1 style={{
            fontSize: "30px", fontWeight: 700,
            letterSpacing: "-0.04em", color: "var(--text-primary)",
          }}>
            Image{" "}
            <span style={{
              background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Gallery
            </span>
          </h1>
          <p style={{
            fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px",
          }}>
            All generated images — hover for actions, click Annotate to label
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => load(true)} disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            padding: "9px 16px", borderRadius: "9px",
            border: "1px solid var(--border)",
            background: "var(--bg-card)", color: "var(--text-secondary)",
            fontSize: "13px", cursor: "pointer", fontWeight: 500,
          }}>
          <RefreshCw size={13}
            style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </motion.button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: "flex", gap: "1px", borderRadius: "12px",
        overflow: "hidden", border: "1px solid var(--border)",
      }}>
        {[
          { label: "Total Generated", value: String(total),        color: "var(--text-primary)" },
          { label: "Successful",      value: String(successCount), color: "#10b981" },
          { label: "Failed",          value: String(failCount),    color: "#f43f5e" },
          { label: "Est. Storage",    value: `${storageEst} MB`,   color: "var(--text-primary)" },
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
              fontSize: "22px", fontWeight: 700, color: s.color,
              fontFamily: "monospace", letterSpacing: "-0.03em",
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {FILTERS.map(f => {
          const count = f === "ALL"
            ? images.length
            : images.filter(i => i.status === f).length;
          return (
            <motion.button key={f}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px", borderRadius: "7px", border: "none",
                background: filter === f ? "var(--accent)" : "var(--bg-elevated)",
                color: filter === f ? "white" : "var(--text-secondary)",
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                fontFamily: "monospace", letterSpacing: "0.04em",
                transition: "all 150ms",
              }}>
              {f}
              <span style={{ marginLeft: "6px", fontSize: "10px", opacity: 0.7 }}>
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        /* Skeleton grid */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "16px",
        }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              borderRadius: "14px", overflow: "hidden",
              background: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              <div style={{ paddingBottom: "75%", position: "relative" }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background:
                    "linear-gradient(90deg, #0A0A0F 25%, #16161E 50%, #0A0A0F 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s ease-in-out infinite",
                }} />
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{
                  height: "10px", borderRadius: "4px",
                  width: "60%", background: "var(--bg-elevated)",
                }} />
              </div>
            </div>
          ))}
          <style>{`
            @keyframes shimmer {
              0%  { background-position: 200% 0; }
              100%{ background-position: -200% 0; }
            }
          `}</style>
        </div>

      ) : filtered.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            textAlign: "center", padding: "80px 24px",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "16px",
          }}>
          <ImageIcon size={32} color="var(--text-muted)"
            style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{
            fontSize: "15px", fontWeight: 600, color: "var(--text-primary)",
          }}>
            {filter === "ALL" ? "No images yet" : `No ${filter} images`}
          </p>
          <p style={{
            fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px",
          }}>
            {filter === "ALL"
              ? "Go to the dashboard and generate your first image"
              : "Try selecting a different filter"}
          </p>
          {filter === "ALL" && (
            <Link href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                marginTop: "16px", padding: "9px 20px", borderRadius: "9px",
                background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                color: "white", textDecoration: "none",
                fontSize: "13px", fontWeight: 600,
              }}>
              Generate First Image →
            </Link>
          )}
        </motion.div>

      ) : (
        /* Image grid */
        <motion.div layout style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "16px",
        }}>
          <AnimatePresence>
            {filtered.map((image, i) => (
              <ImageCard
                key={image.image_id}
                image={image}
                index={i}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}