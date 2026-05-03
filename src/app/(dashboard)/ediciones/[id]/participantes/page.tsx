import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { DrawerRegistro } from "@/components/participantes/DrawerRegistro";
import { ListaParticipantesClient } from "@/components/participantes/ListaParticipantesClient";
import { Users, GraduationCap, Award } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ParticipanteInscrito {
  id: string;
  nombre: string;
  apellidos: string;
  edad: number;
  escuela: string;
  grado: string;
  createdAt: string;
  inscripciones?: Array<{
    id: string;
    edicion: { id: string; anio: number; nombre: string };
    constanciaGenerada: boolean;
  }>;
}

interface EdicionInfo {
  id: string;
  anio: number;
  nombre: string;
  activa: boolean;
}

// ── Fetch server-side ─────────────────────────────────────────────────────────

async function getEdicion(id: string): Promise<EdicionInfo | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/ediciones/${id}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getParticipantes(edicionId: string): Promise<ParticipanteInscrito[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/participantes?edicionId=${edicionId}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.participantes ?? [];
  } catch {
    return [];
  }
}

// ── Metadata dinámica ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const edicion = await getEdicion(id);
  return {
    title: edicion
      ? `Participantes · ${edicion.nombre}`
      : "Participantes",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ParticipantesEdicionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [edicion, participantes] = await Promise.all([
    getEdicion(id),
    getParticipantes(id),
  ]);

  if (!edicion) {
    return (
      <EmptyState
        message="Edición no encontrada"
        detail="La edición que buscas no existe o fue eliminada."
      />
    );
  }

  const totalConstancias = participantes.filter((p) =>
    p.inscripciones?.some(
      (i) => i.edicion.id === id && i.constanciaGenerada
    )
  ).length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="animate-fade-up">
        <PageHeader
          title={`Participantes · ${edicion.nombre}`}
          subtitle={`${edicion.anio} · ${participantes.length} inscritos`}
          action={
            /* Solo visible en desktop (el FAB cubre móvil) */
            <div className="hidden sm:block">
              <DrawerRegistro edicionId={id} />
            </div>
          }
        />
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Mini-stats */}
      <div
        className="grid grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1"
      >
        {[
          {
            label: "Inscritos",
            value: participantes.length,
            icon: Users,
            color: "oklch(0.72 0.165 72)",
            bg: "oklch(0.72 0.165 72 / 0.1)",
          },
          {
            label: "Con constancia",
            value: totalConstancias,
            icon: Award,
            color: "oklch(0.52 0.17 152)",
            bg: "oklch(0.52 0.17 152 / 0.1)",
          },
          {
            label: "Sin constancia",
            value: participantes.length - totalConstancias,
            icon: GraduationCap,
            color: "oklch(0.64 0.12 220)",
            bg: "oklch(0.64 0.12 220 / 0.1)",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
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
                style={{
                  color: "oklch(0.55 0.05 240)",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={14} strokeWidth={2} style={{ color }} />
              </div>
            </div>
            <div className="stat-number text-4xl">{value}</div>
          </div>
        ))}
      </div>

      {/* Lista con búsqueda en tiempo real (cliente) */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        {participantes.length === 0 ? (
          <EmptyState
            message="Sin participantes inscritos"
            detail="Usa el botón para registrar el primer participante de esta edición."
          />
        ) : (
          <ListaParticipantesClient
            participantesIniciales={participantes}
            edicionId={id}
          />
        )}
      </div>

      {/* FAB flotante — solo móvil */}
      <DrawerRegistro edicionId={id} />
    </div>
  );
}
