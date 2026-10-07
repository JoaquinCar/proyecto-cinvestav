"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, AlertTriangle } from "lucide-react";
import { eliminarClase, type ConteosDeBorrado } from "@/lib/api/clases";
import { mensajeDeError } from "@/lib/api/errores";

interface Props {
  clase: { id: string; nombre: string; esEvento: boolean };
  /** A dónde volver si se cancela o cuando ya no existe. */
  volverA: string;
  listadoA: string;
  conteos: ConteosDeBorrado;
}

/**
 * Confirmación de borrado en dos tiempos.
 *
 * El primer intento va SIN forzar. Si la sesión tiene lista pasada o un resumen
 * importado, el servidor responde 409 con el motivo y los conteos: eso no es un
 * error, es la pregunta. Solo entonces aparece el segundo botón, que repite la
 * petición con ?forzar=true. Mismo patrón que la baja de una inscripción.
 */
export function FormEliminarClase({ clase, volverA, listadoA, conteos }: Props) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const quePasa = clase.esEvento ? "el evento" : "la sesión";

  async function borrar(forzar: boolean) {
    setEnviando(true);
    setError(null);

    try {
      const resultado = await eliminarClase(clase.id, forzar);

      if (resultado.estado === "necesitaConfirmacion") {
        setConfirmar(resultado.mensaje);
        return;
      }

      router.push(listadoA);
      router.refresh();
    } catch (err) {
      setError(
        mensajeDeError(
          err,
          `No se pudo eliminar ${quePasa}; sigue como estaba. Vuelve a intentarlo en unos minutos.`,
        ),
      );
    } finally {
      setEnviando(false);
    }
  }

  // Lo que se va sin preguntar, dicho en el vocabulario de la pantalla.
  const seVaConLaSesion = [
    conteos.fechas > 0 &&
      `${conteos.fechas} ${conteos.fechas === 1 ? "fecha" : "fechas"}`,
    conteos.imagenes > 0 &&
      `${conteos.imagenes} ${conteos.imagenes === 1 ? "imagen" : "imágenes"}`,
  ].filter(Boolean) as string[];

  return (
    <div
      className="animate-fade-up animate-fade-up-delay-2 bg-card border border-destructive/30 rounded-2xl p-6 sm:p-8"
      style={{ maxWidth: "36rem" }}
    >
      <div className="flex items-start gap-3 mb-6">
        <AlertTriangle
          size={20}
          strokeWidth={1.8}
          className="shrink-0 mt-0.5 text-destructive"
          aria-hidden
        />
        <div>
          <p className="text-sm font-medium mb-1 text-foreground">
            Esta acción es irreversible
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se eliminará <span className="text-foreground font-medium">{clase.nombre}</span>
            {seVaConLaSesion.length > 0 && <> y, con ella, {seVaConLaSesion.join(" y ")}</>}.
            {conteos.asistencias === 0 && conteos.resumenes === 0 && (
              <> No tiene asistencias registradas.</>
            )}
          </p>
          {(conteos.asistencias > 0 || conteos.resumenes > 0) && (
            <p className="text-sm leading-relaxed mt-2 text-muted-foreground">
              Ojo: tiene historial de asistencia. Se te pedirá confirmarlo otra vez
              antes de borrarlo.
            </p>
          )}
          <p className="text-xs leading-relaxed mt-2 text-muted-foreground/80">
            Las personas del staff asignadas no se borran: solo dejan de estar en esta
            sesión.
          </p>
        </div>
      </div>

      {/* El 409 del servidor: no es un fallo, es la pregunta. */}
      {confirmar && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-4 leading-relaxed text-foreground bg-destructive/10 border border-destructive/40"
          role="alert"
        >
          {confirmar}
        </div>
      )}

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-4 text-destructive bg-destructive/10 border border-destructive/40"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
        <Link
          href={volverA}
          className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={() => void borrar(confirmar !== null)}
          disabled={enviando}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-destructive/15 border border-destructive/50 text-destructive hover:bg-destructive/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          <Trash2 size={15} strokeWidth={2} aria-hidden />
          {enviando
            ? "Eliminando…"
            : confirmar
              ? "Sí, eliminar también el historial"
              : "Confirmar eliminación"}
        </button>
      </div>
    </div>
  );
}
