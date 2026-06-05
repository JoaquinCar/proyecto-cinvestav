import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { buscarParticipantes } from "@/server/queries/participantes";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { DrawerRegistro } from "@/components/participantes/DrawerRegistro";
import { ListaParticipantesClient } from "@/components/participantes/ListaParticipantesClient";
import { Users, GraduationCap, Award } from "lucide-react";

// ── Metadata dinámica ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const edicion = await obtenerEdicionPorId(id);
  return { title: edicion ? `Participantes · ${edicion.nombre}` : "Participantes" };
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
    obtenerEdicionPorId(id),
    buscarParticipantes(undefined, id),
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

  const statItems = [
    {
      label: "Inscritos",
      value: participantes.length,
      icon: Users,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      label: "Con constancia",
      value: totalConstancias,
      icon: Award,
      colorClass: "text-success",
      bgClass: "bg-success/10",
    },
    {
      label: "Sin constancia",
      value: participantes.length - totalConstancias,
      icon: GraduationCap,
      colorClass: "text-secondary",
      bgClass: "bg-secondary/10",
    },
  ];

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

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Mini-stats */}
      <div className="grid grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
        {statItems.map(({ label, value, icon: Icon, colorClass, bgClass }) => (
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
                <Icon size={14} strokeWidth={2} className={colorClass} />
              </div>
            </div>
            <div className="stat-number text-4xl tabular">{value}</div>
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
