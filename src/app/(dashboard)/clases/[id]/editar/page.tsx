import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  obtenerClasePorId,
  listarSesionesDeClase,
  obtenerRangoEdicionDeClase,
} from "@/server/queries/clases";
import { aISOFecha } from "@/lib/fechas";
import { EditarClaseForm } from "./EditarClaseForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const clase = await obtenerClasePorId(id);
  return {
    title: clase
      ? `Editar ${clase.nombre} · Pasaporte Científico`
      : "Editar clase · Pasaporte Científico",
  };
}

export default async function EditarClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  if (session.user.role !== "ADMIN") redirect(`/clases/${id}`);

  const clase = await obtenerClasePorId(id);
  if (!clase) notFound();

  const [fechas, rango] = await Promise.all([
    listarSesionesDeClase(id),
    obtenerRangoEdicionDeClase(id),
  ]);
  if (!rango) notFound();

  return (
    <EditarClaseForm
      clase={{
        id: clase.id,
        nombre: clase.nombre,
        investigador: clase.investigador,
        // Con una sola fecha (el caso real) es la de la clase; con varias, el
        // formulario no la ofrece y cada una se edita desde la propia clase.
        fecha: fechas.length === 1 ? aISOFecha(fechas[0].fecha) : null,
        totalFechas: fechas.length,
      }}
      edicion={{
        fechaInicio: aISOFecha(rango.fechaInicio),
        fechaFin: aISOFecha(rango.fechaFin),
      }}
    />
  );
}
