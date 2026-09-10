import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { auth } from "@/lib/auth";
import { listarEdiciones } from "@/server/queries/ediciones";
import { resolverEdicionSeleccionada } from "@/lib/edicion-seleccionada";
import { SelectorEdicion } from "@/components/clases/SelectorEdicion";
import { AnalisisEdicion } from "@/components/estadisticas/AnalisisEdicion";

export const metadata: Metadata = {
  title: "Estadísticas · Pasaporte Científico",
};

// ── Página ────────────────────────────────────────────────────────────────────
// Análisis a fondo de una edición. La edición se elige con `?edicion=`; sin
// parámetro se muestra la activa. Antes solo sabía leer la activa, de modo que
// en 2027 no había forma de consultar 2026 salvo reactivándola — justo lo que
// no se debe hacer.

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { edicion: edicionParam } = await searchParams;
  const ediciones = await listarEdiciones();
  const edicion = resolverEdicionSeleccionada(ediciones, edicionParam);

  if (!edicion) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-foreground">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">Sin ediciones — crea una en /ediciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Análisis <em className="text-primary not-italic font-semibold">a fondo</em>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {edicion.nombre} · una mirada completa a los participantes y su asistencia
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!edicion.activa && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                Edición anterior · {edicion.anio}
              </span>
            )}
            {edicion.cerrada && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                <Lock size={11} strokeWidth={2} aria-hidden />
                Cerrada
              </span>
            )}
          </div>
        </div>

        <SelectorEdicion
          ediciones={ediciones.map((e) => ({
            id: e.id,
            nombre: e.nombre,
            anio: e.anio,
            activa: e.activa,
          }))}
          edicionActualId={edicion.id}
          basePath="/estadisticas"
        />
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <AnalisisEdicion edicionId={edicion.id} />
    </div>
  );
}
