"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BotonAsistenciaProps {
  presente: boolean;
  onToggle: () => void;
  disabled?: boolean;
  nombre: string; // for aria-label
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BotonAsistencia({
  presente,
  onToggle,
  disabled = false,
  nombre,
}: BotonAsistenciaProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={presente}
      aria-label={presente ? `Marcar ausente a ${nombre}` : `Marcar presente a ${nombre}`}
      aria-pressed={presente}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative flex items-center justify-center rounded-xl shrink-0 transition-all duration-150",
        "w-12 h-12",              // 48×48 px — meets WCAG touch target
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "active:scale-95 cursor-pointer",
        presente
          ? "ring-offset-[oklch(0.14_0.028_248)]"
          : "ring-offset-[oklch(0.14_0.028_248)]",
      )}
      style={
        presente
          ? {
              background: "oklch(0.72 0.165 72 / 0.15)",
              border: "2px solid oklch(0.72 0.165 72 / 0.70)",
              color: "oklch(0.72 0.165 72)",
            }
          : {
              background: "oklch(0.21 0.035 248)",
              border: "2px solid oklch(0.30 0.055 248)",
              color: "oklch(0.45 0.04 248)",
            }
      }
    >
      {presente && <Check size={22} strokeWidth={2.5} aria-hidden />}
    </button>
  );
}
