"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus, AlertTriangle, X } from "lucide-react";

import { darDeBajaInscripcion } from "@/lib/api/participantes";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BotonBajaInscripcionProps {
  inscripcionId: string;
  /** Nombre de la edición, para que el aviso diga de dónde se da de baja */
  edicionNombre: string;
}

// ── Componente ────────────────────────────────────────────────────────────────
// Dar de baja borra la inscripción del niño en esa edición. Las asistencias no
// caen solas (la llave foránea no está en cascada): si las hay, el servidor
// responde 409 con el conteo y aquí se pide una segunda confirmación explícita
// antes de reintentar con ?forzar=true.

export function BotonBajaInscripcion({
  inscripcionId,
  edicionNombre,
}: BotonBajaInscripcionProps) {
  const router = useRouter();
  const [estado, setEstado] = useState<"inicial" | "confirmar" | "forzar">(
    "inicial",
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function ejecutar(forzar: boolean) {
    setCargando(true);
    try {
      await darDeBajaInscripcion(inscripcionId, forzar);
      toast.success(`Baja registrada en ${edicionNombre}`);
      router.refresh();
    } catch (err) {
      // El 409 trae el detalle con los conteos: se muestra y se ofrece forzar.
      const mensaje =
        err instanceof Error ? err.message : "Error al dar de baja";
      setAviso(mensaje);
      setEstado(/constancia/i.test(mensaje) ? "inicial" : "forzar");
      if (/constancia/i.test(mensaje)) toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  const claseBoton =
    "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 min-h-[44px] sm:min-h-0";

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      {aviso && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed text-destructive bg-destructive/10 border border-destructive/40"
          role="alert"
        >
          <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden />
          <span>{aviso}</span>
        </div>
      )}

      {estado === "inicial" && (
        <button
          type="button"
          onClick={() => {
            setAviso(null);
            setEstado("confirmar");
          }}
          className={`${claseBoton} bg-destructive/10 border border-destructive/35 text-destructive`}
        >
          <UserMinus size={13} />
          Dar de baja
        </button>
      )}

      {estado !== "inicial" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={cargando}
            onClick={() => ejecutar(estado === "forzar")}
            className={`${claseBoton} bg-destructive/15 border border-destructive/45 text-destructive`}
          >
            <UserMinus size={13} />
            {cargando
              ? "Dando de baja…"
              : estado === "forzar"
                ? "Sí, borrar asistencias y dar de baja"
                : `Confirmar baja de ${edicionNombre}`}
          </button>
          <button
            type="button"
            disabled={cargando}
            onClick={() => {
              setEstado("inicial");
              setAviso(null);
            }}
            className={`${claseBoton} bg-muted border border-border text-muted-foreground`}
          >
            <X size={13} />
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
