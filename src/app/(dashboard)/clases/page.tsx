import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, BookOpen, Calendar, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { listarEdiciones } from "@/server/queries/ediciones";
import { listarClasesDeEdicion } from "@/server/queries/clases";
import { EmptyState } from "@/components/shared/EmptyState";
import { ClaseCard } from "@/components/clases/ClaseCard";
import { SelectorEdicion } from "@/components/clases/SelectorEdicion";

export const metadata: Metadata = {
  title: "Clases · Pasaporte Científico",
};

// ── Página ────────────────────────────────────────────────────────────────────
// Panel general de clases: aquí se ven todas las clases de una edición y aquí
// —y solo aquí— se crean clases nuevas. Antes la creación colgaba de la ruta de
// una edición concreta, lo que hacía parecer que se creaba "desde dentro" de otra
// clase.

export default async function ClasesPage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const { edicion: edicionParam } = await searchParams;
  const ediciones = await listarEdiciones();

  // Sin ediciones no puede haber clases: una clase siempre pertenece a una edición.
  if (ediciones.length === 0) {
    return (
      <div className="space-y-8 pb-16">
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Clases
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de clases del programa
          </p>
        </div>
        <EmptyState
          message="Todavía no hay ediciones"
          detail="Cada clase pertenece a una edición. Crea primero la edición del programa."
          action={
            isAdmin ? (
              <Link
                href="/ediciones/nueva"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
              >
                <Plus size={15} strokeWidth={2.5} aria-hidden />
                Crear edición
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  // Edición seleccionada: la del parámetro, si no la activa, si no la más reciente.
  const edicionSeleccionada =
    ediciones.find((e) => e.id === edicionParam) ??
    ediciones.find((e) => e.activa) ??
    ediciones[0];

  const clases = await listarClasesDeEdicion(edicionSeleccionada.id);
  const clasesConFecha = clases.filter((c) => c._count.sesiones > 0).length;

  const estadisticas = [
    {
      label: "Total de clases",
      value: clases.length,
      icon: BookOpen,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      label: "Clases con fecha",
      value: clasesConFecha,
      icon: Calendar,
      colorClass: "text-success",
      bgClass: "bg-success/10",
    },
    {
      label: "Investigadores",
      value: new Set(clases.map((c) => c.investigador)).size,
      icon: Users,
      colorClass: "text-secondary-foreground",
      bgClass: "bg-secondary/10",
    },
  ];

  const botonNuevaClase = isAdmin ? (
    <Link
      href={`/clases/nueva?edicion=${edicionSeleccionada.id}`}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px] w-full sm:w-auto"
      aria-label="Crear nueva clase"
    >
      <Plus size={16} strokeWidth={2.5} aria-hidden />
      Nueva Clase
    </Link>
  ) : null;

  return (
    <div className="space-y-8 pb-16">
      {/* Encabezado */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              Clases
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {clases.length} {clases.length === 1 ? "clase" : "clases"} en{" "}
              {edicionSeleccionada.nombre} · {edicionSeleccionada.anio}
            </p>
          </div>
          <div className="hidden sm:block shrink-0">{botonNuevaClase}</div>
        </div>

        {/* Selector de edición + botón (móvil) */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <SelectorEdicion
            ediciones={ediciones.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              anio: e.anio,
              activa: e.activa,
            }))}
            edicionActualId={edicionSeleccionada.id}
          />
          <div className="sm:hidden">{botonNuevaClase}</div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Resumen */}
      {clases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
          {estadisticas.map(({ label, value, icon: Icon, colorClass, bgClass }) => (
            <div
              key={label}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  {label}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}
                >
                  <Icon size={13} strokeWidth={2} className={colorClass} aria-hidden />
                </div>
              </div>
              <div className="stat-number text-4xl tabular">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Listado */}
      {clases.length === 0 ? (
        <div className="animate-fade-up animate-fade-up-delay-2">
          <EmptyState
            message="No hay clases registradas en esta edición"
            detail={
              isAdmin
                ? "Crea la primera clase para esta edición del programa."
                : "El administrador aún no ha registrado clases para esta edición."
            }
            action={
              isAdmin ? (
                <Link
                  href={`/clases/nueva?edicion=${edicionSeleccionada.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
                >
                  <Plus size={15} strokeWidth={2.5} aria-hidden />
                  Crear primera clase
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          className="grid gap-4 animate-fade-up animate-fade-up-delay-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))",
          }}
        >
          {clases.map((clase, i) => (
            <div
              key={clase.id}
              className={`animate-fade-up ${
                i < 4 ? `animate-fade-up-delay-${Math.min(i + 2, 4) as 1 | 2 | 3 | 4}` : ""
              }`}
            >
              <ClaseCard clase={clase} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
