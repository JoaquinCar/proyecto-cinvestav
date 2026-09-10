import { AlertTriangle, CheckCircle2, FileSpreadsheet, Info } from "lucide-react";
import type { Guia } from "@/lib/importacion/guia";

// Guía del formato: se ve SIEMPRE, antes de elegir archivo.

export function GuiaFormato({ guia }: { guia: Guia }) {
  return (
    <div className="space-y-6">
      {/* De dónde sale este formato */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet
            size={18}
            strokeWidth={1.8}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <div className="space-y-2 text-sm">
            <p className="text-foreground">{guia.resumen}</p>
            <p className="text-muted-foreground">{guia.origen}</p>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">¿Cuándo se usa? </span>
              {guia.cuando}
            </p>
          </div>
        </div>
      </section>

      {/* Columnas */}
      <section className="space-y-3">
        <h3 className="font-display text-base font-semibold text-foreground">
          Columnas del archivo
        </h3>
        <p className="text-xs text-muted-foreground">
          El orden de las columnas no importa: se reconocen por su nombre. Los nombres
          alternativos también se aceptan.
        </p>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-semibold text-foreground">Columna</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">¿Obligatoria?</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">Valores que admite</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">Notas</th>
              </tr>
            </thead>
            <tbody>
              {guia.columnas.map((col) => (
                <tr key={col.encabezado} className="border-t border-border align-top">
                  <td className="px-4 py-2.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
                      {col.encabezado}
                    </code>
                    {col.alias.length > 0 && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        también: {col.alias.slice(0, 3).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {col.obligatoria ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        Obligatoria
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        Opcional
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{col.admite}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{col.descripcion}</td>
                </tr>
              ))}
              {guia.columnasExtra.map((col) => (
                <tr
                  key={col.encabezado}
                  className="border-t border-border bg-muted/40 align-top"
                >
                  <td className="px-4 py-2.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
                      {col.encabezado}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground" colSpan={3}>
                    {col.descripcion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ejemplo */}
      <section className="space-y-3">
        <h3 className="font-display text-base font-semibold text-foreground">
          Así se ve una hoja correcta
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="w-10 px-3 py-2 text-center font-semibold text-muted-foreground">
                  #
                </th>
                {guia.ejemplo.encabezados.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 font-semibold whitespace-nowrap text-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guia.ejemplo.filas.map((fila, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 text-center text-muted-foreground tabular">
                    {i + 2}
                  </td>
                  {fila.map((celda, j) => (
                    <td key={j} className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {celda === "" ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        celda
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          La fila 1 son los encabezados; los datos empiezan en la fila 2. Los números de
          fila de los errores son exactamente estos.
        </p>
      </section>

      {/* Reglas de lectura */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <Info size={15} strokeWidth={2} aria-hidden className="text-primary" />
            Cómo se lee el archivo
          </h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {guia.requisitos.map((r) => (
              <li key={r} className="flex gap-2">
                <CheckCircle2
                  size={13}
                  strokeWidth={2}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-success"
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-warning/40 bg-warning/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <AlertTriangle size={15} strokeWidth={2} aria-hidden className="text-warning" />
            Qué pasa con los duplicados
          </h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {guia.duplicados.map((d) => (
              <li key={d} className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
