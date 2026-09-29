import Link from "next/link";
import { TIPOS_SESION, type TipoSesion } from "@/lib/tipos-sesion";
import { clasesTipoSesion } from "@/components/clases/BadgeTipoSesion";

// ─────────────────────────────────────────────────────────────────────────────
// Filtro por tipo del listado de sesiones.
//
// Son enlaces, no botones: así el filtro vive en el URL y se puede compartir
// («mándame la lista de las lecturas»), el botón de atrás del teléfono hace lo
// que se espera, y la pantalla sigue siendo un Server Component sin un gramo
// de JavaScript. Cada objetivo mide 44px de alto, que es lo que hace falta para
// acertarle con el pulgar en campo.
// ─────────────────────────────────────────────────────────────────────────────

export function FiltroTipoSesion({
  edicionId,
  tipoActual,
  conteos,
  total,
}: {
  edicionId: string;
  tipoActual?: TipoSesion;
  conteos: { tipo: TipoSesion; cantidad: number }[];
  total: number;
}) {
  const porTipo = new Map(conteos.map((c) => [c.tipo, c.cantidad]));

  const opciones: {
    clave: string;
    etiqueta: string;
    cantidad: number;
    href: string;
    activo: boolean;
    clasesActivo: string;
  }[] = [
    {
      clave: "todas",
      etiqueta: "Todas",
      cantidad: total,
      href: `/clases?edicion=${edicionId}`,
      activo: tipoActual === undefined,
      clasesActivo: "bg-foreground/10 border-foreground/25 text-foreground",
    },
    ...TIPOS_SESION.map((t) => ({
      clave: t.valor,
      etiqueta: t.corta,
      cantidad: porTipo.get(t.valor) ?? 0,
      href: `/clases?edicion=${edicionId}&tipo=${t.valor}`,
      activo: tipoActual === t.valor,
      clasesActivo: clasesTipoSesion(t.valor),
    })),
  ];

  return (
    <nav
      aria-label="Filtrar por tipo de sesión"
      // Se desplaza en horizontal en pantallas chicas en vez de envolverse a
      // dos filas, que empujaría el listado fuera de la primera pantalla.
      className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1"
    >
      {opciones.map(({ clave, etiqueta, cantidad, href, activo, clasesActivo }) => (
        <Link
          key={clave}
          href={href}
          aria-current={activo ? "page" : undefined}
          className={[
            "inline-flex items-center gap-1.5 shrink-0 min-h-[44px] px-3.5 rounded-xl border text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 ring-primary",
            activo
              ? clasesActivo
              : "bg-muted border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {etiqueta}
          <span className="tabular text-xs opacity-70">{cantidad}</span>
        </Link>
      ))}
    </nav>
  );
}
