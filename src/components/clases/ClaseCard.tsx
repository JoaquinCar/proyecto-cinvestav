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
      className="group block bg-card border border-border rounded-2xl p-5 transition-all duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 ring-primary"
      aria-label={`Ver clase ${clase.nombre} — ${clase.investigador}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Icon + title */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-secondary/10">
            <BookOpen
              size={17}
              strokeWidth={1.8}
              className="text-secondary-foreground"
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold leading-snug truncate text-foreground">
              {clase.nombre}
            </p>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <User size={11} strokeWidth={1.8} aria-hidden />
              <span className="truncate">{clase.investigador}</span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          size={15}
          strokeWidth={2}
          className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-200 text-primary"
          aria-hidden
        />
      </div>

      {/* Description (if any) */}
      {clase.descripcion && (
        <p className="text-xs leading-relaxed mb-3 line-clamp-2 text-muted-foreground">
          {clase.descripcion}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-border my-3" />

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sesiones badge */}
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-secondary/10 border border-secondary/30 text-secondary-foreground">
          <Calendar size={11} strokeWidth={2} aria-hidden />
          {sesiones} {sesiones === 1 ? "sesión" : "sesiones"}
        </span>

        {/* Participantes badge (optional) */}
        {totalParticipantes !== undefined && (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 border border-success/30 text-success">
            {totalParticipantes} {totalParticipantes === 1 ? "asistente" : "asistentes"}
          </span>
        )}
      </div>
    </Link>
  );
}
