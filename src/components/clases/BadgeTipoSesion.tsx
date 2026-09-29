import { BookOpen, BookMarked, PartyPopper } from "lucide-react";
import { descripcionTipo, cuentaParaConstancia, type TipoSesion } from "@/lib/tipos-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// La insignia que distingue los tres tipos de actividad.
//
// Está aquí y no repetida en cada pantalla porque aparece en seis sitios
// (listado, detalle, hub de asistencia, pasar lista, eventos, estadísticas) y
// lo que no puede pasar es que el mismo tipo se vea de un color en una pantalla
// y de otro en la siguiente: quien pasa lista desde el teléfono reconoce el
// color antes que el texto.
//
// Los colores salen de los tokens de globals.css, no de valores sueltos:
//   PASAPORTE — primary   (es el programa)
//   LECTURA   — chart-3   (extra, se distingue sin competir)
//   EVENTO    — secondary (independiente, el más llamativo de los tres)
// ─────────────────────────────────────────────────────────────────────────────

const ESTILO: Record<
  TipoSesion,
  { clases: string; icono: typeof BookOpen }
> = {
  PASAPORTE: {
    clases: "bg-primary/10 border-primary/30 text-primary",
    icono: BookOpen,
  },
  LECTURA: {
    clases: "bg-chart-3/10 border-chart-3/35 text-chart-3",
    icono: BookMarked,
  },
  EVENTO: {
    clases: "bg-secondary/15 border-secondary/40 text-secondary-foreground",
    icono: PartyPopper,
  },
};

/** El ícono del tipo, a solas. Para los encabezados que ya tienen su propio marco. */
export function IconoTipoSesion({
  tipo,
  size = 18,
  className,
}: {
  tipo: TipoSesion;
  size?: number;
  className?: string;
}) {
  const Icono = ESTILO[tipo].icono;
  return <Icono size={size} strokeWidth={1.8} className={className} aria-hidden />;
}

/** Las clases de color del tipo, para pintar el marco de un ícono. */
export function clasesTipoSesion(tipo: TipoSesion): string {
  return ESTILO[tipo].clases;
}

export function BadgeTipoSesion({
  tipo,
  /** `true` usa el nombre largo ("Sesión de pasaporte") en vez del corto. */
  largo = false,
  className = "",
}: {
  tipo: TipoSesion;
  largo?: boolean;
  className?: string;
}) {
  const { clases, icono: Icono } = ESTILO[tipo];
  const d = descripcionTipo(tipo);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${clases} ${className}`}
      // El texto corto de la insignia ("Evento") no dice si cuenta o no para la
      // constancia. Quien navega con lector de pantalla lo oye aquí.
      title={d.ayuda}
    >
      <Icono size={11} strokeWidth={2} aria-hidden />
      {largo ? d.etiqueta : d.corta}
    </span>
  );
}

/**
 * Aviso de que la asistencia a esta actividad no suma para la constancia.
 *
 * Se pinta solo donde importa —al pasar lista y en el detalle—, porque es justo
 * ahí donde alguien podría creer que está acercando a un niño a su constancia
 * cuando no es así.
 */
export function AvisoNoCuenta({ tipo }: { tipo: TipoSesion }) {
  if (cuentaParaConstancia(tipo)) return null;

  const d = descripcionTipo(tipo);
  return (
    <p className="text-xs leading-relaxed rounded-lg px-3 py-2 bg-muted border border-border text-muted-foreground">
      La asistencia a {d.etiqueta.toLowerCase()} se guarda, pero{" "}
      <strong className="font-semibold text-foreground">
        no cuenta para el mínimo de la constancia
      </strong>
      : ese mínimo solo lo suman las sesiones de pasaporte.
    </p>
  );
}
