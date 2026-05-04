import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { obtenerHistorialParticipante } from "@/server/queries/participantes";
import { PageHeader } from "@/components/shared/PageHeader";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import {
  GraduationCap,
  School,
  Calendar,
  Download,
  ArrowLeft,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const participante = await obtenerHistorialParticipante(id);
  if (!participante) return { title: "Participante" };
  return {
    title: `${participante.nombre} ${participante.apellidos} · Historial`,
  };
}

// ── Componente: Item de timeline ──────────────────────────────────────────────

type InscripcionTimeline = {
  id: string;
  constanciaGenerada: boolean;
  constanciaUrl?: string | null;
  edicion: { id: string; anio: number; nombre: string; activa: boolean };
  asistencias: unknown[];
};

function TimelineItem({
  inscripcion,
  isLast,
}: {
  inscripcion: InscripcionTimeline;
  isLast: boolean;
}) {
  const asistencias = inscripcion.asistencias.length;

  return (
    <div className="relative flex gap-4">
      {/* Línea vertical + ícono */}
      <div className="flex flex-col items-center">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10"
          style={{
            background: inscripcion.constanciaGenerada
              ? "oklch(0.52 0.17 152 / 0.15)"
              : "oklch(0.72 0.165 72 / 0.1)",
            border: `1.5px solid ${
              inscripcion.constanciaGenerada
                ? "oklch(0.52 0.17 152 / 0.5)"
                : "oklch(0.72 0.165 72 / 0.35)"
            }`,
          }}
        >
          {inscripcion.constanciaGenerada ? (
            <CheckCircle2
              size={17}
              style={{ color: "oklch(0.52 0.17 152)" }}
            />
          ) : (
            <Circle
              size={17}
              style={{ color: "oklch(0.72 0.165 72)" }}
            />
          )}
        </div>
        {!isLast && (
          <div
            className="flex-1 w-0.5 my-1"
            style={{ background: "oklch(0.24 0.04 248)" }}
          />
        )}
      </div>

      {/* Contenido */}
      <div
        className="flex-1 rounded-xl p-4 mb-4"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-display text-lg font-medium"
                style={{ color: "oklch(0.96 0.01 80)" }}
              >
                {inscripcion.edicion.nombre}
              </span>
              {inscripcion.edicion.activa && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "oklch(0.52 0.17 152 / 0.12)",
                    border: "1px solid oklch(0.52 0.17 152 / 0.35)",
                    color: "oklch(0.72 0.12 152)",
                  }}
                >
                  Actual
                </span>
              )}
            </div>
            <p
              className="text-xs mt-1"
              style={{ color: "oklch(0.62 0.06 235)" }}
            >
              <Calendar
                size={11}
                className="inline mr-1 -mt-0.5"
              />
              {inscripcion.edicion.anio}
              {asistencias > 0 && (
                <>
                  <span className="mx-1.5" style={{ color: "oklch(0.35 0.04 248)" }}>·</span>
                  {asistencias} asistencia{asistencias !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {inscripcion.constanciaGenerada ? (
              <EstadoBadge estado="constancia" />
            ) : (
              <EstadoBadge estado="en-progreso" />
            )}

            {inscripcion.constanciaGenerada && inscripcion.constanciaUrl && (
              <a
                href={inscripcion.constanciaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80 min-h-[44px] sm:min-h-0"
                style={{
                  background: "oklch(0.52 0.17 152 / 0.12)",
                  border: "1px solid oklch(0.52 0.17 152 / 0.35)",
                  color: "oklch(0.72 0.12 152)",
                }}
                aria-label={`Descargar constancia ${inscripcion.edicion.nombre}`}
              >
                <Download size={13} />
                Constancia
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ParticipanteHistorialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const participante = await obtenerHistorialParticipante(id);

  if (!participante) notFound();

  // Ordenar inscripciones del más reciente al más antiguo
  const inscripcionesOrdenadas = [...participante.inscripciones].sort(
    (a, b) => b.edicion.anio - a.edicion.anio
  );

  const edicionActual = inscripcionesOrdenadas.find(
    (i) => i.edicion.activa
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Link
        href={edicionActual ? `/ediciones/${edicionActual.edicion.id}/participantes` : "/participantes"}
        className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
        style={{ color: "oklch(0.62 0.06 235)" }}
      >
        <ArrowLeft size={15} />
        Volver a la lista
      </Link>

      {/* Cabecera del participante */}
      <div className="animate-fade-up">
        {/* Avatar grande */}
        <div className="flex items-start gap-5">
          <div
            className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold"
            style={{
              background: "oklch(0.72 0.165 72 / 0.1)",
              border: "1px solid oklch(0.72 0.165 72 / 0.3)",
              color: "oklch(0.72 0.165 72)",
              fontFamily: "var(--font-crimson)",
            }}
            aria-hidden="true"
          >
            {participante.nombre.charAt(0).toUpperCase()}
            {participante.apellidos.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h1
              className="font-display text-3xl font-light leading-tight"
              style={{ color: "oklch(0.96 0.01 80)" }}
            >
              {participante.nombre}{" "}
              <span style={{ color: "oklch(0.72 0.165 72)" }}>
                {participante.apellidos}
              </span>
            </h1>

            {/* Metadatos */}
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm"
              style={{ color: "oklch(0.62 0.06 235)" }}
            >
              <span className="flex items-center gap-1.5">
                <School size={14} />
                {participante.escuela}
              </span>
              <span className="flex items-center gap-1.5">
                <GraduationCap size={14} />
                {participante.grado}
              </span>
              <span
                className="flex items-center gap-1.5"
                aria-label={`${participante.edad} años`}
              >
                <Calendar size={14} />
                {participante.edad} años
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
        {[
          {
            label: "Ediciones",
            value: inscripcionesOrdenadas.length,
            color: "oklch(0.72 0.165 72)",
          },
          {
            label: "Constancias",
            value: inscripcionesOrdenadas.filter((i) => i.constanciaGenerada).length,
            color: "oklch(0.52 0.17 152)",
          },
          {
            label: "Asistencias totales",
            value: inscripcionesOrdenadas.reduce(
              (acc, i) => acc + (i.asistencias?.length ?? 0),
              0
            ),
            color: "oklch(0.64 0.12 220)",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{
                color: "oklch(0.55 0.05 240)",
                letterSpacing: "0.07em",
              }}
            >
              {label}
            </p>
            <p
              className="stat-number text-4xl mt-2"
              style={{ color }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Timeline de ediciones */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <h2
          className="text-sm font-semibold mb-4 uppercase tracking-wide"
          style={{
            color: "oklch(0.55 0.05 240)",
            letterSpacing: "0.07em",
          }}
        >
          Historial de participación
        </h2>

        {inscripcionesOrdenadas.length === 0 ? (
          <div
            className="rounded-xl px-4 py-8 text-center text-sm"
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
              color: "oklch(0.62 0.06 235)",
            }}
          >
            Sin inscripciones registradas
          </div>
        ) : (
          <div>
            {inscripcionesOrdenadas.map((inscripcion, idx) => (
              <TimelineItem
                key={inscripcion.id}
                inscripcion={inscripcion}
                isLast={idx === inscripcionesOrdenadas.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
