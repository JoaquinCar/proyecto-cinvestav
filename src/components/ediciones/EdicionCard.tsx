import Link from "next/link";
import { Calendar, Users, ChevronRight } from "lucide-react";

export interface EdicionCardData {
  id: string;
  anio: number;
  nombre: string;
  fechaInicio: Date | string;
  fechaFin: Date | string;
  activa: boolean;
  _count?: {
    inscripciones?: number;
    clases?: number;
  };
}

interface EdicionCardProps {
  edicion: EdicionCardData;
}

function formatRange(inicio: Date | string, fin: Date | string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const locale = "es-MX";
  const start = new Date(inicio);
  const end = new Date(fin);

  const startStr = start.toLocaleDateString(locale, { ...opts, year: undefined });
  const endStr = end.toLocaleDateString(locale, { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export function EdicionCard({ edicion }: EdicionCardProps) {
  const inscripciones = edicion._count?.inscripciones ?? 0;
  const clases = edicion._count?.clases ?? 0;

  return (
    <Link
      href={`/ediciones/${edicion.id}`}
      className={`group block bg-card border rounded-2xl p-6 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ring-primary hover:border-primary/40 hover:bg-muted ${
        edicion.activa ? "border-success/45" : "border-border"
      }`}
      aria-label={`Ver edición ${edicion.anio}: ${edicion.nombre}`}
    >
      {/* Top row: year + active badge */}
      <div className="flex items-start justify-between mb-4">
        {/* Large year — stat-number style */}
        <div
          className="stat-number leading-none tabular"
          style={{ fontSize: "clamp(3rem, 6vw, 3.75rem)" }}
          aria-label={`Año ${edicion.anio}`}
        >
          {edicion.anio}
        </div>

        <div className="flex flex-col items-end gap-2 ml-3">
          {edicion.activa ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 border border-success/40 text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-muted border border-border text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Inactiva
            </span>
          )}

          {/* Arrow — reveals on hover */}
          <ChevronRight
            size={16}
            strokeWidth={2}
            className="opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200 text-primary"
            aria-hidden
          />
        </div>
      </div>

      {/* Rule */}
      <div className="h-px bg-border mb-4" />

      {/* Name */}
      <p className="font-display text-lg font-medium leading-snug mb-4 line-clamp-2 text-foreground">
        {edicion.nombre}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Date range */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={13} strokeWidth={1.8} aria-hidden />
          <span>{formatRange(edicion.fechaInicio, edicion.fechaFin)}</span>
        </div>

        {/* Inscripciones */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users size={13} strokeWidth={1.8} aria-hidden />
          <span>
            {inscripciones} {inscripciones === 1 ? "participante" : "participantes"}
          </span>
        </div>

        {/* Clases count */}
        {clases > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block w-1 h-1 rounded-full bg-border"
              aria-hidden
            />
            <span>{clases} {clases === 1 ? "clase" : "clases"}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
