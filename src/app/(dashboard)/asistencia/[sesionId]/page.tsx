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
        className="flex items-center gap-1.5 text-sm animate-fade-up text-muted-foreground"
        aria-label="Navegación"
      >
        <Link
          href={`/ediciones/${clase.edicion.id}`}
          className="hover:underline transition-colors text-primary"
        >
          {clase.edicion.nombre}
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/ediciones/${clase.edicion.id}/clases`}
          className="hover:underline transition-colors text-primary"
        >
          Clases
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/clases/${clase.id}`}
          className="hover:underline transition-colors truncate max-w-[8rem] text-primary"
        >
          {clase.nombre}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-secondary-foreground font-medium">Asistencia</span>
      </nav>

      {/* Page header */}
      <div className="animate-fade-up animate-fade-up-delay-1">
        <div className="flex items-start gap-3">
          <Link
            href={`/clases/${clase.id}`}
            className="mt-0.5 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px]"
            aria-label="Volver a la clase"
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          </Link>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary/10">
                <BookOpen
                  size={16}
                  strokeWidth={1.8}
                  className="text-secondary-foreground"
                  aria-hidden
                />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-snug text-foreground">
                {clase.nombre}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 text-sm mt-1 text-muted-foreground">
              <Calendar size={13} strokeWidth={1.8} aria-hidden />
              <time dateTime={new Date(sesion.fecha).toISOString()}>
                {fechaFormateada}
              </time>
            </div>

            <div className="mt-1.5">
              <span
                className={
                  clase.edicion.activa
                    ? "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-secondary/10 border border-secondary/30 text-secondary-foreground"
                    : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-muted border border-border text-muted-foreground"
                }
              >
                {clase.edicion.nombre} · {clase.edicion.anio}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

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
