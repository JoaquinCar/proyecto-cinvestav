import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { EditarEdicionForm } from "./EditarEdicionForm";

export default async function EditarEdicionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/ediciones");

  const { id } = await params;
  const edicion = await obtenerEdicionPorId(id);
  if (!edicion) notFound();

  return (
    <EditarEdicionForm
      edicion={{
        id: edicion.id,
        anio: edicion.anio,
        nombre: edicion.nombre,
        fechaInicio: edicion.fechaInicio.toString(),
        fechaFin: edicion.fechaFin.toString(),
        minAsistencias: edicion.minAsistencias,
        porcentajeMinimo: edicion.porcentajeMinimo,
        asistenciaGlobal: edicion.asistenciaGlobal,
      }}
    />
  );
}
