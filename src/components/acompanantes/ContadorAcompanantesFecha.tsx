"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartHandshake, Loader2, Check } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { mensajeDeError, MENSAJE_SIN_CONEXION } from "@/lib/api/errores";
import { MAXIMO_ACOMPANANTES_POR_FECHA } from "@/lib/schemas/clase.schema";

// ─────────────────────────────────────────────────────────────────────────────
// CUÁNTOS ADULTOS ACOMPAÑARON EN ESTA FECHA
//
// Lo pidió el coordinador así de literal: «que en la lista se pueda poner
// cuántos papás y mamás fueron a cada sesión. Ojo, solo número, no lista de
// papás». Por eso aquí hay DOS casillas de número y ni un campo de nombre.
//
// No se confunde con el acompañante de la ficha del niño (`Acompanante` ligado
// a la `Inscripcion`): aquello es con quién llega CADA niño ese año, y se
// captura al inscribirlo. Esto es un aforo de la fecha y se cuenta al pasar
// lista, que es el único momento en que alguien tiene delante a los adultos.
//
// Se guarda al salir de la casilla (blur), no con un botón: quien pasa lista
// está de pie, con el teléfono en una mano, y un «Guardar» que se olvida de
// pulsar pierde el dato.
// ─────────────────────────────────────────────────────────────────────────────

const FALLO_AL_GUARDAR =
  "No se pudo guardar el número de acompañantes; sigue como estaba. Vuelve a intentarlo en unos minutos.";

interface Props {
  sesionId: string;
  /** Lo guardado hasta ahora. `null` es «nadie los ha contado todavía». */
  mamas: number | null;
  papas: number | null;
  /** READONLY mira pero no cuenta. */
  readOnly?: boolean;
}

type Campo = "acompanantesMamas" | "acompanantesPapas";

/** Lo que se teclea es texto: "" es «sin contar» y el resto tiene que ser entero. */
function aConteo(texto: string): { ok: true; valor: number | null } | { ok: false } {
  const limpio = texto.trim();
  if (limpio === "") return { ok: true, valor: null };
  if (!/^\d+$/.test(limpio)) return { ok: false };
  const n = Number(limpio);
  if (n > MAXIMO_ACOMPANANTES_POR_FECHA) return { ok: false };
  return { ok: true, valor: n };
}

export function ContadorAcompanantesFecha({
  sesionId,
  mamas,
  papas,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [valores, setValores] = useState({
    acompanantesMamas: mamas === null ? "" : String(mamas),
    acompanantesPapas: papas === null ? "" : String(papas),
  });
  // Lo último confirmado por el servidor: es contra esto que se decide si hay
  // algo que guardar, para no mandar una petición por cada vez que el campo
  // pierde el foco sin haber cambiado.
  const [guardado, setGuardado] = useState({
    acompanantesMamas: mamas,
    acompanantesPapas: papas,
  });
  const [guardando, setGuardando] = useState<Campo | null>(null);
  const [recienGuardado, setRecienGuardado] = useState<Campo | null>(null);

  async function guardar(campo: Campo) {
    const parseado = aConteo(valores[campo]);

    if (!parseado.ok) {
      // Se devuelve la casilla a lo último bueno en vez de dejar en pantalla un
      // número que no está guardado: si no, quien lo escribió se va creyendo
      // que quedó registrado.
      setValores((v) => ({
        ...v,
        [campo]: guardado[campo] === null ? "" : String(guardado[campo]),
      }));
      toast.error(
        `Escribe cuántos asistieron con un número entero, de 0 a ${MAXIMO_ACOMPANANTES_POR_FECHA}.`,
      );
      return;
    }

    if (parseado.valor === guardado[campo]) return;

    setGuardando(campo);
    try {
      const res = await fetch(`/api/sesiones/${sesionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: parseado.valor }),
      }).catch(() => {
        throw new Error(MENSAJE_SIN_CONEXION);
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? FALLO_AL_GUARDAR);
      }

      setGuardado((g) => ({ ...g, [campo]: parseado.valor }));
      setRecienGuardado(campo);
      setTimeout(() => setRecienGuardado(null), 1800);
      // El total de acompañantes de la edición se calcula en el servidor.
      router.refresh();
    } catch (error) {
      setValores((v) => ({
        ...v,
        [campo]: guardado[campo] === null ? "" : String(guardado[campo]),
      }));
      toast.error(mensajeDeError(error, FALLO_AL_GUARDAR));
    } finally {
      setGuardando(null);
    }
  }

  const total =
    (guardado.acompanantesMamas ?? 0) + (guardado.acompanantesPapas ?? 0);
  const sinContar =
    guardado.acompanantesMamas === null && guardado.acompanantesPapas === null;

  function casilla(campo: Campo, etiqueta: string, id: string) {
    return (
      <div className="space-y-1.5 flex-1 min-w-0">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {etiqueta}
        </Label>
        <div className="relative">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAXIMO_ACOMPANANTES_POR_FECHA}
            step={1}
            placeholder="—"
            disabled={readOnly || guardando === campo}
            value={valores[campo]}
            onChange={(e) =>
              setValores((v) => ({ ...v, [campo]: e.target.value }))
            }
            onBlur={() => guardar(campo)}
            // Enter guarda sin salir del campo: en el teléfono es el botón que
            // queda a mano.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-12 rounded-xl bg-muted border border-border tabular text-base focus-visible:ring-primary"
          />
          {guardando === campo && (
            <Loader2
              size={15}
              aria-hidden
              className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          )}
          {recienGuardado === campo && guardando !== campo && (
            <Check
              size={15}
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-foreground"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl p-4 sm:p-5 bg-card border border-border"
      aria-labelledby="acompanantes-fecha-titulo"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-chart-3/10">
          <HeartHandshake
            size={17}
            strokeWidth={1.8}
            aria-hidden
            className="text-chart-3"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="acompanantes-fecha-titulo"
            className="text-sm font-medium text-foreground"
          >
            Acompañantes de esta fecha
          </h2>
          <p className="text-xs mt-0.5 leading-relaxed text-muted-foreground">
            Cuántos adultos vinieron. Solo el número: los nombres no se
            registran.{" "}
            {sinContar ? (
              <span>Déjalo en blanco si nadie los contó.</span>
            ) : (
              <span className="text-foreground tabular">
                Van {total} en total.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        {casilla("acompanantesMamas", "Mamás", "acompanantes-mamas")}
        {casilla("acompanantesPapas", "Papás", "acompanantes-papas")}
      </div>

      {readOnly && (
        <p className="text-xs mt-3 text-muted-foreground">
          Tu cuenta es de solo consulta: puedes ver el conteo, pero no cambiarlo.
        </p>
      )}
    </section>
  );
}
