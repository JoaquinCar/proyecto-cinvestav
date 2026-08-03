"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Tabla equivalente de la gráfica. Se muestra dentro del modal ampliado para que
 * cualquier valor se pueda leer exacto, sin depender del color ni del tooltip.
 */
export interface TablaDatos {
  columnas: string[];
  filas: (string | number)[][];
}

interface Props {
  title: string;
  subtitle?: string;
  /** Alto del área de gráfica en la tarjeta. "auto" = lo que mida el contenido. */
  alto?: number | "auto";
  /** Alto del área de gráfica dentro del modal. */
  altoExpandido?: number | "auto";
  /** Tabla con los mismos datos, para leerlos exactos al ampliar. */
  datos?: TablaDatos;
  /** Nota al pie de la tarjeta (hallazgo, aclaración). */
  nota?: string;
  className?: string;
  children: React.ReactNode;
}

export function PanelGrafica({
  title,
  subtitle,
  alto = 280,
  altoExpandido = 520,
  datos,
  nota,
  className = "",
  children,
}: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs mt-1 text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label={`Ampliar gráfica: ${title}`}
          title="Ampliar"
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground
                     hover:text-foreground hover:bg-muted transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Maximize2 size={15} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-4" style={alto === "auto" ? undefined : { height: alto }}>
        {children}
      </div>

      {nota && <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{nota}</p>}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-[min(1200px,calc(100vw-3rem))] max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </DialogHeader>

          {/* La gráfica se re-mide sola: el contenedor de Recharts ocupa el 100% de este alto.
              Recharts pone tabIndex en su lienzo y al abrir el modal se lleva el foco;
              como el lienzo no se opera con teclado, se le quita el anillo de foco. */}
          <div
            className="[&_.recharts-wrapper]:outline-none"
            style={altoExpandido === "auto" ? undefined : { height: altoExpandido }}
          >
            {children}
          </div>

          {nota && <p className="text-xs text-muted-foreground leading-relaxed">{nota}</p>}

          {datos && datos.filas.length > 0 && (
            <div className="mt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Datos
              </h4>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/50">
                      {datos.columnas.map((c, i) => (
                        <th
                          key={c}
                          className={`py-2 px-3 font-medium ${i > 0 ? "text-right" : ""}`}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.filas.map((fila, i) => (
                      <tr key={i} className="border-t border-border/60">
                        {fila.map((celda, j) => (
                          <td
                            key={j}
                            className={`py-1.5 px-3 ${
                              j > 0 ? "text-right tabular text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {celda}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
