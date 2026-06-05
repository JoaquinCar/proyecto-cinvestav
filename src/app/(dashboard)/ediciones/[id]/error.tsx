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
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-destructive/10 border border-destructive/25">
        <AlertTriangle
          size={28}
          strokeWidth={1.6}
          className="text-destructive"
          aria-hidden
        />
      </div>

      {/* Heading */}
      <h1 className="font-display text-2xl font-semibold mb-2 text-foreground">
        Error al cargar la{" "}
        <em className="text-destructive not-italic font-semibold">edición</em>
      </h1>

      {/* Rule */}
      <div className="h-px bg-border w-48 my-5" />

      {/* Detail */}
      <p className="text-sm leading-relaxed mb-1 max-w-sm text-muted-foreground">
        {error?.message && error.message !== "An error occurred in the Server Components render."
          ? error.message
          : "No fue posible obtener los datos de esta edición. Puede ser un problema temporal de red o del servidor."}
      </p>

      {error?.digest && (
        <p className="text-xs mt-1 font-mono text-muted-foreground/60">
          ref: {error.digest}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
        <Link
          href="/ediciones"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          aria-label="Volver a la lista de ediciones"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Ver todas las ediciones
        </Link>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
          aria-label="Reintentar cargar la página"
        >
          <RefreshCw size={15} strokeWidth={2.2} aria-hidden />
          Reintentar
        </button>
      </div>
    </div>
  );
}
