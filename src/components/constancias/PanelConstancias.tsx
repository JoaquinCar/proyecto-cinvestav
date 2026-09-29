"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  Download,
  Loader2,
  Search,
  ShieldOff,
  Undo2,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOTIVO_MIN, MOTIVO_MAX } from "@/lib/schemas/constancia.schema";
import {
  cambiarExclusionConstancia,
  generarConstancia,
} from "@/lib/api/constancias";
import { mensajeDeError } from "@/lib/api/errores";
import { formatearInstante } from "@/lib/fechas";
import type { FilaConstancia, ModoMinimo } from "@/server/queries/constancias";

// ─────────────────────────────────────────────────────────────────────────────
// Apartado de constancias de una edición.
//
// Lo que tiene que resolver de un vistazo, con 59 niños en pantalla:
//   · quién la recibe (casi todos) y quién no, y por qué;
//   · actuar en bloque, porque las bajas se marcan de cinco en cinco;
//   · no dejar excluir sin escribir el motivo.
//
// Las asistencias se muestran, pero como dato informativo: desde el cambio de
// política no condicionan nada. Están porque son justo lo que mira el
// coordinador antes de decidir si excluye a alguien.
// ─────────────────────────────────────────────────────────────────────────────

type Filtro = "todos" | "con-derecho" | "excluidos";

interface PanelConstanciasProps {
  filas: FilaConstancia[];
  minimo: number;
  modo: ModoMinimo;
  /** Solo ADMIN. Los demás ven la lista sin poder cambiarla. */
  puedeExcluir: boolean;
}

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "con-derecho", etiqueta: "Con derecho" },
  { valor: "excluidos", etiqueta: "Excluidos" },
];

