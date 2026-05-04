import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Calendar, BookOpen } from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerSesionConClase } from "@/server/queries/clases";
import { ListaAsistencia } from "@/components/asistencia/ListaAsistencia";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaLarga(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sesionId: string }>;
}): Promise<Metadata> {
  const { sesionId } = await params;
  const sesion = await obtenerSesionConClase(sesionId);
  return {
    title: sesion
      ? `Asistencia — ${sesion.clase.nombre} · Pasaporte Científico`
      : "Asistencia · Pasaporte Científico",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AsistenciaPage({
  params,
}: {
  params: Promise<{ sesionId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { sesionId } = await params;

  const sesion = await obtenerSesionConClase(sesionId);
  if (!sesion) notFound();

  const { clase } = sesion;
  const fechaFormateada = formatFechaLarga(sesion.fecha);

  return (
    <div className="space-y-6 pb-20">
      {/* Back link — breadcrumb */}
      <nav
        className="flex items-center gap-1.5 text-sm animate-fade-up"
        aria-label="Navegación"
        style={{ color: "oklch(0.55 0.05 240)" }}
      >
        <Link
          href={`/ediciones/${clase.edicion.id}`}
          className="hover:underline transition-colors"
          style={{ color: "oklch(0.62 0.06 235)" }}
        >
          {clase.edicion.nombre}
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/ediciones/${clase.edicion.id}/clases`}
          className="hover:underline transition-colors"
          style={{ color: "oklch(0.62 0.06 235)" }}
        >
          Clases
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/clases/${clase.id}`}
          className="hover:underline transition-colors truncate max-w-[8rem]"
          style={{ color: "oklch(0.62 0.06 235)" }}
        >
          {clase.nombre}
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "oklch(0.72 0.165 72)" }}>Asistencia</span>
      </nav>

      {/* Page header */}
      <div className="animate-fade-up animate-fade-up-delay-1">
        <div className="flex items-start gap-3">
          <Link
            href={`/clases/${clase.id}`}
            className="mt-0.5 w-9 h-9 flex items-center justify-center rounded-lg shrink-0 transition-colors"
            style={{
              background: "oklch(0.21 0.035 248)",
              border: "1px solid oklch(0.28 0.055 248)",
              color: "oklch(0.75 0.06 235)",
            }}
            aria-label="Volver a la clase"
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          </Link>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "oklch(0.72 0.165 72 / 0.12)" }}
              >
                <BookOpen
                  size={16}
                  strokeWidth={1.8}
                  style={{ color: "oklch(0.72 0.165 72)" }}
                  aria-hidden
                />
              </div>
              <h1
                className="font-display text-2xl sm:text-3xl font-light leading-snug"
                style={{ color: "oklch(0.96 0.01 80)" }}
              >
                {clase.nombre}
              </h1>
            </div>

            <div
              className="flex items-center gap-1.5 text-sm mt-1"
              style={{ color: "oklch(0.62 0.06 235)" }}
            >
              <Calendar size={13} strokeWidth={1.8} aria-hidden />
              <time dateTime={new Date(sesion.fecha).toISOString()}>
                {fechaFormateada}
              </time>
            </div>

            <div className="mt-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                style={{
                  background: clase.edicion.activa
                    ? "oklch(0.72 0.165 72 / 0.10)"
                    : "oklch(0.21 0.035 248)",
                  border: clase.edicion.activa
                    ? "1px solid oklch(0.72 0.165 72 / 0.30)"
                    : "1px solid oklch(0.28 0.055 248)",
                  color: clase.edicion.activa
                    ? "oklch(0.72 0.165 72)"
                    : "oklch(0.55 0.05 240)",
                }}
              >
                {clase.edicion.nombre} · {clase.edicion.anio}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Core client component */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <ListaAsistencia
          sesionId={sesionId}
          claseNombre={clase.nombre}
          fecha={fechaFormateada}
          edicionNombre={`${clase.edicion.nombre} · ${clase.edicion.anio}`}
          readOnly={session.user.role === "READONLY"}
        />
      </div>
    </div>
  );
}
