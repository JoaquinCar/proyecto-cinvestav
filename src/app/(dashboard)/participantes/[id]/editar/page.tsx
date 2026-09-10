import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import { FormEditarParticipante } from "@/components/participantes/FormEditarParticipante";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const participante = await prisma.participante.findUnique({
    where:  { id },
    select: { nombre: true, apellidos: true },
  });
  if (!participante) return { title: "Editar participante" };
  return {
    title: `Editar · ${participante.nombre} ${participante.apellidos}`,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EditarParticipantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  // Editar y eliminar son de ADMIN. Un BECARIO que llegue por URL vuelve a la
  // ficha en lugar de ver un formulario que el API le va a rechazar.
  if (session.user.role !== "ADMIN") {
    redirect(`/participantes/${id}`);
  }

  const participante = await prisma.participante.findUnique({
    where: { id },
    select: {
      id:        true,
      nombre:    true,
      apellidos: true,
      edad:      true,
      escuela:   true,
      grado:     true,
      genero:    true,
    },
  });

  if (!participante) notFound();

  return (
    <div className="space-y-6 max-w-2xl pb-16">
      <div className="animate-fade-up">
        <Link
          href={`/participantes/${participante.id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden />
          Volver a la ficha
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
            <Pencil size={17} strokeWidth={1.8} className="text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-foreground">
              Editar participante
            </h1>
            <p className="text-sm mt-0.5 truncate text-muted-foreground">
              {participante.nombre} {participante.apellidos}
            </p>
          </div>
        </div>

        <p className="text-sm mt-4 leading-relaxed text-muted-foreground">
          Estos datos son los que se imprimen en la constancia. Corrígelos antes
          de generarla.
        </p>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <div className="animate-fade-up animate-fade-up-delay-2">
        <FormEditarParticipante participante={participante} />
      </div>
    </div>
  );
}