function iniciales(nombre: string, apellidos: string): string {
  return `${nombre.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

export function PanelConstancias({
  filas,
  minimo,
  modo,
  puedeExcluir,
}: PanelConstanciasProps) {
  const router = useRouter();

  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<null | {
    ids: string[];
    nombres: string;
  }>(null);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtro === "con-derecho" && f.exclusion.excluida) return false;
      if (filtro === "excluidos" && !f.exclusion.excluida) return false;
      if (!texto) return true;
      const campo =
        `${f.participante.nombre} ${f.participante.apellidos} ${f.participante.escuela}`.toLowerCase();
      return campo.includes(texto);
    });
  }, [filas, filtro, busqueda]);

  const seleccionados = visibles.filter((f) => seleccion.has(f.inscripcionId));
  const todosVisiblesMarcados =
    visibles.length > 0 && seleccionados.length === visibles.length;

  function alternar(id: string) {
    setSeleccion((previa) => {
      const copia = new Set(previa);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  function alternarTodos() {
    setSeleccion((previa) => {
      if (todosVisiblesMarcados) return new Set();
      const copia = new Set(previa);
      visibles.forEach((f) => copia.add(f.inscripcionId));
      return copia;
    });
  }

  function abrirDialogo(filasObjetivo: FilaConstancia[]) {
    setMotivo("");
    setDialogo({
      ids: filasObjetivo.map((f) => f.inscripcionId),
      nombres:
        filasObjetivo.length === 1
          ? `${filasObjetivo[0].participante.nombre} ${filasObjetivo[0].participante.apellidos}`
          : `${filasObjetivo.length} participantes`,
    });
  }

  async function aplicar(
    ids: string[],
    excluida: boolean,
    texto?: string,
  ): Promise<void> {
    setGuardando(true);
    try {
      const { actualizadas } = await cambiarExclusionConstancia({
        inscripcionIds: ids,
        excluida,
        motivo: texto ?? null,
      });
      toast.success(
        excluida
          ? `${actualizadas} participante(s) quedaron fuera de la entrega`
          : `${actualizadas} participante(s) vuelven a recibir constancia`,
      );
      setDialogo(null);
      setSeleccion(new Set());
      router.refresh();
    } catch (err) {
      toast.error(
        mensajeDeError(
          err,
          "No se pudo guardar el cambio; la lista sigue como estaba.",
        ),
      );
    } finally {
      setGuardando(false);
    }
  }

  async function generar(inscripcionId: string): Promise<void> {
    setGenerando(inscripcionId);
    try {
      const { url } = await generarConstancia(inscripcionId);
      toast.success("Constancia generada");
      window.open(url, "_blank", "noopener,noreferrer");
      router.refresh();
    } catch (err) {
      toast.error(
        mensajeDeError(
          err,
          "No se pudo generar la constancia y no quedó guardada.",
        ),
      );
    } finally {
      setGenerando(null);
    }
  }

  const motivoValido = motivo.trim().length >= MOTIVO_MIN;

  return (
    <div className="space-y-4">
      {/* Filtros y búsqueda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex rounded-xl bg-muted p-1 gap-1"
          role="tablist"
          aria-label="Filtrar constancias"
        >
          {FILTROS.map(({ valor, etiqueta }) => {
            const activo = filtro === valor;
            const cuantos =
              valor === "todos"
                ? filas.length
                : valor === "excluidos"
                  ? filas.filter((f) => f.exclusion.excluida).length
                  : filas.filter((f) => !f.exclusion.excluida).length;
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setFiltro(valor)}
                className={[
                  "flex-1 sm:flex-none min-h-[44px] px-3 rounded-lg text-xs font-medium transition-colors",
                  activo
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {etiqueta}{" "}
                <span className="tabular opacity-70">({cuantos})</span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-64">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
          />
          <Input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o escuela…"
            aria-label="Buscar participante"
            className="pl-9 pr-9 h-11 text-sm w-full rounded-xl bg-muted border border-border"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Selección en bloque */}
      {puedeExcluir && visibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={todosVisiblesMarcados}
              onCheckedChange={alternarTodos}
              aria-label="Seleccionar todos los visibles"
            />
            Seleccionar los {visibles.length} de la lista
          </label>

          {seleccionados.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground tabular">
                {seleccionados.length} seleccionado
                {seleccionados.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => abrirDialogo(seleccionados)}
                disabled={guardando}
                className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 border border-destructive/35 text-destructive transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                <ShieldOff size={13} aria-hidden />
                Excluir
              </button>
              <button
                type="button"
                onClick={() =>
                  aplicar(
                    seleccionados.map((f) => f.inscripcionId),
                    false,
                  )
                }
                disabled={guardando}
                className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 border border-success/40 text-success transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                <Undo2 size={13} aria-hidden />
                Reincorporar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {visibles.length === 0 ? (
        <div className="rounded-xl px-4 py-8 text-center text-sm bg-card border border-border text-muted-foreground">
          Ningún participante coincide con lo que buscas.
        </div>
      ) : (
        <ul role="list" className="space-y-2">
          {visibles.map((fila) => {
            const { participante, exclusion } = fila;
            const marcado = seleccion.has(fila.inscripcionId);

            return (
              <li
                key={fila.inscripcionId}
                className={[
                  "rounded-2xl border bg-card px-4 py-3",
                  exclusion.excluida
                    ? "border-destructive/30"
                    : "border-border",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  {puedeExcluir && (
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={() => alternar(fila.inscripcionId)}
                      className="mt-2.5"
                      aria-label={`Seleccionar a ${participante.nombre} ${participante.apellidos}`}
                    />
                  )}

                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-muted border border-border text-primary"
                    aria-hidden
                  >
                    {iniciales(participante.nombre, participante.apellidos)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/participantes/${participante.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {participante.nombre} {participante.apellidos}
                    </Link>
                    <div className="text-xs mt-0.5 text-muted-foreground truncate">
                      {participante.escuela}
                      <span className="mx-1.5 text-border">·</span>
                      {participante.grado}
                      <span className="mx-1.5 text-border">·</span>
                      <span className="tabular">{fila.asistencias}</span>
                      {modo === "porcentaje"
                        ? " asistencias"
                        : ` de ${minimo} asistencias`}
                    </div>

                    {exclusion.excluida && (
                      <p className="mt-2 text-xs leading-relaxed rounded-lg bg-destructive/8 border border-destructive/25 px-2.5 py-2 text-destructive">
                        <span className="font-medium">No recibe constancia:</span>{" "}
                        {exclusion.motivo ?? "sin motivo registrado"}
                        <span className="block mt-0.5 opacity-80">
                          {exclusion.por
                            ? `Lo decidió ${exclusion.por.name ?? exclusion.por.email}`
                            : "Autor no registrado"}
                          {exclusion.fecha
                            ? ` · ${formatearInstante(new Date(exclusion.fecha), "media")}`
                            : ""}
                        </span>
                      </p>
                    )}

                    {exclusion.excluida && fila.constanciaGenerada && (
                      <p className="mt-1.5 text-xs text-warning">
                        Ojo: su constancia ya se había generado antes de la
                        exclusión.
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {exclusion.excluida ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-destructive/12 text-destructive">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        Excluido
                      </span>
                    ) : fila.constanciaGenerada ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-success/12 text-success">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        Emitida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-secondary/12 text-secondary-soft-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        Por emitir
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones de la fila */}
                <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[3.25rem]">
                  {fila.constanciaGenerada && fila.constanciaUrl ? (
                    <a
                      href={fila.constanciaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 border border-success/40 text-success transition-opacity hover:opacity-80"
                    >
                      <Download size={13} aria-hidden />
                      Descargar
                    </a>
                  ) : (
                    !exclusion.excluida &&
                    puedeExcluir && (
                      <button
                        type="button"
                        onClick={() => generar(fila.inscripcionId)}
                        disabled={generando === fila.inscripcionId}
                        className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/12 border border-secondary/35 text-secondary-soft-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        {generando === fila.inscripcionId ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Award size={13} aria-hidden />
                        )}
                        {generando === fila.inscripcionId
                          ? "Generando…"
                          : "Generar constancia"}
                      </button>
                    )
                  )}

                  {puedeExcluir &&
                    (exclusion.excluida ? (
                      <button
                        type="button"
                        onClick={() => aplicar([fila.inscripcionId], false)}
                        disabled={guardando}
                        className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 border border-success/40 text-success transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        <Undo2 size={13} aria-hidden />
                        Reincorporar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirDialogo([fila])}
                        disabled={guardando}
                        className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border text-muted-foreground transition-colors hover:text-destructive hover:border-destructive/35 disabled:opacity-50"
                      >
                        <ShieldOff size={13} aria-hidden />
                        No entregar
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Diálogo de exclusión: el motivo es obligatorio */}
      <Dialog
        open={dialogo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDialogo(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No entregar constancia</DialogTitle>
            <DialogDescription>
              {dialogo?.nombres} quedará fuera de la entrega de esta edición. El
              motivo se guarda junto a tu nombre y la fecha, y se puede deshacer
              cuando quieras.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="motivo-exclusion"
              className="text-xs font-medium text-foreground"
            >
              Motivo
            </label>
            <Textarea
              id="motivo-exclusion"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={MOTIVO_MAX}
              rows={3}
              placeholder="Ej.: se dio de baja del programa tras la segunda sesión"
            />
            <p className="text-xs text-muted-foreground">
              <span className="tabular">{motivo.trim().length}</span>/
              <span className="tabular">{MOTIVO_MAX}</span> · mínimo{" "}
              <span className="tabular">{MOTIVO_MIN}</span> caracteres
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setDialogo(null)}
              className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-muted text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!motivoValido || guardando}
              onClick={() => {
                if (dialogo) aplicar(dialogo.ids, true, motivo.trim());
              }}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-destructive text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {guardando && <Loader2 size={14} className="animate-spin" />}
              Confirmar exclusión
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
