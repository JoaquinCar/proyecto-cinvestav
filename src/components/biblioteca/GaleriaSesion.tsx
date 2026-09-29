"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageOff,
  Images,
  Loader2,
  ListOrdered,
  User,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrdenImagenes } from "@/components/imagenes/useOrdenImagenes";
import { formatearTamano } from "@/lib/imagenes";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ImagenBiblioteca {
  id: string;
  /** Ruta del proxy autenticado o data URI; `null` si la fila no es servible. */
  url: string | null;
  titulo: string | null;
  tamano: number;
}

export interface GaleriaSesionProps {
  /** Id de la `Clase` — en pantalla, la sesión. */
  claseId: string;
  nombre: string;
  investigador: string;
  /** Fecha ya formateada en el servidor; `null` si la sesión no tiene. */
  fechaTexto: string | null;
  fechaISO: string | null;
  imagenes: ImagenBiblioteca[];
  /** ADMIN y BECARIO. READONLY ve la biblioteca pero no cambia el orden. */
  puedeReordenar: boolean;
}

/**
 * Fotos que se pintan antes de pedir el resto.
 *
 * El motivo es el proxy: cada foto es una petición autenticada a
 * `/api/clases/…/archivo`, y una edición entera son varias decenas. Con
 * `loading="lazy"` el navegador ya evita pedir lo que no se ve, pero la
 * heurística es suya y con la ventana alta puede arrancar muchas a la vez. Este
 * tope es explícito: mientras no se pulse "ver todas", las demás fotos ni
 * siquiera existen en el DOM, así que no hay petición que optimizar.
 */
const VISIBLES_POR_SESION = 12;

// ── Componente ────────────────────────────────────────────────────────────────

