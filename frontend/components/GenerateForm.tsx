"use client";
import { useState, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Zap, X, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { generateImage, generateBatch } from "@/lib/api";
import { GenerateResponse } from "@/types";

interface Props {
  onTaskCreated:  (data: GenerateResponse) => void;
  onBatchCreated?: (tasks: { task_id: string; image_id: string }[], prompt: string) => void;
  disabled?: boolean;
}

export interface GenerateFormHandle {
  setPrompt: (v: string) => void;
  submit:    () => void;
}

const MAX_CHARS = 400;

function isGibberish(text: string): boolean {
  if (text.trim().split(/\s+/).length >= 2) return false;
  const cleaned = text.toLowerCase().replace(/\s+/g, "");
  if (cleaned.length < 8) return false;
  const unique = new Set(cleaned.split("")).size;
  return unique / cleaned.length < 0.25;
}

const QUALITY_PRESETS = [
  { label: "Photorealistic",  suffix: "photorealistic, studio lighting, sharp focus, 8k" },
  { label: "Cinematic",       suffix: "cinematic, dramatic lighting, film grain, anamorphic" },
  { label: "Product Shot",    suffix: "product photography, white background, commercial, clean" },
  { label: "Satellite View",  suffix: "satellite imagery, top-down, aerial view, high resolution" },
  { label: "Medical X-Ray",   suffix: "medical imaging, x-ray style, grayscale, clinical" },
];

const GenerateForm = forwardRef<GenerateFormHandle, Props>(
  ({ onTaskCreated, onBatchCreated, disabled = false }, ref) => {
    const [prompt,          setPromptState]    = useState("");
    const [negativePrompt,  setNegativePrompt] = useState("");
    const [loading,         setLoading]        = useState(false);
    const [focused,         setFocused]        = useState(false);
    const [quantity,        setQuantity]       = useState(1);
    const [showAdvanced,    setShowAdvanced]   = useState(false);
    const [selectedPreset,  setSelectedPreset] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      setPrompt: (v: string) => setPromptState(v),
      submit:    () => doSubmit(prompt),
    }));

    const applyPreset = (preset: typeof QUALITY_PRESETS[0]) => {
      setSelectedPreset(preset.label);
      // Append or replace suffix
      const base = prompt
        .replace(/,\s*(photorealistic|cinematic|product photography|satellite|medical imaging)[^,]*/gi, "")
        .trim()
        .replace(/,$/, "")
        .trim();
      setPromptState(base ? `${base}, ${preset.suffix}` : preset.suffix);
    };

    async function doSubmit(p: string) {
      if (!p.trim() || loading || disabled) return;
      if (isGibberish(p.trim())) {
        toast.warning("Gibberish detected", {
          description: "Try a real descriptive prompt!",
        });
        return;
      }
      setLoading(true);
      try {
        if (quantity === 1) {
          const data = await generateImage(p.trim());
          onTaskCreated(data);
          toast.success("Generation queued", {
            description: "Your image is being processed.",
          });
        } else {
          const data = await generateBatch(p.trim(), quantity);
          onBatchCreated?.(data.tasks, p.trim());
          toast.success(`Batch of ${quantity} queued`, {
            description: "Watch them generate in real-time.",
          });
        }
      } catch {
        toast.error("Service unavailable", {
          description: "Check that the backend is running on port 8000.",
        });
      } finally {
        setLoading(false);
      }
    }

    const charPct    = (prompt.length / MAX_CHARS) * 100;
    const charColor  = charPct > 90 ? "var(--error)"
                     : charPct > 70 ? "var(--warning)"
                     : "#4a4a6a";
    const isBatch    = quantity > 1;
    const isDisabled = loading || !prompt.trim() || disabled;

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background:          "var(--bg-card)",
          border:              "1px solid var(--border)",
          borderRadius:        "16px",
          padding:             "24px",
          backdropFilter:      "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          display:             "flex",
          flexDirection:       "column",
          gap:                 "20px",
        }}>

        {/* Header */}
        <div>
          <div style={{
            display: "flex", alignItems: "center",
            gap: "8px", marginBottom: "4px",
          }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent)",
            }} />
            <span style={{
              fontSize: "10px", color: "var(--text-secondary)",
              fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}>
              Prompt Workspace
            </span>
          </div>
          <h2 style={{
            fontSize: "18px", fontWeight: 600,
            letterSpacing: "-0.03em", color: "var(--text-primary)",
          }}>
            {isBatch ? `Batch Generate — ${quantity} Images` : "Generate Image"}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {isBatch
              ? `Will fire ${quantity} tasks simultaneously`
              : "Describe the synthetic image for your training dataset"}
          </p>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); doSubmit(prompt); }}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Style presets */}
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
            {QUALITY_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                style={{
                  padding:      "4px 10px",
                  borderRadius: "99px",
                  border:       `1px solid ${selectedPreset === preset.label
                    ? "var(--accent)"
                    : "var(--border)"}`,
                  background: selectedPreset === preset.label
                    ? "rgba(139,92,246,0.15)"
                    : "var(--bg-elevated)",
                  color: selectedPreset === preset.label
                    ? "var(--accent)"
                    : "var(--text-muted)",
                  fontSize:   "10px",
                  fontWeight: 600,
                  cursor:     "pointer",
                  transition: "all 150ms",
                }}>
                {preset.label}
              </button>
            ))}
          </div>

          {/* Prompt textarea */}
          <div style={{ position: "relative" }}>
            <textarea
              value={prompt}
              onChange={e => {
                setPromptState(e.target.value.slice(0, MAX_CHARS));
                setSelectedPreset(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={()  => setFocused(false)}
              disabled={disabled}
              placeholder="a red apple on a wooden table..."
              rows={4}
              style={{
                width:       "100%",
                padding:     "14px 16px 34px",
                borderRadius: "10px",
                background:  "var(--bg-input)",
                border:      `1px solid ${focused
                  ? "var(--border-active)"
                  : "var(--border)"}`,
                color:       "var(--text-primary)",
                fontSize:    "13px",
                resize:      "none",
                fontFamily:  "'JetBrains Mono', monospace",
                lineHeight:  "1.7",
                boxShadow:   focused
                  ? "0 0 0 3px rgba(139,92,246,0.12)"
                  : "none",
                transition:  "border-color 200ms, box-shadow 200ms",
                opacity:     disabled ? 0.5 : 1,
                cursor:      disabled ? "not-allowed" : "text",
              }}
            />
            <div style={{
              position: "absolute", bottom: "10px", right: "12px",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              {prompt.length > 0 && !disabled && (
                <button type="button" onClick={() => {
                  setPromptState(""); setSelectedPreset(null);
                }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#6b6b8a", display: "flex",
                    alignItems: "center", gap: "3px", fontSize: "11px",
                  }}
                  onMouseEnter={e =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "var(--text-primary)")}
                  onMouseLeave={e =>
                    ((e.currentTarget as HTMLElement).style.color = "#6b6b8a")}>
                  <X size={10} /> Clear
                </button>
              )}
              <span style={{
                fontSize:   "11px",
                color:      charColor,
                fontFamily: "monospace",
                fontVariantNumeric: "tabular-nums",
              }}>
                {prompt.length}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(p => !p)}
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        "6px",
              background: "none",
              border:     "none",
              cursor:     "pointer",
              padding:    "0",
              color:      showAdvanced
                ? "var(--accent)"
                : "var(--text-muted)",
              fontSize: "11px",
              fontWeight: 500,
            }}>
            {showAdvanced
              ? <ChevronUp  size={12} />
              : <ChevronDown size={12} />}
            Advanced options
            {negativePrompt && (
              <span style={{
                fontSize:     "9px",
                background:   "rgba(139,92,246,0.15)",
                color:        "var(--accent)",
                padding:      "1px 5px",
                borderRadius: "99px",
              }}>
                custom negative
              </span>
            )}
          </button>

          {/* Advanced panel */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{    height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}>
                <div style={{
                  display:       "flex",
                  flexDirection: "column",
                  gap:           "10px",
                  padding:       "12px",
                  borderRadius:  "10px",
                  background:    "var(--bg-elevated)",
                  border:        "1px solid var(--border)",
                }}>
                  <div>
                    <label style={{
                      fontSize:  "11px",
                      color:     "var(--text-secondary)",
                      fontWeight: 500,
                      display:   "block",
                      marginBottom: "5px",
                    }}>
                      Negative prompt
                      <span style={{
                        marginLeft: "6px",
                        fontSize:  "10px",
                        color:     "var(--text-muted)",
                      }}>
                        (what to avoid in the image)
                      </span>
                    </label>
                    <textarea
                      value={negativePrompt}
                      onChange={e => setNegativePrompt(e.target.value)}
                      placeholder="blurry, distorted, watermark... (backend adds defaults automatically)"
                      rows={2}
                      style={{
                        width:        "100%",
                        padding:      "8px 12px",
                        borderRadius: "8px",
                        background:   "var(--bg-input)",
                        border:       "1px solid var(--border)",
                        color:        "var(--text-primary)",
                        fontSize:     "12px",
                        resize:       "none",
                        fontFamily:   "'JetBrains Mono', monospace",
                        lineHeight:   "1.6",
                      }}
                    />
                  </div>

                  <div style={{
                    padding:      "8px 10px",
                    borderRadius: "7px",
                    background:   "rgba(139,92,246,0.06)",
                    border:       "1px solid rgba(139,92,246,0.15)",
                  }}>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                        Quality boost active
                      </span>
                      {" "}— backend automatically appends quality enhancers
                      and removes artifacts via negative prompting.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quantity slider */}
          <div style={{
            padding:      "14px 16px",
            borderRadius: "10px",
            background:   "var(--bg-elevated)",
            border:       `1px solid ${isBatch
              ? "rgba(139,92,246,0.3)"
              : "var(--border)"}`,
            display:      "flex",
            flexDirection: "column",
            gap:          "10px",
            transition:   "border-color 200ms",
          }}>
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <Layers size={13}
                  color={isBatch ? "var(--accent)" : "var(--text-muted)"} />
                <span style={{
                  fontSize: "12px", fontWeight: 600,
                  color: isBatch ? "var(--accent)" : "var(--text-secondary)",
                }}>
                  {isBatch ? "Batch Mode" : "Single Image"}
                </span>
              </div>
              <div style={{
                padding:      "3px 10px",
                borderRadius: "99px",
                background:   isBatch
                  ? "rgba(139,92,246,0.15)"
                  : "var(--bg-card)",
                border: `1px solid ${isBatch
                  ? "rgba(139,92,246,0.3)"
                  : "var(--border)"}`,
              }}>
                <span style={{
                  fontSize:   "13px",
                  fontWeight: 700,
                  color:      isBatch
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                  fontFamily: "monospace",
                }}>
                  ×{quantity}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                fontSize:  "10px",
                color:     "var(--text-muted)",
                fontFamily: "monospace",
                minWidth:  "12px",
              }}>1</span>
              <input
                type="range" min={1} max={20} step={1}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                style={{
                  flex:            1,
                  height:          "4px",
                  borderRadius:    "99px",
                  background:      `linear-gradient(90deg, #8B5CF6 ${
                    (quantity - 1) / 19 * 100
                  }%, var(--bg-card) ${(quantity - 1) / 19 * 100}%)`,
                  outline:         "none",
                  cursor:          "pointer",
                  WebkitAppearance: "none",
                  appearance:      "none",
                }}
              />
              <span style={{
                fontSize:  "10px",
                color:     "var(--text-muted)",
                fontFamily: "monospace",
                minWidth:  "20px",
              }}>20</span>
            </div>

            <AnimatePresence>
              {isBatch && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{    opacity: 0, height: 0 }}
                  style={{
                    fontSize:   "11px",
                    color:      "var(--text-secondary)",
                    fontFamily: "monospace",
                    lineHeight: 1.5,
                    overflow:   "hidden",
                  }}>
                  // {quantity} tasks queued simultaneously.
                  Processed sequentially on your GPU.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit button */}
          <motion.button
            type="submit"
            whileHover={{ scale: !isDisabled ? 1.01 : 1 }}
            whileTap={{   scale: !isDisabled ? 0.99 : 1 }}
            disabled={isDisabled}
            style={{
              width:          "100%",
              padding:        "13px",
              borderRadius:   "10px",
              border:         "none",
              background:     loading
                ? "linear-gradient(135deg, #4c1d95, #164e63)"
                : disabled
                ? "linear-gradient(135deg, #3b2a6e, #1a3a4a)"
                : "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)",
              color:          "white",
              fontWeight:     600,
              fontSize:       "14px",
              cursor:         isDisabled ? "not-allowed" : "pointer",
              opacity:        isDisabled ? 0.45 : 1,
              boxShadow:      !isDisabled
                ? "0 0 28px rgba(139,92,246,0.4)"
                : "none",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            "8px",
              letterSpacing:  "-0.01em",
              transition:     "all 200ms",
            }}>
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <circle cx="7" cy="7" r="5.5"
                    stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <path d="M7 1.5A5.5 5.5 0 0112.5 7"
                    stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                {isBatch
                  ? `Queuing ${quantity} tasks...`
                  : "Queuing generation..."}
              </>
            ) : disabled ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <circle cx="7" cy="7" r="5.5"
                    stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <path d="M7 1.5A5.5 5.5 0 0112.5 7"
                    stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Processing chip prompt...
              </>
            ) : (
              <>
                <Zap size={14} />
                {isBatch
                  ? `Generate ${quantity} Images`
                  : "Generate Image"}
              </>
            )}
          </motion.button>
        </form>

        {/* Tips */}
        <div style={{
          borderTop:     "1px solid var(--border)",
          paddingTop:    "16px",
          display:       "flex",
          flexDirection: "column",
          gap:           "6px",
        }}>
          <span style={{
            fontSize:      "10px",
            color:         "#4a4a6a",
            fontWeight:    600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            Pro tips
          </span>
          {[
            "Click a style preset above to instantly enhance your prompt",
            "Quality boost is always active — backend adds enhancers automatically",
            "Use Replicate mode in .env for photorealistic SDXL-Turbo images",
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: "8px" }}>
              <span style={{ color: "var(--accent-2)", fontSize: "11px" }}>→</span>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {tip}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }
);

GenerateForm.displayName = "GenerateForm";
export default GenerateForm;