"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type { PlanImportacion, TonoAccion } from "@/server/queries/importacion";

export interface InfoArchivo {
  nombre: string;
  hoja: string;
  filaEncabezado: number;
  columnasReconocidas: string[];
  columnasIgnoradas: string[];
  columnasFaltantes: string[];
  filasLeidas: number;
}

const ESTILO_ACCION: Record<
  TonoAccion,
  { etiqueta: string; clase: string; Icono: typeof PlusCircle }
> = {
  crear: {
    etiqueta: "Se creará",
    clase: "border-success/40 bg-success/10 text-success",
    Icono: PlusCircle,
  },
  reutilizar: {
    etiqueta: "Se reutilizará",
    clase: "border-primary/40 bg-primary/10 text-primary",
    Icono: RotateCcw,
  },
  actualizar: {
    etiqueta: "Se actualizará",
    clase: "border-warning/50 bg-warning/10 text-foreground",
    Icono: RefreshCw,
  },
  sinCambios: {
    etiqueta: "Sin cambios",
    clase: "border-border bg-muted text-muted-foreground",
    Icono: MinusCircle,
  },
  omitir: {
    etiqueta: "Se omitirá",
    clase: "border-border bg-muted text-muted-foreground",
    Icono: MinusCircle,
  },
};

const FILAS_VISIBLES = 15;

export function VistaPrevia({
  plan,
  archivo,
}: {
  plan: PlanImportacion;
  archivo: InfoArchivo;
}) {
  const [todas, setTodas] = useState(false);
  const acciones = todas ? plan.acciones : plan.acciones.slice(0, FILAS_VISIBLES);

  return (
    <div className="space-y-5">
      {/* Qué archivo se leyó */}
      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <p className="text-sm font-semibold text-foreground">{archivo.nombre}</p>
        <p className="mt-1">
          Hoja «{archivo.hoja}» · encabezados en la fila {archivo.filaEncabezado} ·{" "}
          {archivo.filasLeidas} fila{archivo.filasLeidas === 1 ? "" : "s"} de datos ·
          destino: {plan.edicion.nombre}
        </p>
        {archivo.columnasReconocidas.length > 0 && (
          <p className="mt-2">
            <span className="font-semibold text-foreground">Columnas reconocidas: </span>
            {archivo.columnasReconocidas.join(", ")}
          </p>
        )}
        {archivo.columnasIgnoradas.length > 0 && (
          <p className="mt-1">
            <span className="font-semibold text-foreground">Columnas ignoradas: </span>
            {archivo.columnasIgnoradas.join(", ")}
          </p>
        )}
      </div>

      {/* Resumen numérico */}
      {plan.resumen.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plan.resumen.map((r) => (
            <div key={r.etiqueta} className="rounded-xl border border-border bg-card p-4">
              <div className="stat-number text-2xl">{r.valor}</div>
              <div className="mt-1 text-xs text-muted-foreground">{r.etiqueta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Errores */}
      {plan.errores.length > 0 && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertCircle size={15} strokeWidth={2} aria-hidden />
            {plan.errores.length} error{plan.errores.length === 1 ? "" : "es"} que impiden
            importar
          </h3>
          <ul className="space-y-1.5 text-xs">
            {plan.errores.map((e, i) => (
              <li key={i} className="flex gap-2 text-foreground">
                <span className="shrink-0 font-semibold tabular text-destructive">
                  {e.fila === null ? "Archivo:" : `Fila ${e.fila}:`}
                </span>
                <span>{e.mensaje}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            No se guardará nada mientras haya errores. Corrige el Excel y vuelve a
            analizarlo.
          </p>
        </section>
      )}

      {/* Avisos */}
      {plan.avisos.length > 0 && (
        <section className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle size={15} strokeWidth={2} aria-hidden className="text-warning" />
            {plan.avisos.length} aviso{plan.avisos.length === 1 ? "" : "s"} (no impiden
            importar)
          </h3>
          <ul className="space-y-1.5 text-xs">
            {plan.avisos.map((a, i) => (
              <li key={i} className="flex gap-2 text-muted-foreground">
                <span className="shrink-0 font-semibold tabular text-foreground">
                  {a.fila === null ? "Archivo:" : `Fila ${a.fila}:`}
                </span>
                <span>{a.mensaje}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Detalle fila por fila */}
      {plan.acciones.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-base font-semibold text-foreground">
            Qué pasará con cada fila
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="w-16 px-4 py-2.5 font-semibold text-foreground">Fila</th>
                  <th className="px-4 py-2.5 font-semibold text-foreground">Registro</th>
                  <th className="w-36 px-4 py-2.5 font-semibold text-foreground">Acción</th>
                  <th className="px-4 py-2.5 font-semibold text-foreground">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {acciones.map((a) => {
                  const estilo = ESTILO_ACCION[a.accion];
                  const { Icono } = estilo;
                  return (
                    <tr key={a.fila} className="border-t border-border align-top">
                      <td className="px-4 py-2.5 tabular text-muted-foreground">{a.fila}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{a.sujeto}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estilo.clase}`}
                        >
                          <Icono size={11} strokeWidth={2.4} aria-hidden />
                          {estilo.etiqueta}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {a.detalle}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {plan.acciones.length > FILAS_VISIBLES && (
            <button
              type="button"
              onClick={() => setTodas((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ChevronDown
                size={15}
                strokeWidth={2}
                aria-hidden
                className={todas ? "rotate-180 transition-transform" : "transition-transform"}
              />
              {todas
                ? "Mostrar solo las primeras filas"
                : `Ver las ${plan.acciones.length} filas`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
