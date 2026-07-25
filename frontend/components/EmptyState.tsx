"use client";
import { Camera, Box, Sparkles, User, Cat } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  onSelect: (prompt: string) => void;
  chipLoading?: boolean;
}

const CHIPS = [
  {
    icon: Camera,
    label: "Red apple on wooden table",
    prompt: "a red apple on a wooden table, studio lighting, photorealistic, sharp focus, 8k",
  },
  {
    icon: Box,
    label: "Blue car on empty road",
    prompt: "a blue car on an empty road, golden hour, cinematic, 8k",
  },
  {
    icon: Sparkles,
    label: "Astronaut on Mars surface",
    prompt: "an astronaut standing on Mars surface, cinematic lighting, highly detailed, 4k",
  },
  {
    icon: User,
    label: "Person holding smartphone",
    prompt: "a person holding a smartphone, white background, product photo, sharp focus",
  },
  {
    icon: Cat,
    label: "Cat sitting on wooden shelf",
    prompt: "a fluffy cat sitting on a wooden shelf, warm lighting, photorealistic",
  },
];

export default function EmptyState({ onSelect, chipLoading = false }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "16px", padding: "28px 24px",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        display: "flex", flexDirection: "column", gap: "20px",
      }}>

      <div>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)",
          letterSpacing: "-0.02em" }}>
          No generation yet
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
          {chipLoading
            ? "Sending prompt to pipeline..."
            : "Click a sample prompt below to generate instantly"}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {CHIPS.map((chip, i) => {
          const Icon = chip.icon;
          return (
            <motion.button
              key={i}
              whileHover={chipLoading ? {} : { x: 4, borderColor: "rgba(139,92,246,0.35)" }}
              whileTap={chipLoading ? {} : { scale: 0.98 }}
              onClick={() => !chipLoading && onSelect(chip.prompt)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "11px 14px", borderRadius: "10px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                cursor: chipLoading ? "not-allowed" : "pointer",
                textAlign: "left", width: "100%",
                opacity: chipLoading ? 0.5 : 1,
                transition: "opacity 200ms",
              }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "7px", flexShrink: 0,
                background: "rgba(139,92,246,0.12)",
                border: "1px solid rgba(139,92,246,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={14} color="var(--accent)" />
              </div>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", flex: 1 }}>
                {chip.label}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {chipLoading ? "..." : "↗"}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}