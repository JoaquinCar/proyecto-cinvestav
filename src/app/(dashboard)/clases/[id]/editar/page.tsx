import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerClasePorId } from "@/server/queries/clases";
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

  return (
    <EditarClaseForm
      clase={{
        id: clase.id,
        nombre: clase.nombre,
        investigador: clase.investigador,
      }}
    />
  );
}
