import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Plus, ArrowLeft, BookOpen } from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { listarClasesDeEdicion } from "@/server/queries/clases";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ClaseCard } from "@/components/clases/ClaseCard";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const edicion = await obtenerEdicionPorId(id);
  return {
    title: edicion ? `Clases · ${edicion.nombre}` : "Clases · Pasaporte Científico",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClasesEdicionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const { id } = await params;

  const [edicion, clases] = await Promise.all([
    obtenerEdicionPorId(id),
    listarClasesDeEdicion(id),
  ]);

  if (!edicion) notFound();

  const totalSesiones = clases.reduce((acc, c) => acc + c._count.sesiones, 0);

  const statItems = [
    {
      label: "Total de clases",
      value: clases.length,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      label: "Total de sesiones",
      value: totalSesiones,
      colorClass: "text-success",
      bgClass: "bg-success/10",
    },
    {
      label: "Investigadores",
      value: new Set(clases.map((c) => c.investigador)).size,
      colorClass: "text-secondary",
      bgClass: "bg-secondary/10",
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Back link */}
      <div className="animate-fade-up">
        <Link
          href={`/ediciones/${edicion.id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Volver a ${edicion.nombre}`}
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          {edicion.nombre}
        </Link>

        <PageHeader
          title="Clases"
          subtitle={`${edicion.nombre} · ${edicion.anio} · ${clases.length} ${clases.length === 1 ? "clase" : "clases"}`}
          action={
            isAdmin ? (
              <Link
                href={`/ediciones/${edicion.id}/clases/nueva`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
                aria-label="Crear nueva clase"
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden />
                Nueva Clase
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Summary stats */}
      {clases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
          {statItems.map(({ label, value, colorClass, bgClass }) => (
            <div
              key={label}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium tracking-wide uppercase text-muted-foreground"
                  style={{ letterSpacing: "0.06em" }}
                >
                  {label}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bgClass}`}>
                  <BookOpen size={13} strokeWidth={2} className={colorClass} aria-hidden />
                </div>
              </div>
              <div className="stat-number text-4xl tabular">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Grid de clases */}
      {clases.length === 0 ? (
        <div className="animate-fade-up animate-fade-up-delay-2">
          <EmptyState
            message="No hay clases registradas"
            detail={
              isAdmin
                ? "Crea la primera clase para esta edición del programa."
                : "El administrador aún no ha registrado clases para esta edición."
            }
            action={
              isAdmin ? (
                <Link
                  href={`/ediciones/${edicion.id}/clases/nueva`}
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
