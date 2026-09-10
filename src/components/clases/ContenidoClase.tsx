"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlignLeft,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  prepararImagen,
  esTipoAceptado,
  formatearTamano,
} from "@/lib/imagenes";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ImagenClaseVista {
  id: string;
  url: string;
  titulo: string | null;
  mimeType: string;
  tamano: number;
}

interface ContenidoClaseProps {
  claseId: string;
  claseNombre: string;
  descripcion: string | null;
  imagenes: ImagenClaseVista[];
  /** ADMIN: puede escribir la descripción de la clase. */
  puedeEditarDescripcion: boolean;
  /** ADMIN y BECARIO: pueden subir y borrar imágenes. */
  puedeEditarImagenes: boolean;
}

const LARGO_MAXIMO_DESCRIPCION = 1000;

// ── Componente ────────────────────────────────────────────────────────────────

export function ContenidoClase({
  claseId,
  claseNombre,
  descripcion,
  imagenes,
  puedeEditarDescripcion,
  puedeEditarImagenes,
}: ContenidoClaseProps) {
  const router = useRouter();

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [texto, setTexto] = useState(descripcion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [ampliada, setAmpliada] = useState<ImagenClaseVista | null>(null);

  const inputArchivo = useRef<HTMLInputElement>(null);

  const tieneDescripcion = Boolean(descripcion && descripcion.trim().length > 0);

  // ── Descripción ─────────────────────────────────────────────────────────────

  function abrirDialogo() {
    setTexto(descripcion ?? "");
    setDialogoAbierto(true);
  }

  async function guardarDescripcion() {
    const valor = texto.trim();

    if (valor.length > LARGO_MAXIMO_DESCRIPCION) {
      toast.error(`La descripción no puede exceder ${LARGO_MAXIMO_DESCRIPCION} caracteres`);
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch(`/api/clases/${claseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: valor.length > 0 ? valor : null }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Error al guardar la descripción");
      }

      toast.success(
        tieneDescripcion ? "Descripción actualizada" : "Descripción agregada",
      );
      setDialogoAbierto(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar la descripción",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ── Imágenes ────────────────────────────────────────────────────────────────

  const subirImagenes = useCallback(
    async (archivos: Blob[]) => {
      const validos = archivos.filter((a) => esTipoAceptado(a.type));

      if (validos.length === 0) {
        toast.error("Formato no permitido. Usa PNG, JPG, WebP o GIF");
        return;
      }

      setSubiendo(true);
      let exitosas = 0;

      try {
        for (const archivo of validos) {
          try {
            const preparada = await prepararImagen(archivo);

            const res = await fetch(`/api/clases/${claseId}/imagenes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mimeType: preparada.mimeType,
                data: preparada.data,
              }),
            });

            if (!res.ok) {
              const json = await res.json().catch(() => ({}));
              throw new Error(json?.error ?? "Error al subir la imagen");
            }

            exitosas += 1;
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Error al subir la imagen",
            );
          }
        }

        if (exitosas > 0) {
          toast.success(
            exitosas === 1 ? "Imagen agregada" : `${exitosas} imágenes agregadas`,
          );
          router.refresh();
        }
      } finally {
        setSubiendo(false);
      }
    },
    [claseId, router],
  );

  // Pegar desde el portapapeles (⌘/Ctrl + V) en cualquier punto de la página,
  // salvo cuando se está escribiendo en un campo de texto.
  useEffect(() => {
    if (!puedeEditarImagenes) return;

    function alPegar(event: ClipboardEvent) {
      const destino = event.target as HTMLElement | null;
      if (
        destino &&
        (destino.tagName === "INPUT" ||
          destino.tagName === "TEXTAREA" ||
          destino.isContentEditable)
      ) {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) return;

      const archivos: Blob[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const archivo = item.getAsFile();
          if (archivo) archivos.push(archivo);
        }
      }

      if (archivos.length > 0) {
        event.preventDefault();
        void subirImagenes(archivos);
      }
    }

    document.addEventListener("paste", alPegar);
    return () => document.removeEventListener("paste", alPegar);
  }, [puedeEditarImagenes, subirImagenes]);

  async function eliminarImagen(imagen: ImagenClaseVista) {
    if (!window.confirm("¿Eliminar esta imagen de la clase?")) return;

    try {
      const res = await fetch(`/api/clases/${claseId}/imagenes/${imagen.id}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Error al eliminar la imagen");
      }

      toast.success("Imagen eliminada");
      setAmpliada(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al eliminar la imagen",
      );
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4" aria-labelledby="titulo-contenido">
      <h2
        id="titulo-contenido"
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Contenido
      </h2>

      {/* ── Descripción ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlignLeft size={15} strokeWidth={1.8} className="text-primary" aria-hidden />
            Descripción
          </div>

          {puedeEditarDescripcion && (
            <button
              type="button"
              onClick={abrirDialogo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-muted border border-border text-primary hover:bg-surface-alt min-h-[36px]"
            >
              {tieneDescripcion ? (
                <>
                  <Pencil size={12} strokeWidth={2} aria-hidden />
                  Editar descripción
                </>
              ) : (
                <>
                  <Plus size={13} strokeWidth={2.5} aria-hidden />
                  Agregar descripción
                </>
              )}
            </button>
          )}
        </div>

        {tieneDescripcion ? (
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {descripcion}
          </p>
        ) : (
          <p className="mt-3 text-xs italic text-muted-foreground">
            {puedeEditarDescripcion
              ? "Esta clase todavía no tiene descripción."
              : "Sin descripción registrada."}
          </p>
        )}
      </div>

      {/* ── Imágenes ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ImagePlus
              size={15}
              strokeWidth={1.8}
              className="text-secondary-foreground"
              aria-hidden
            />
            Imágenes
            {imagenes.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({imagenes.length})
              </span>
            )}
          </div>

          {puedeEditarImagenes && (
            <button
              type="button"
              onClick={() => inputArchivo.current?.click()}
              disabled={subiendo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-muted border border-border text-primary hover:bg-surface-alt min-h-[36px] disabled:opacity-50"
            >
              {subiendo ? (
                <>
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                  Subiendo…
                </>
              ) : (
                <>
                  <Plus size={13} strokeWidth={2.5} aria-hidden />
                  Agregar imágenes
                </>
              )}
            </button>
          )}
        </div>

        {/* Galería */}
        {imagenes.length > 0 ? (
          <ul
            className="mt-4 grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 9rem), 1fr))",
            }}
          >
            {imagenes.map((imagen) => (
              <li key={imagen.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setAmpliada(imagen)}
                  className="block w-full aspect-square overflow-hidden rounded-xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 ring-primary"
                  aria-label={`Ampliar imagen${imagen.titulo ? `: ${imagen.titulo}` : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- las
                      imágenes son URLs de Supabase Storage o data URIs, no rutas
                      locales optimizables por next/image */}
                  <img
                    src={imagen.url}
                    alt={imagen.titulo ?? `Imagen de ${claseNombre}`}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </button>

                {puedeEditarImagenes && (
                  <button
                    type="button"
                    onClick={() => eliminarImagen(imagen)}
                    className="absolute top-1.5 right-1.5 w-9 h-9 rounded-lg flex items-center justify-center bg-card/90 border border-border text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 ring-destructive"
                    aria-label="Eliminar imagen"
                  >
                    <Trash2 size={14} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs italic text-muted-foreground">
            {puedeEditarImagenes
              ? "Todavía no hay imágenes en esta clase."
              : "Sin imágenes registradas."}
          </p>
        )}

        {/* Zona de subida / pegado */}
        {puedeEditarImagenes && (
          <>
            <input
              ref={inputArchivo}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(e) => {
                const archivos = Array.from(e.target.files ?? []);
                if (archivos.length > 0) void subirImagenes(archivos);
                e.target.value = "";
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                const archivos = Array.from(e.dataTransfer.files ?? []);
                if (archivos.length > 0) void subirImagenes(archivos);
              }}
              onPaste={(e) => {
                const archivos: Blob[] = [];
                for (const item of e.clipboardData.items) {
                  if (item.kind === "file" && item.type.startsWith("image/")) {
                    const archivo = item.getAsFile();
                    if (archivo) archivos.push(archivo);
                  }
                }
                if (archivos.length > 0) {
                  e.preventDefault();
                  void subirImagenes(archivos);
                }
              }}
              onClick={() => inputArchivo.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputArchivo.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Subir imágenes: toca para elegir un archivo o pega una captura"
              className={`mt-4 rounded-xl border border-dashed px-4 py-5 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 ring-primary ${
                arrastrando
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/40 hover:border-primary/50"
              }`}
            >
              <ImagePlus
                size={18}
                strokeWidth={1.8}
                className="mx-auto mb-2 text-muted-foreground"
                aria-hidden
              />
              <p className="text-xs font-medium text-foreground">
                Toca para elegir imágenes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                o pega una captura con ⌘/Ctrl + V — también puedes arrastrarlas aquí
              </p>
              <p className="mt-1 text-[0.7rem] text-muted-foreground/70">
                PNG, JPG, WebP o GIF · hasta 3 MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Diálogo: descripción ── */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="sm:max-w-[32rem] bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-foreground">
              {tieneDescripcion ? "Editar descripción" : "Agregar descripción"}
            </DialogTitle>
            <p className="text-xs mt-0.5 text-muted-foreground">{claseNombre}</p>
            <div className="h-px bg-border mt-3" />
          </DialogHeader>

          <div className="space-y-2 mt-2">
            <Label
              htmlFor="descripcion-clase"
              className="text-sm font-medium text-foreground"
            >
              Descripción de la clase
            </Label>
            <Textarea
              id="descripcion-clase"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={7}
              maxLength={LARGO_MAXIMO_DESCRIPCION}
              placeholder="Qué se hace en esta clase, materiales, objetivos…"
              className="resize-none transition-colors bg-surface-alt border-border focus:border-primary focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground text-right tabular">
              {texto.length} / {LARGO_MAXIMO_DESCRIPCION}
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setDialogoAbierto(false)}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarDescripcion}
              disabled={guardando}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all disabled:opacity-50 min-h-[44px]"
              aria-busy={guardando}
            >
              {guardando ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: imagen ampliada ── */}
      <Dialog
        open={ampliada !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAmpliada(null);
        }}
      >
        <DialogContent className="sm:max-w-[44rem] bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-semibold text-foreground">
              {ampliada?.titulo ?? claseNombre}
            </DialogTitle>
          </DialogHeader>

          {ampliada && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- ver arriba */}
              <img
                src={ampliada.url}
                alt={ampliada.titulo ?? `Imagen de ${claseNombre}`}
                className="w-full max-h-[70vh] object-contain rounded-xl bg-muted"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatearTamano(ampliada.tamano)}
                </span>
                <div className="flex items-center gap-2">
                  {puedeEditarImagenes && (
                    <button
                      type="button"
                      onClick={() => eliminarImagen(ampliada)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-destructive/10 border border-destructive/40 text-destructive min-h-[36px]"
                    >
                      <Trash2 size={13} strokeWidth={2} aria-hidden />
                      Eliminar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAmpliada(null)}
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
