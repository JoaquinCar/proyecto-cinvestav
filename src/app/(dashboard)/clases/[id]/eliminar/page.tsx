import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerClasePorId, contarBorradoDeClase } from "@/server/queries/clases";
import { FormEliminarClase } from "./FormEliminarClase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const clase = await obtenerClasePorId(id);
  return {
    title: clase
      ? `Eliminar ${clase.nombre} · Pasaporte Científico`
      : "Eliminar sesión · Pasaporte Científico",
  };
}

export default async function EliminarClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  // Mismo criterio que el endpoint: borrar una sesión es solo de ADMIN. Un
  // becario que llegue por el enlace vuelve a la sesión, sin pantalla muerta.
  if (session.user.role !== "ADMIN") redirect(`/clases/${id}`);

  const clase = await obtenerClasePorId(id);
  if (!clase) notFound();

  const conteos = await contarBorradoDeClase(id);

  const esEvento = clase.tipo === "EVENTO";
  const listadoA = esEvento
    ? `/eventos?edicion=${clase.edicionId}`
    : `/clases?edicion=${clase.edicionId}`;

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <Link
          href={`/clases/${id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la sesión
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-destructive/10">
            <Trash2 size={18} strokeWidth={1.8} className="text-destructive" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground truncate">
              Eliminar{" "}
              <em className="text-destructive not-italic font-semibold">{clase.nombre}</em>
            </h1>
            <p className="text-sm mt-0.5 text-muted-foreground">
              {esEvento ? "Evento especial" : "Sesión"} de la edición
            </p>
          </div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <FormEliminarClase
        clase={{ id: clase.id, nombre: clase.nombre, esEvento }}
        volverA={`/clases/${id}`}
        listadoA={listadoA}
        conteos={conteos}
      />
    </div>
  );
}
