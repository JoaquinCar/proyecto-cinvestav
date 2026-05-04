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

  return (
    <div className="space-y-8 pb-16">
      {/* Back link */}
      <div className="animate-fade-up">
        <Link
          href={`/ediciones/${edicion.id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors"
          style={{ color: "oklch(0.62 0.06 235)" }}
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all"
                style={{ color: "oklch(0.13 0.028 248)" }}
                aria-label="Crear nueva clase"
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden />
                Nueva Clase
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Summary stats */}
      {clases.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1"
        >
          {[
            {
              label: "Total de clases",
              value: clases.length,
              color: "oklch(0.72 0.165 72)",
              bg: "oklch(0.72 0.165 72 / 0.10)",
            },
            {
              label: "Total de sesiones",
              value: totalSesiones,
              color: "oklch(0.52 0.17 152)",
              bg: "oklch(0.52 0.17 152 / 0.10)",
            },
            {
              label: "Investigadores",
              value: new Set(clases.map((c) => c.investigador)).size,
              color: "oklch(0.64 0.12 220)",
              bg: "oklch(0.64 0.12 220 / 0.10)",
            },
          ].map(({ label, value, color, bg }) => (
            <div
              key={label}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{
                background: "oklch(0.18 0.032 248)",
                border: "1px solid oklch(0.28 0.055 248)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium tracking-wide uppercase"
                  style={{ color: "oklch(0.55 0.05 240)", letterSpacing: "0.06em" }}
                >
                  {label}
                </span>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: bg }}
                >
                  <BookOpen size={13} strokeWidth={2} style={{ color }} aria-hidden />
                </div>
              </div>
              <div className="stat-number text-4xl">{value}</div>
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all"
                  style={{ color: "oklch(0.13 0.028 248)" }}
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
