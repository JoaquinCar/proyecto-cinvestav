import Link from "next/link";
import { descripcionTipo, cuentaParaConstancia, type TipoSesion } from "@/lib/tipos-sesion";
import { IconoTipoSesion, clasesTipoSesion } from "@/components/clases/BadgeTipoSesion";

// ─────────────────────────────────────────────────────────────────────────────
// Qué se hizo en la edición, separado por tipo de actividad.
//
// Existe porque, con tres tipos, «12 sesiones» dejó de querer decir nada: no es
// lo mismo doce charlas que diez charlas, una lectura y la clausura. Y sobre
// todo porque el número contra el que se lee `minAsistencias` es solo el de
// pasaporte — enseñarlo junto al total es lo que evita que alguien fije el
// mínimo en 12 cuando solo hay 10 charlas y nadie pueda recibir constancia.
// ─────────────────────────────────────────────────────────────────────────────

export function DesgloseTipos({
  edicionId,
  porTipo,
  totalSesionesQueCuentan,
  minAsistencias,
}: {
  edicionId: string;
  porTipo: { tipo: TipoSesion; sesiones: number; asistencias: number }[];
  totalSesionesQueCuentan: number;
  /** Mínimo de la edición, para avisar si es inalcanzable. */
  minAsistencias: number;
}) {
  // El caso que hay que gritar: el mínimo pide más charlas de las que existen.
  const minimoInalcanzable = minAsistencias > totalSesionesQueCuentan;

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-xl font-semibold text-foreground mb-1">
        Actividades por tipo
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Solo las sesiones de pasaporte suman al mínimo de la constancia
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {porTipo.map(({ tipo, sesiones, asistencias }) => {
          const d = descripcionTipo(tipo);
          const cuenta = cuentaParaConstancia(tipo);

          return (
            <Link
              key={tipo}
              href={
                tipo === "EVENTO"
                  ? `/eventos?edicion=${edicionId}`
                  : `/clases?edicion=${edicionId}&tipo=${tipo}`
              }
              className="bg-card border border-border rounded-2xl p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 ring-primary"
            >
              <div className="flex items-start justify-between mb-3 gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {d.plural}
                </p>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${clasesTipoSesion(tipo)}`}
                >
                  <IconoTipoSesion tipo={tipo} size={16} />
                </div>
              </div>

              <div className="stat-number text-4xl tabular">{sesiones}</div>

              <p className="mt-1.5 text-xs text-muted-foreground leading-snug">
                <span className="tabular">{asistencias}</span>{" "}
                {asistencias === 1 ? "asistencia" : "asistencias"} ·{" "}
                {cuenta ? (
                  <span className="text-success font-medium">cuenta para la constancia</span>
                ) : (
                  "no cuenta para la constancia"
                )}
              </p>
            </Link>
          );
        })}
      </div>

      {minimoInalcanzable && (
        <p className="mt-4 text-sm leading-relaxed rounded-xl px-4 py-3 bg-destructive/10 border border-destructive/35 text-foreground">
          Esta edición pide{" "}
          <strong className="tabular">{minAsistencias} asistencias</strong> para la
          constancia, pero solo hay{" "}
          <strong className="tabular">{totalSesionesQueCuentan}</strong>{" "}
          {totalSesionesQueCuentan === 1 ? "sesión" : "sesiones"} que cuenten: tal como
          está, <strong>ningún niño puede alcanzarlo</strong>. Baja el mínimo desde la
          edición, o registra las sesiones que falten.
        </p>
      )}
    </div>
  );
}
