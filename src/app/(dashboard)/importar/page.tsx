import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { construirGuias } from "@/lib/importacion/guia";
import { listarEdicionesParaImportar } from "@/server/queries/importacion";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportadorExcel } from "@/components/importacion/ImportadorExcel";

export const metadata: Metadata = {
  title: "Importar desde Excel · Pasaporte Científico",
};

export default async function ImportarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Importar desde Excel"
          subtitle="Carga masiva de participantes, clases y asistencia"
        />
        <div className="h-px bg-border" />
        <EmptyState
          message="Solo el administrador puede importar datos"
          detail="La importación modifica el padrón completo de una edición. Si necesitas cargar un archivo, pídeselo al coordinador general."
        />
      </div>
    );
  }

  const ediciones = await listarEdicionesParaImportar();
  const anioReferencia = ediciones[0]?.anio ?? new Date().getFullYear();
  const guias = construirGuias(anioReferencia);

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader
          title="Importar desde Excel"
          subtitle="Lee la guía del formato, descarga la plantilla y revisa la vista previa antes de confirmar"
        />
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <div className="animate-fade-up animate-fade-up-delay-2">
        <ImportadorExcel guias={guias} ediciones={ediciones} />
      </div>
    </div>
  );
}
