"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  Loader2,
  Search,
  Upload,
  UploadCloud,
} from "lucide-react";
import type { Guia } from "@/lib/importacion/guia";
import type { TipoImportacion } from "@/lib/importacion/columnas";
import type { EdicionDestino, PlanImportacion } from "@/server/queries/importacion";
import { GuiaFormato } from "./GuiaFormato";
import { VistaPrevia, type InfoArchivo } from "./VistaPrevia";

interface Props {
  guias: Guia[];
  ediciones: EdicionDestino[];
}

interface Previa {
  plan: PlanImportacion;
  archivo: InfoArchivo;
}

interface Hecho {
  resumen: { etiqueta: string; valor: number }[];
  edicion: EdicionDestino;
}

export function ImportadorExcel({ guias, ediciones }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<TipoImportacion>(guias[0]?.tipo ?? "participantes");
  const [edicionId, setEdicionId] = useState(ediciones[0]?.id ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [hecho, setHecho] = useState<Hecho | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [importando, setImportando] = useState(false);

  const guia = guias.find((g) => g.tipo === tipo) ?? guias[0];

  function limpiar() {
    setPrevia(null);
    setHecho(null);
  }

  function cambiarTipo(nuevo: TipoImportacion) {
    setTipo(nuevo);
    setArchivo(null);
    if (inputRef.current) inputRef.current.value = "";
    limpiar();
  }

  function cuerpo(): FormData | null {
    if (!archivo || !edicionId) return null;
    const fd = new FormData();
    fd.set("tipo", tipo);
    fd.set("edicionId", edicionId);
    fd.set("archivo", archivo);
    return fd;
  }

  async function analizar() {
    const fd = cuerpo();
    if (!fd) return;
    setAnalizando(true);
    limpiar();
    try {
      const res = await fetch("/api/importar/previsualizar", { method: "POST", body: fd });
      const datos = await res.json();
      if (!res.ok) {
        toast.error(datos.error ?? "No se pudo leer el archivo");
        return;
      }
      setPrevia({ plan: datos.plan, archivo: datos.archivo });
      if (datos.plan.errores.length > 0) {
        toast.warning(
          `El archivo tiene ${datos.plan.errores.length} error(es). Revisa el detalle.`,
        );
      }
    } catch {
      toast.error("No se pudo contactar al servidor");
    } finally {
      setAnalizando(false);
    }
  }

  async function confirmar() {
    const fd = cuerpo();
    if (!fd) return;
    setImportando(true);
    try {
      const res = await fetch("/api/importar", { method: "POST", body: fd });
      const datos = await res.json();
      if (!res.ok) {
        toast.error(datos.error ?? "No se pudo importar");
        if (datos.plan) setPrevia((p) => (p ? { ...p, plan: datos.plan } : p));
        return;
      }
      setHecho({ resumen: datos.resultado.resumen, edicion: datos.edicion });
      setPrevia(null);
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success("Importación completada");
      router.refresh();
    } catch {
      toast.error("No se pudo contactar al servidor. No se guardó ningún cambio.");
    } finally {
      setImportando(false);
    }
  }

  const anioPlantilla = ediciones.find((e) => e.id === edicionId)?.anio;
  const urlPlantilla =
    `/api/importar/plantilla?tipo=${tipo}` + (anioPlantilla ? `&anio=${anioPlantilla}` : "");

  return (
    <div className="space-y-6">
      {/* Selector de tipo */}
      <div
        role="tablist"
        aria-label="Tipo de importación"
        className="flex flex-col gap-2 sm:flex-row"
      >
        {guias.map((g) => {
          const activo = g.tipo === tipo;
          return (
            <button
              key={g.tipo}
              role="tab"
              aria-selected={activo}
              type="button"
              onClick={() => cambiarTipo(g.tipo)}
              className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors min-h-[44px] ${
                activo
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Paso {g.paso}
              </div>
              <div
                className={`font-display text-sm font-semibold ${
                  activo ? "text-primary" : "text-foreground"
                }`}
              >
                {g.titulo}
              </div>
            </button>
          );
        })}
      </div>

      {/* Guía — siempre visible, antes de subir nada */}
      <GuiaFormato guia={guia} />

      {/* Carga */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-display text-base font-semibold text-foreground">
            Subir el archivo
          </h3>
          <a
            href={urlPlantilla}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Download size={15} strokeWidth={2} aria-hidden />
            Descargar plantilla .xlsx
          </a>
        </div>

        {ediciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Antes de importar necesitas crear una edición.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Edición de destino
                </span>
                <select
                  value={edicionId}
                  onChange={(e) => {
                    setEdicionId(e.target.value);
                    limpiar();
                  }}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {ediciones.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} ({e.anio})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Archivo .xlsx
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] ?? null);
                    limpiar();
                  }}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-muted-foreground outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={analizar}
                disabled={!archivo || analizando || importando}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold btn-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analizando ? (
                  <Loader2 size={15} strokeWidth={2.4} aria-hidden className="animate-spin" />
                ) : (
                  <Search size={15} strokeWidth={2.4} aria-hidden />
                )}
                {analizando ? "Analizando…" : "Analizar archivo"}
              </button>
              <p className="text-xs text-muted-foreground">
                Analizar no guarda nada: solo te muestra qué pasaría.
              </p>
            </div>
          </>
        )}
      </section>

      {/* Vista previa */}
      {previa && (
        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Vista previa
          </h3>
          <VistaPrevia plan={previa.plan} archivo={previa.archivo} />

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={confirmar}
              disabled={!previa.plan.puedeImportar || importando}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold btn-primary transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importando ? (
                <Loader2 size={15} strokeWidth={2.4} aria-hidden className="animate-spin" />
              ) : (
                <UploadCloud size={15} strokeWidth={2.4} aria-hidden />
              )}
              {importando ? "Importando…" : "Confirmar e importar"}
            </button>
            <button
              type="button"
              onClick={limpiar}
              disabled={importando}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            {!previa.plan.puedeImportar && (
              <p className="text-xs text-muted-foreground">
                {previa.plan.errores.length > 0
                  ? "Corrige los errores del archivo para poder importar."
                  : "No hay nada nuevo que importar en este archivo."}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Resultado */}
      {hecho && (
        <section className="rounded-xl border border-success/40 bg-success/5 p-5">
          <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <CheckCircle2 size={17} strokeWidth={2} aria-hidden className="text-success" />
            Importación completada en {hecho.edicion.nombre}
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Los cambios se guardaron en una sola transacción.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hecho.resumen.map((r) => (
              <div key={r.etiqueta} className="rounded-xl border border-border bg-card p-4">
                <div className="stat-number text-2xl">{r.valor}</div>
                <div className="mt-1 text-xs text-muted-foreground">{r.etiqueta}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setHecho(null)}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Upload size={15} strokeWidth={2} aria-hidden />
            Importar otro archivo
          </button>
        </section>
      )}
    </div>
  );
}
