import Link from "next/link";
import { User, ChevronRight, Calendar } from "lucide-react";
import { formatearFecha } from "@/lib/fechas";
import { descripcionTipo, type TipoSesion } from "@/lib/tipos-sesion";
import {
  BadgeTipoSesion,
  IconoTipoSesion,
  clasesTipoSesion,
} from "@/components/clases/BadgeTipoSesion";

export interface ClaseCardData {
  id: string;
  nombre: string;
  /** Sesión de pasaporte, de lectura o evento especial. */
  tipo: TipoSesion;
  /** Null en los eventos especiales: una clausura no la imparte nadie. */
  investigador: string | null;
  descripcion?: string | null;
  edicionId: string;
  /** Fechas en que se imparte. Lo normal es una: la clase ES esa charla. */
  sesiones: { fecha: Date | string }[];
}

interface ClaseCardProps {
  clase: ClaseCardData;
  /** Número total de asistentes únicos (opcional — se calcula en la página) */
  totalParticipantes?: number;
}

export function ClaseCard({ clase, totalParticipantes }: ClaseCardProps) {
  // Una fecha (el caso real): se muestra el día. Ninguna: la clase aún no se
  // puede impartir y conviene que se note. Varias: se dice cuántas.
  const fechas = clase.sesiones;
  const etiquetaFecha =
    fechas.length === 1
      ? formatearFecha(fechas[0].fecha, "media")
      : fechas.length === 0
        ? "Sin fecha"
        : `${fechas.length} fechas`;

  const d = descripcionTipo(clase.tipo);

  return (
    <Link
      href={`/clases/${clase.id}`}
      className="group block bg-card border border-border rounded-2xl p-5 transition-all duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 ring-primary"
      aria-label={
        clase.investigador
          ? `Ver ${d.etiqueta.toLowerCase()}: ${clase.nombre} — ${clase.investigador}`
          : `Ver ${d.etiqueta.toLowerCase()}: ${clase.nombre}`
      }
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Icon + title */}
        <div className="flex items-start gap-3 min-w-0">
          {/* El marco del ícono toma el color del tipo: se distingue de un
              vistazo antes de leer la insignia. */}
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${clasesTipoSesion(clase.tipo)}`}
          >
            <IconoTipoSesion tipo={clase.tipo} size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold leading-snug truncate text-foreground">
              {clase.nombre}
            </p>
            {/* Un evento sin investigador no pinta una línea vacía. */}
            {clase.investigador && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <User size={11} strokeWidth={1.8} aria-hidden />
                <span className="truncate">{clase.investigador}</span>
              </div>
            )}
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
        <BadgeTipoSesion tipo={clase.tipo} />

        {/* Día en que se imparte */}
        <span
          className={
            fechas.length === 0
              ? "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-muted border border-border text-muted-foreground"
              : "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-secondary/10 border border-secondary/30 text-secondary-soft-foreground"
          }
        >
          <Calendar size={11} strokeWidth={2} aria-hidden />
          {etiquetaFecha}
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
