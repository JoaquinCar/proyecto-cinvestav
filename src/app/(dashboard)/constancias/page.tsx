import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, Award, ShieldOff, FileCheck2, Info } from "lucide-react";

import { auth } from "@/lib/auth";
import { listarEdiciones } from "@/server/queries/ediciones";
import { listarConstanciasDeEdicion } from "@/server/queries/constancias";
import { resolverEdicionSeleccionada } from "@/lib/edicion-seleccionada";
import { EmptyState } from "@/components/shared/EmptyState";
import { SelectorEdicion } from "@/components/clases/SelectorEdicion";
import { PanelConstancias } from "@/components/constancias/PanelConstancias";

export const metadata: Metadata = {
  title: "Constancias · Pasaporte Científico",
};

// ─────────────────────────────────────────────────────────────────────────────
// Apartado de constancias.
//
// La pantalla existe porque la política cambió: la constancia le toca a TODO
// inscrito y lo que hay que gestionar son las excepciones. Antes esa
// información estaba desperdigada —un botón por niño en su ficha— y no había
// forma de ver el estado de una edición entera de un vistazo, que es justo lo
// que necesita el coordinador con 59 niños.
// ─────────────────────────────────────────────────────────────────────────────

export default async function ConstanciasPage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Excluir es de ADMIN y de nadie más. El resto ve la lista sin poder tocarla.
  const puedeExcluir = session.user.role === "ADMIN";

  const { edicion: edicionParam } = await searchParams;
  const ediciones = await listarEdiciones();

  if (ediciones.length === 0) {
    return (
      <div className="space-y-6 pb-16">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
          Constancias
        </h1>
        <EmptyState
          message="Todavía no hay ediciones"
          detail="Las constancias se entregan por edición. Crea primero la edición del programa."
        />
      </div>
    );
  }

  const seleccionada = resolverEdicionSeleccionada(ediciones, edicionParam);
  const listado = seleccionada
    ? await listarConstanciasDeEdicion(seleccionada.id)
    : null;

  if (!listado) {
    return (
      <div className="space-y-6 pb-16">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
          Constancias
        </h1>
        <EmptyState
          message="Edición no encontrada"
          detail="La edición que buscas no existe o fue eliminada."
        />
      </div>
    );
  }

  const { edicion, filas, resumen } = listado;

  const tarjetas = [
    {
      label: "Inscritos",
      value: resumen.inscritos,
      icon: Users,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      label: "Con derecho",
      value: resumen.conDerecho,
      icon: Award,
      colorClass: "text-success",
      bgClass: "bg-success/10",
    },
    {
      label: "Excluidos",
      value: resumen.excluidos,
      icon: ShieldOff,
      colorClass: "text-destructive",
      bgClass: "bg-destructive/10",
    },
    {
      label: "Emitidas",
      value: resumen.emitidas,
      icon: FileCheck2,
      colorClass: "text-secondary-foreground",
      bgClass: "bg-secondary/10",
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Encabezado */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              Constancias
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {edicion.nombre} · <span className="tabular">{edicion.anio}</span>
            </p>
          </div>
          <SelectorEdicion
            ediciones={ediciones}
            edicionActualId={edicion.id}
            basePath="/constancias"
          />
        </div>
      </div>

      {/* La política, dicha en una línea: sin esto la pantalla no se entiende */}
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-xs leading-relaxed text-foreground animate-fade-up animate-fade-up-delay-1">
        <Info size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden />
        <p>
          <span className="font-medium">
            La constancia le toca a todo inscrito.
          </span>{" "}
          Marca aquí únicamente las excepciones; cada una guarda el motivo, quién
          la decidió y cuándo.{" "}
          {edicion.modo === "porcentaje" ? (
            <>
              El mínimo de la edición (
              <span className="tabular">{edicion.minAsistencias}</span>% de las
              sesiones) ya no decide quién la recibe: se muestra solo como
              referencia.
            </>
          ) : (
            <>
              El mínimo de la edición (
              <span className="tabular">{edicion.minAsistencias}</span>{" "}
              asistencias de{" "}
              <span className="tabular">{edicion.totalSesiones}</span> sesiones)
              ya no decide quién la recibe: se muestra solo como referencia.
            </>
          )}
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up animate-fade-up-delay-1">
        {tarjetas.map(({ label, value, icon: Icon, colorClass, bgClass }) => (
          <div
            key={label}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-xs font-medium tracking-wide uppercase text-muted-foreground"
                style={{ letterSpacing: "0.06em" }}
              >
                {label}
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}
              >
                <Icon size={14} strokeWidth={2} className={colorClass} />
              </div>
            </div>
            <div className="stat-number text-3xl sm:text-4xl tabular">{value}</div>
          </div>
        ))}
      </div>

      {/* Listado */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        {filas.length === 0 ? (
          <EmptyState
            message="Sin participantes inscritos"
            detail="Esta edición todavía no tiene a nadie inscrito, así que no hay constancias que entregar."
          />
        ) : (
          <PanelConstancias
            filas={filas}
            minimo={edicion.minAsistencias}
            modo={edicion.modo}
            puedeExcluir={puedeExcluir}
          />
        )}
      </div>
    </div>
  );
}
