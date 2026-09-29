"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Award, Loader2, ShieldOff } from "lucide-react";
import { generarConstancia } from "@/lib/api/constancias";
import { mensajeDeError } from "@/lib/api/errores";

// ─────────────────────────────────────────────────────────────────────────────
// El botón de la constancia en la ficha del niño.
//
// Cambió de sentido con la política: antes mostraba un contador "2/5
// asistencias" y bloqueaba hasta alcanzarlo. Hoy la constancia le toca a todo
// inscrito, así que lo único que bloquea es que un ADMIN lo haya excluido — y
// entonces hay que decir POR QUÉ, no dejar un botón gris sin explicación.
// ─────────────────────────────────────────────────────────────────────────────

interface BotonConstanciaProps {
  inscripcionId: string;
  /** `false` solo si un ADMIN excluyó esta inscripción. */
  elegible: boolean;
  /** Motivo de la exclusión, cuando la hay. */
  motivoExclusion?: string | null;
  constanciaUrl?: string | null;
  constanciaGenerada?: boolean;
  /** Quién puede generar: ADMIN y BECARIO. READONLY solo mira. */
  puedeGenerar?: boolean;
}

export function BotonConstancia({
  inscripcionId,
  elegible,
  motivoExclusion,
  constanciaUrl: initialUrl,
  constanciaGenerada: initialGenerada,
  puedeGenerar = true,
}: BotonConstanciaProps) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [generada, setGenerada] = useState(initialGenerada ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerar() {
    setLoading(true);
    setError(null);
    try {
      const { url: nueva } = await generarConstancia(inscripcionId);
      setUrl(nueva);
      setGenerada(true);
    } catch (err) {
      // El servidor ya explica el caso concreto: exclusión, inscripción
      // borrada, almacenamiento de archivos caído.
      setError(
        mensajeDeError(
          err,
          "No se pudo generar la constancia y no quedó guardada. Vuelve a intentarlo en unos minutos.",
        ),
      );
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
      <div className="flex flex-col gap-1 max-w-[16rem]">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-destructive/10 border border-destructive/30 text-destructive">
          <ShieldOff size={12} aria-hidden />
          No recibe constancia
        </span>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {motivoExclusion ?? "Sin motivo registrado."}{" "}
          <Link href="/constancias" className="underline hover:opacity-80">
            Gestionar en Constancias
          </Link>
        </p>
      </div>
    );
  }

  if (!puedeGenerar) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary/10 border border-secondary/30 text-muted-foreground">
        <Award size={12} className="text-secondary/70" aria-hidden />
        Constancia pendiente de emitir
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleGenerar}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 min-h-[44px] sm:min-h-0 bg-secondary/12 border border-secondary/35 text-secondary-soft-foreground"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Award size={13} />
        )}
        {loading ? "Generando…" : "Generar Constancia"}
      </button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
