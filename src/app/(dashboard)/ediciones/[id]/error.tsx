"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EdicionError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error tracking service in production
    console.error("[EdicionDetalle]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-up">
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: "oklch(0.60 0.21 25 / 0.10)",
          border: "1px solid oklch(0.60 0.21 25 / 0.25)",
        }}
      >
        <AlertTriangle
          size={28}
          strokeWidth={1.6}
          style={{ color: "oklch(0.72 0.16 25)" }}
          aria-hidden
        />
      </div>

      {/* Heading */}
      <h1
        className="font-display text-2xl font-light mb-2"
        style={{ color: "oklch(0.96 0.01 80)" }}
      >
        Error al cargar la{" "}
        <em style={{ color: "oklch(0.72 0.16 25)" }}>edición</em>
      </h1>

      {/* Gold rule */}
      <div className="gold-rule w-48 my-5" />

      {/* Detail */}
      <p
        className="text-sm leading-relaxed mb-1 max-w-sm"
        style={{ color: "oklch(0.62 0.06 235)" }}
      >
        {error?.message && error.message !== "An error occurred in the Server Components render."
          ? error.message
          : "No fue posible obtener los datos de esta edición. Puede ser un problema temporal de red o del servidor."}
      </p>

      {error?.digest && (
        <p
          className="text-xs mt-1 font-mono"
          style={{ color: "oklch(0.45 0.04 248)" }}
        >
          ref: {error.digest}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
        <Link
          href="/ediciones"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "oklch(0.21 0.035 248)",
            border: "1px solid oklch(0.28 0.055 248)",
            color: "oklch(0.68 0.05 240)",
          }}
          aria-label="Volver a la lista de ediciones"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Ver todas las ediciones
        </Link>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all"
          style={{ color: "oklch(0.13 0.028 248)" }}
          aria-label="Reintentar cargar la página"
        >
          <RefreshCw size={15} strokeWidth={2.2} aria-hidden />
          Reintentar
        </button>
      </div>
    </div>
  );
}