export function GaleriaSesion({
  claseId,
  nombre,
  investigador,
  fechaTexto,
  fechaISO,
  imagenes,
  puedeReordenar,
}: GaleriaSesionProps) {
  const idsIniciales = useMemo(() => imagenes.map((i) => i.id), [imagenes]);
  const porId = useMemo(
    () => new Map(imagenes.map((imagen) => [imagen.id, imagen])),
    [imagenes],
  );

  const { ids, mover, guardarPendiente, estado, anuncio } = useOrdenImagenes(
    claseId,
    idsIniciales,
  );

  const [modoOrden, setModoOrden] = useState(false);
  const [todas, setTodas] = useState(false);
  const [ampliadaId, setAmpliadaId] = useState<string | null>(null);
  const [rotas, setRotas] = useState<ReadonlySet<string>>(() => new Set());

  const marcarRota = useCallback((id: string) => {
    setRotas((previas) => {
      if (previas.has(id)) return previas;
      const siguiente = new Set(previas);
      siguiente.add(id);
      return siguiente;
    });
  }, []);

  // Ordenar con la mitad de las fotos escondidas no tiene sentido: al entrar en
  // el modo se despliegan todas.
  function alternarOrden() {
    if (modoOrden) {
      guardarPendiente();
      setModoOrden(false);
      return;
    }
    setTodas(true);
    setModoOrden(true);
  }

  const total = ids.length;
  const visibles = todas || modoOrden ? ids : ids.slice(0, VISIBLES_POR_SESION);
  const ocultas = total - visibles.length;

  const ampliadaIndice = ampliadaId ? ids.indexOf(ampliadaId) : -1;
  const ampliada = ampliadaId ? porId.get(ampliadaId) : undefined;

  return (
    <section
      className="bg-card border border-border rounded-2xl p-4 sm:p-5"
      aria-labelledby={`sesion-${claseId}`}
    >
      {/* ── Encabezado de la sesión ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`sesion-${claseId}`} className="min-w-0">
            <Link
              href={`/clases/${claseId}`}
              className="font-display text-base sm:text-lg font-semibold leading-snug text-foreground hover:text-primary transition-colors"
            >
              {nombre}
            </Link>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User size={12} strokeWidth={1.8} aria-hidden />
              {investigador}
            </span>
            {fechaTexto && fechaISO && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} strokeWidth={1.8} aria-hidden />
                <time dateTime={fechaISO}>{fechaTexto}</time>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Images size={12} strokeWidth={1.8} aria-hidden />
              {total} {total === 1 ? "foto" : "fotos"}
            </span>
          </div>
        </div>

        {puedeReordenar && total > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            {/* El estado del guardado va junto al botón que lo provoca. */}
            {estado === "guardando" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" aria-hidden />
                Guardando…
              </span>
            )}
            {estado === "guardado" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-success">
                <Check size={12} strokeWidth={2.4} aria-hidden />
                Orden guardado
              </span>
            )}

            <button
              type="button"
              onClick={alternarOrden}
              aria-pressed={modoOrden}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors min-h-[44px] border ${
                modoOrden
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-muted border-border text-primary hover:bg-surface-alt"
              }`}
            >
              {modoOrden ? (
                <>
                  <Check size={13} strokeWidth={2.4} aria-hidden />
                  Listo
                </>
              ) : (
                <>
                  <ListOrdered size={13} strokeWidth={2} aria-hidden />
                  Ordenar
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Lo único que percibe un lector de pantalla al mover una foto. */}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>

      {modoOrden && (
        <p className="mt-3 text-xs text-muted-foreground">
          Este es el orden en que las fotos saldrán en el reporte. Usa las
          flechas de cada foto para moverla; se guarda solo.
        </p>
      )}

      {/* ── Galería ── */}
      {total === 0 ? (
        <p className="mt-3 text-xs italic text-muted-foreground">
          Esta sesión todavía no tiene fotos.
        </p>
      ) : (
        <>
          <ul
            className="mt-4 grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr))",
            }}
          >
            {visibles.map((id, indice) => {
              const imagen = porId.get(id);
              if (!imagen) return null;
              const rota = !imagen.url || rotas.has(id);

              return (
                <li key={id} className="min-w-0">
                  <div className="relative">
                    {rota ? (
                      // Hueco explicado en lugar del icono de imagen rota del
                      // navegador: el proxy pudo no servirla (sesión caída,
                      // archivo ausente) y el resto de la página sigue viva.
                      <div
                        className="flex w-full aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted px-1.5 text-center"
                        role="img"
                        aria-label="No se pudo cargar la imagen"
                      >
                        <ImageOff
                          size={16}
                          strokeWidth={1.8}
                          className="text-muted-foreground"
                          aria-hidden
                        />
                        <span className="text-[0.65rem] leading-tight text-muted-foreground">
                          No se pudo cargar
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAmpliadaId(id)}
                        className="block w-full aspect-square overflow-hidden rounded-xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 ring-primary"
                        aria-label={`Ampliar foto ${indice + 1} de ${total}${
                          imagen.titulo ? `: ${imagen.titulo}` : ""
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element --
                            la foto llega por el proxy autenticado (o es un data
                            URI); con next/image quedaría en /_next/image una
                            copia accesible sin sesión, que es justo lo que este
                            proxy evita */}
                        <img
                          src={imagen.url!}
                          alt={imagen.titulo ?? `Foto de ${nombre}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={() => marcarRota(id)}
                        />
                      </button>
                    )}

                    {/* La posición se ve siempre, no solo al ordenar: es el
                        número con el que la foto saldrá en el reporte. */}
                    <span
                      className="absolute bottom-1.5 left-1.5 min-w-[1.25rem] px-1.5 py-0.5 rounded-md text-[0.65rem] font-semibold text-center tabular bg-card/90 border border-border text-muted-foreground"
                      aria-hidden
                    >
                      {indice + 1}
                    </span>
                  </div>

                  {modoOrden && (
                    <div className="mt-1.5 flex items-stretch gap-1.5">
                      <BotonMover
                        onClick={() => mover(id, "subir")}
                        deshabilitado={indice === 0}
                        etiqueta={`Mover la foto ${indice + 1} a la posición ${indice} de ${total}`}
                      >
                        <ChevronLeft size={16} strokeWidth={2.2} aria-hidden />
                      </BotonMover>
                      <BotonMover
                        onClick={() => mover(id, "bajar")}
                        deshabilitado={indice === total - 1}
                        etiqueta={`Mover la foto ${indice + 1} a la posición ${indice + 2} de ${total}`}
                      >
                        <ChevronRight size={16} strokeWidth={2.2} aria-hidden />
                      </BotonMover>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {ocultas > 0 && (
            <button
              type="button"
              onClick={() => setTodas(true)}
              className="mt-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-colors bg-muted border border-border text-primary hover:bg-surface-alt min-h-[44px] w-full sm:w-auto"
            >
              Ver las {ocultas} fotos restantes
            </button>
          )}
        </>
      )}

      {/* ── Foto ampliada ── */}
      <Dialog
        open={ampliadaId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAmpliadaId(null);
        }}
      >
        <DialogContent className="sm:max-w-[44rem] bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-semibold text-foreground">
              {ampliada?.titulo ?? nombre}
            </DialogTitle>
            <p className="text-xs mt-0.5 text-muted-foreground">
              Foto {ampliadaIndice + 1} de {total}
            </p>
          </DialogHeader>

          {ampliada && (!ampliada.url || rotas.has(ampliada.id)) && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No se pudo cargar esta foto.
            </p>
          )}

          {ampliada && ampliada.url && !rotas.has(ampliada.id) && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- ver arriba */}
              <img
                src={ampliada.url}
                alt={ampliada.titulo ?? `Foto de ${nombre}`}
                className="w-full max-h-[60vh] object-contain rounded-xl bg-muted"
                onError={() => marcarRota(ampliada.id)}
              />

              {/* Aquí sí caben "al principio" y "al final": llevar la foto 30 a
                  la primera posición a base de toques sería absurdo. */}
              {puedeReordenar && total > 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <BotonMoverAmplia
                    onClick={() => mover(ampliada.id, "inicio")}
                    deshabilitado={ampliadaIndice === 0}
                    icono={<ArrowLeftToLine size={14} strokeWidth={2} aria-hidden />}
                    texto="Al principio"
                  />
                  <BotonMoverAmplia
                    onClick={() => mover(ampliada.id, "subir")}
                    deshabilitado={ampliadaIndice === 0}
                    icono={<ChevronLeft size={14} strokeWidth={2} aria-hidden />}
                    texto="Una antes"
                  />
                  <BotonMoverAmplia
                    onClick={() => mover(ampliada.id, "bajar")}
                    deshabilitado={ampliadaIndice === total - 1}
                    icono={<ChevronRight size={14} strokeWidth={2} aria-hidden />}
                    texto="Una después"
                  />
                  <BotonMoverAmplia
                    onClick={() => mover(ampliada.id, "final")}
                    deshabilitado={ampliadaIndice === total - 1}
                    icono={<ArrowRightToLine size={14} strokeWidth={2} aria-hidden />}
                    texto="Al final"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatearTamano(ampliada.tamano)}
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/clases/${claseId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-muted border border-border text-primary min-h-[36px]"
                  >
                    <ExternalLink size={13} strokeWidth={2} aria-hidden />
                    Ir a la sesión
                  </Link>
                  <button
                    type="button"
                    onClick={() => setAmpliadaId(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground min-h-[36px]"
                  >
                    <X size={13} strokeWidth={2} aria-hidden />
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── Botones ───────────────────────────────────────────────────────────────────

/**
 * Flecha de mover, bajo cada foto.
 *
 * Izquierda y derecha, no arriba y abajo: en una cuadrícula la foto anterior
 * está a la izquierda, y "subir" haría pensar en la fila de arriba.
 */
function BotonMover({
  onClick,
  deshabilitado,
  etiqueta,
  children,
}: {
  onClick: () => void;
  deshabilitado: boolean;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg transition-colors bg-muted border border-border text-primary hover:bg-surface-alt disabled:opacity-35 disabled:hover:bg-muted focus-visible:outline-none focus-visible:ring-2 ring-primary"
    >
      {children}
    </button>
  );
}

function BotonMoverAmplia({
  onClick,
  deshabilitado,
  icono,
  texto,
}: {
  onClick: () => void;
  deshabilitado: boolean;
  icono: React.ReactNode;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-colors bg-muted border border-border text-primary hover:bg-surface-alt disabled:opacity-35 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 ring-primary"
    >
      {icono}
      {texto}
    </button>
  );
}
