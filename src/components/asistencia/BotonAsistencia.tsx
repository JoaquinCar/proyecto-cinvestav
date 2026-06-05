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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ring-offset-background",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "active:scale-95 cursor-pointer",
        presente
          ? "bg-success/15 border-2 border-success/70 text-success"
          : "bg-muted border-2 border-border text-muted-foreground",
      )}
    >
      {presente && <Check size={22} strokeWidth={2.5} aria-hidden />}
    </button>
  );
}
