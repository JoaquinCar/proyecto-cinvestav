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
      className="group block rounded-xl p-6 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: edicion.activa
          ? "1px solid oklch(0.72 0.165 72 / 0.45)"
          : "1px solid oklch(0.28 0.055 248)",
        boxShadow: edicion.activa
          ? "0 0 24px oklch(0.72 0.165 72 / 0.07)"
          : "none",
        // ring for focus-visible
        ["--tw-ring-color" as string]: "oklch(0.72 0.165 72)",
      }}
      aria-label={`Ver edición ${edicion.anio}: ${edicion.nombre}`}
    >
      {/* Top row: year + active badge */}
      <div className="flex items-start justify-between mb-4">
        {/* Large year — stat-number style */}
        <div
          className="stat-number leading-none"
          style={{ fontSize: "clamp(3rem, 6vw, 3.75rem)" }}
          aria-label={`Año ${edicion.anio}`}
        >
          {edicion.anio}
        </div>

        <div className="flex flex-col items-end gap-2 ml-3">
          {edicion.activa ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: "oklch(0.72 0.165 72 / 0.12)",
                border: "1px solid oklch(0.72 0.165 72 / 0.4)",
                color: "oklch(0.72 0.165 72)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Activa
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: "oklch(0.21 0.035 248)",
                border: "1px solid oklch(0.28 0.055 248)",
                color: "oklch(0.55 0.05 240)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Inactiva
            </span>
          )}

          {/* Arrow — reveals on hover */}
          <ChevronRight
            size={16}
            strokeWidth={2}
            className="opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200"
            style={{ color: "oklch(0.72 0.165 72)" }}
            aria-hidden
          />
        </div>
      </div>

      {/* Gold rule */}
      <div className="gold-rule mb-4" />

      {/* Name */}
      <p
        className="font-display text-lg font-medium leading-snug mb-4 line-clamp-2"
        style={{ color: "oklch(0.92 0.01 80)" }}
      >
        {edicion.nombre}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Date range */}
        <div
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "oklch(0.62 0.06 235)" }}
        >
          <Calendar size={13} strokeWidth={1.8} aria-hidden />
          <span>{formatRange(edicion.fechaInicio, edicion.fechaFin)}</span>
        </div>

        {/* Inscripciones */}
        <div
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "oklch(0.62 0.06 235)" }}
        >
          <Users size={13} strokeWidth={1.8} aria-hidden />
          <span>
            {inscripciones} {inscripciones === 1 ? "participante" : "participantes"}
          </span>
        </div>

        {/* Clases count */}
        {clases > 0 && (
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "oklch(0.62 0.06 235)" }}
          >
            <span
              className="inline-block w-1 h-1 rounded-full"
              style={{ background: "oklch(0.45 0.04 248)" }}
              aria-hidden
            />
            <span>{clases} {clases === 1 ? "clase" : "clases"}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
