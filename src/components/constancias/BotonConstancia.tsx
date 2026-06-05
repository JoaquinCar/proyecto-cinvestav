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
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 min-h-[44px] sm:min-h-0 bg-success/10 border border-success/40 text-success"
      >
        <Download size={13} />
        Descargar Constancia
      </a>
    );
  }

  if (!elegible) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary/6 border border-secondary/18 text-muted-foreground">
        <Award size={12} className="text-secondary/50" />
        <span className="tabular">{asistencias}/{minimo}</span> asistencias
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleGenerar}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 min-h-[44px] sm:min-h-0 bg-secondary/12 border border-secondary/35 text-secondary-foreground"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Award size={13} />
        )}
        {loading ? "Generando…" : "Generar Constancia"}
      </button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
