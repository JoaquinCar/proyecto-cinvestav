import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Download, Lock } from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { AnalisisEdicion } from "@/components/estadisticas/AnalisisEdicion";

export const metadata: Metadata = {
  title: "Reportes de la edición · Pasaporte Científico",
};

// ── Página ────────────────────────────────────────────────────────────────────
// Reporte de UNA edición concreta, la del URL.
//
// Antes esta página ni siquiera recibía el `id`: redirigía a /estadisticas, que
// resolvía por edición activa. Pedir el reporte de 2026 estando activa 2027
// mostraba el de 2027. Ahora el `id` se pasa tal cual al panel de análisis, y
// las consultas de src/server/queries/estadisticas.ts ya filtran por edicionId.

export default async function ReportesEdicionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const edicion = await obtenerEdicionPorId(id);
  if (!edicion) notFound();

  const esAdmin = session.user.role === "ADMIN";

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="animate-fade-up">
        <Link
          href={`/ediciones/${edicion.id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la edición
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
              <BarChart3 size={20} strokeWidth={1.8} className="text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
                Reportes ·{" "}
                <em className="text-primary not-italic font-semibold">{edicion.nombre}</em>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground tabular">
                  Edición {edicion.anio}
                </span>
                {edicion.activa ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-success/10 border border-success/40 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Activa
                  </span>
                ) : null}
                {edicion.cerrada && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                    <Lock size={11} strokeWidth={2} aria-hidden />
                    Cerrada
                  </span>
                )}
              </div>
            </div>
          </div>

          {esAdmin && (
            <a
              href={`/api/exportar/excel/${edicion.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-muted text-foreground transition-opacity hover:opacity-80 min-h-[44px]"
            >
              <Download size={15} aria-hidden />
              Exportar Excel
            </a>
          )}
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Sin comparativo: aquí se viene a ver ESTA edición, no el histórico. */}
      <AnalisisEdicion edicionId={edicion.id} mostrarComparativo={false} />
    </div>
  );
}
