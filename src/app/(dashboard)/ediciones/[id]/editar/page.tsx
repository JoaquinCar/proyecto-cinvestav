import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { aISOFecha } from "@/lib/fechas";
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
        // `Date.toString()` da «Sat Jan 24 2026 00:00:00 GMT+0000 (…)», que
        // `aISOFecha` rechaza: solo entiende días de calendario «YYYY-MM-DD».
        // Con `.toString()` la pantalla de editar reventaba SIEMPRE, con
        // cualquier edición, antes de llegar a dibujarse.
        fechaInicio: aISOFecha(edicion.fechaInicio),
        fechaFin: aISOFecha(edicion.fechaFin),
        minAsistencias: edicion.minAsistencias,
      }}
    />
  );
}
