import Link from "next/link";
import { BookOpen, User, ChevronRight, Calendar } from "lucide-react";

export interface ClaseCardData {
  id: string;
  nombre: string;
  investigador: string;
  descripcion?: string | null;
  edicionId: string;
  _count: {
    sesiones: number;
  };
}

interface ClaseCardProps {
  clase: ClaseCardData;
  /** Número total de asistentes únicos (opcional — se calcula en la página) */
  totalParticipantes?: number;
}

export function ClaseCard({ clase, totalParticipantes }: ClaseCardProps) {
  const sesiones = clase._count.sesiones;

  return (
    <Link
      href={`/clases/${clase.id}`}
      className="group block rounded-xl p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: "1px solid oklch(0.28 0.055 248)",
        ["--tw-ring-color" as string]: "oklch(0.72 0.165 72)",
      }}
      aria-label={`Ver clase ${clase.nombre} — ${clase.investigador}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Icon + title */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "oklch(0.72 0.165 72 / 0.12)" }}
          >
            <BookOpen
              size={17}
              strokeWidth={1.8}
              style={{ color: "oklch(0.72 0.165 72)" }}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p
              className="font-display text-base font-medium leading-snug truncate"
              style={{ color: "oklch(0.92 0.01 80)" }}
            >
              {clase.nombre}
            </p>
            <div
              className="flex items-center gap-1 mt-0.5 text-xs"
              style={{ color: "oklch(0.62 0.06 235)" }}
            >
              <User size={11} strokeWidth={1.8} aria-hidden />
              <span className="truncate">{clase.investigador}</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          size={15}
          strokeWidth={2}
          className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-200"
          style={{ color: "oklch(0.72 0.165 72)" }}
          aria-hidden
        />
      </div>

      {/* Description (if any) */}
      {clase.descripcion && (
        <p
          className="text-xs leading-relaxed mb-3 line-clamp-2"
          style={{ color: "oklch(0.55 0.05 240)" }}
        >
          {clase.descripcion}
        </p>
      )}

      {/* Gold rule */}
      <div className="gold-rule my-3" />

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sesiones badge */}
        <span
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
          style={{
            background: "oklch(0.72 0.165 72 / 0.10)",
            border: "1px solid oklch(0.72 0.165 72 / 0.3)",
            color: "oklch(0.72 0.165 72)",
          }}
        >
          <Calendar size={11} strokeWidth={2} aria-hidden />
          {sesiones} {sesiones === 1 ? "sesión" : "sesiones"}
        </span>

        {/* Participantes badge (optional) */}
        {totalParticipantes !== undefined && (
          <span
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: "oklch(0.52 0.17 152 / 0.10)",
              border: "1px solid oklch(0.52 0.17 152 / 0.3)",
              color: "oklch(0.72 0.12 152)",
            }}
          >
            {totalParticipantes} {totalParticipantes === 1 ? "asistente" : "asistentes"}
          </span>
        )}
      </div>
    </Link>
  );
}
