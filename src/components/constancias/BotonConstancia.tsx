"use client";

import { useState } from "react";
import { Download, Award, Loader2 } from "lucide-react";

interface BotonConstanciaProps {
  inscripcionId: string;
  elegible: boolean;
  asistencias: number;
  minimo: number;
  constanciaUrl?: string | null;
  constanciaGenerada?: boolean;
}

export function BotonConstancia({
  inscripcionId,
  elegible,
  asistencias,
  minimo,
  constanciaUrl: initialUrl,
  constanciaGenerada: initialGenerada,
}: BotonConstanciaProps) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [generada, setGenerada] = useState(initialGenerada ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pdf/constancia/${inscripcionId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Error al generar constancia");
        return;
      }
      setUrl(json.url);
      setGenerada(true);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (generada && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 min-h-[44px] sm:min-h-0"
        style={{
          background: "oklch(0.52 0.17 152 / 0.12)",
          border: "1px solid oklch(0.52 0.17 152 / 0.35)",
          color: "oklch(0.72 0.12 152)",
        }}
      >
        <Download size={13} />
        Descargar Constancia
      </a>
    );
  }

  if (!elegible) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
        style={{
          background: "oklch(0.72 0.165 72 / 0.06)",
          border: "1px solid oklch(0.72 0.165 72 / 0.18)",
          color: "oklch(0.62 0.06 235)",
        }}
      >
        <Award size={12} style={{ color: "oklch(0.72 0.165 72 / 0.5)" }} />
        {asistencias}/{minimo} asistencias
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleGenerar}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 min-h-[44px] sm:min-h-0"
        style={{
          background: "oklch(0.72 0.165 72 / 0.12)",
          border: "1px solid oklch(0.72 0.165 72 / 0.35)",
          color: "oklch(0.82 0.12 72)",
        }}
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Award size={13} />
        )}
        {loading ? "Generando…" : "Generar Constancia"}
      </button>
      {error && (
        <p className="text-xs" style={{ color: "oklch(0.60 0.21 25)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
