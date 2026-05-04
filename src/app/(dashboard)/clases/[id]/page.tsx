import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  User,
  Calendar,
  FileText,
  StickyNote,
  Users,
  Pencil,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerClasePorId, listarSesionesDeClase } from "@/server/queries/clases";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormSesion } from "@/components/clases/FormSesion";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const clase = await obtenerClasePorId(id);
  return {
    title: clase ? `${clase.nombre} · Pasaporte Científico` : "Clase · Pasaporte Científico",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatFechaCorta(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClaseDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const isBecarioOrAdmin =
    session.user.role === "ADMIN" || session.user.role === "BECARIO";

  const { id } = await params;

  const [clase, sesiones] = await Promise.all([
    obtenerClasePorId(id),
    listarSesionesDeClase(id),
  ]);

  if (!clase) notFound();

  // Fetch the edicion to get its nombre / anio for breadcrumb
  const edicion = await obtenerEdicionPorId(clase.edicionId);

  const totalAsistencias = sesiones.reduce(
    (acc, s) => acc + s._count.asistencias,
    0
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb / back */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-1.5 text-sm mb-5" style={{ color: "oklch(0.55 0.05 240)" }}>
          <Link
            href={edicion ? `/ediciones/${edicion.id}` : "/ediciones"}
            className="hover:underline transition-colors"
            style={{ color: "oklch(0.62 0.06 235)" }}
          >
            {edicion?.nombre ?? "Ediciones"}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={edicion ? `/ediciones/${edicion.id}/clases` : "/ediciones"}
            className="hover:underline transition-colors"
            style={{ color: "oklch(0.62 0.06 235)" }}
          >
            Clases
          </Link>
          <span aria-hidden>/</span>
          <span
            className="truncate max-w-[12rem]"
            style={{ color: "oklch(0.72 0.165 72)" }}
          >
            {clase.nombre}
          </span>
        </div>

        {/* Title area */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.72 0.165 72 / 0.12)" }}
            >
              <BookOpen
                size={22}
                strokeWidth={1.8}
                style={{ color: "oklch(0.72 0.165 72)" }}
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h1
                className="font-display text-2xl sm:text-3xl font-light leading-snug"
                style={{ color: "oklch(0.96 0.01 80)" }}
              >
                {clase.nombre}
              </h1>
              <div
                className="flex items-center gap-1.5 mt-1.5 text-sm"
                style={{ color: "oklch(0.62 0.06 235)" }}
              >
                <User size={13} strokeWidth={1.8} aria-hidden />
                <span>{clase.investigador}</span>
              </div>
              {edicion && (
                <div
                  className="flex items-center gap-1.5 mt-1 text-xs"
                  style={{ color: "oklch(0.55 0.05 240)" }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                    style={{
                      background: edicion.activa
                        ? "oklch(0.72 0.165 72 / 0.10)"
                        : "oklch(0.21 0.035 248)",
                      border: edicion.activa
                        ? "1px solid oklch(0.72 0.165 72 / 0.30)"
                        : "1px solid oklch(0.28 0.055 248)",
                      color: edicion.activa
                        ? "oklch(0.72 0.165 72)"
                        : "oklch(0.55 0.05 240)",
                    }}
                  >
                    {edicion.nombre} · {edicion.anio}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {isBecarioOrAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <FormSesion
                claseId={clase.id}
                claseNombre={clase.nombre}
                variant="primary"
              />
              {isAdmin && (
                <Link
                  href={`/clases/${clase.id}/editar`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: "oklch(0.21 0.035 248)",
                    border: "1px solid oklch(0.28 0.055 248)",
                    color: "oklch(0.75 0.06 235)",
                  }}
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden />
                  Editar
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {clase.descripcion && (
          <p
            className="mt-4 text-sm leading-relaxed max-w-2xl"
            style={{ color: "oklch(0.62 0.06 235)" }}
          >
            {clase.descripcion}
          </p>
        )}
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Stats row */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1"
      >
        {[
          {
            label: "Sesiones",
            value: sesiones.length,
            color: "oklch(0.72 0.165 72)",
            bg:    "oklch(0.72 0.165 72 / 0.10)",
            icon:  Calendar,
          },
          {
            label: "Asistencias totales",
            value: totalAsistencias,
            color: "oklch(0.52 0.17 152)",
            bg:    "oklch(0.52 0.17 152 / 0.10)",
            icon:  Users,
          },
          {
            label: "Promedio / sesión",
            value:
              sesiones.length > 0
                ? Math.round(totalAsistencias / sesiones.length)
                : "—",
            color: "oklch(0.64 0.12 220)",
            bg:    "oklch(0.64 0.12 220 / 0.10)",
            icon:  Users,
          },
        ].map(({ label, value, color, bg, icon: Icon }) => (
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
                <Icon size={13} strokeWidth={2} style={{ color }} aria-hidden />
              </div>
            </div>
            <div className="stat-number text-4xl">{value}</div>
          </div>
        ))}
      </div>

      {/* Sesiones list */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: "oklch(0.62 0.06 235)", letterSpacing: "0.07em" }}
          >
            Sesiones
          </h2>
          {isBecarioOrAdmin && sesiones.length > 0 && (
            <FormSesion
              claseId={clase.id}
              claseNombre={clase.nombre}
              variant="ghost"
            />
          )}
        </div>

        {sesiones.length === 0 ? (
          <EmptyState
            message="Sin sesiones registradas"
            detail={
              isBecarioOrAdmin
                ? "Agrega la primera sesión para comenzar a registrar asistencias."
                : "Aún no se han registrado sesiones para esta clase."
            }
            action={
              isBecarioOrAdmin ? (
                <FormSesion
                  claseId={clase.id}
                  claseNombre={clase.nombre}
                  variant="primary"
                />
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {sesiones.map((sesion, i) => (
              <div
                key={sesion.id}
                className={`rounded-xl p-5 animate-fade-up ${
                  i < 4 ? `animate-fade-up-delay-${Math.min(i + 2, 4) as 1 | 2 | 3 | 4}` : ""
                }`}
                style={{
                  background: "oklch(0.18 0.032 248)",
                  border: "1px solid oklch(0.28 0.055 248)",
                }}
              >
                {/* Sesion header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {/* Session number pill */}
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
                      style={{
                        background: "oklch(0.72 0.165 72 / 0.15)",
                        color: "oklch(0.72 0.165 72)",
                      }}
                      aria-label={`Sesión ${i + 1}`}
                    >
                      {i + 1}
                    </span>
                    <div
                      className="flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: "oklch(0.88 0.02 80)" }}
                    >
                      <Calendar size={14} strokeWidth={1.8} aria-hidden />
                      <time dateTime={new Date(sesion.fecha).toISOString()}>
                        {formatFecha(sesion.fecha)}
                      </time>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Attendance badge */}
                    <span
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{
                        background: "oklch(0.52 0.17 152 / 0.12)",
                        border: "1px solid oklch(0.52 0.17 152 / 0.30)",
                        color: "oklch(0.72 0.12 152)",
                      }}
                    >
                      <Users size={11} strokeWidth={2} aria-hidden />
                      {sesion._count.asistencias}{" "}
                      {sesion._count.asistencias === 1 ? "asistente" : "asistentes"}
                    </span>

                    {/* Update temas button (BECARIO+) */}
                    {isBecarioOrAdmin && (
                      <Link
                        href={`/sesiones/${sesion.id}/temas`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: "oklch(0.21 0.035 248)",
                          border: "1px solid oklch(0.28 0.055 248)",
                          color: "oklch(0.72 0.06 235)",
                        }}
                        aria-label={`Actualizar temas de la sesión del ${formatFechaCorta(sesion.fecha)}`}
                      >
                        <Pencil size={11} strokeWidth={2} aria-hidden />
                        Temas
                      </Link>
                    )}
                  </div>
                </div>

                {/* Temas & Notas */}
                {(sesion.temas || sesion.notas) ? (
                  <div className="space-y-2 mt-1">
                    {sesion.temas && (
                      <div
                        className="flex items-start gap-2 text-sm"
                        style={{ color: "oklch(0.75 0.05 240)" }}
                      >
                        <FileText
                          size={13}
                          strokeWidth={1.8}
                          className="mt-0.5 shrink-0"
                          style={{ color: "oklch(0.72 0.165 72)" }}
                          aria-hidden
                        />
                        <div>
                          <span
                            className="text-xs font-medium uppercase tracking-wide block mb-0.5"
                            style={{ color: "oklch(0.55 0.05 240)" }}
                          >
                            Temas
                          </span>
                          <p className="leading-relaxed">{sesion.temas}</p>
                        </div>
                      </div>
                    )}
                    {sesion.notas && (
                      <div
                        className="flex items-start gap-2 text-sm"
                        style={{ color: "oklch(0.65 0.05 235)" }}
                      >
                        <StickyNote
                          size={13}
                          strokeWidth={1.8}
                          className="mt-0.5 shrink-0"
                          style={{ color: "oklch(0.64 0.12 220)" }}
                          aria-hidden
                        />
                        <div>
                          <span
                            className="text-xs font-medium uppercase tracking-wide block mb-0.5"
                            style={{ color: "oklch(0.55 0.05 240)" }}
                          >
                            Notas
                          </span>
                          <p className="leading-relaxed">{sesion.notas}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p
                    className="text-xs italic mt-1"
                    style={{ color: "oklch(0.45 0.04 248)" }}
                  >
                    Sin temas ni notas registradas aún
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
