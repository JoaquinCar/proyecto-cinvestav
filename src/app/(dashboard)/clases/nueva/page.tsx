import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listarEdiciones } from "@/server/queries/ediciones";
import { aISOFecha } from "@/lib/fechas";
import { FormNuevaClase } from "./FormNuevaClase";

export const metadata: Metadata = {
  title: "Nueva clase · Pasaporte Científico",
};

export default async function NuevaClasePage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/clases");

  const { edicion: edicionParam } = await searchParams;
  const ediciones = await listarEdiciones();

  // Una clase requiere edición: sin ediciones no hay nada que crear.
  if (ediciones.length === 0) redirect("/ediciones/nueva");

  const edicionInicial =
    ediciones.find((e) => e.id === edicionParam) ??
    ediciones.find((e) => e.activa) ??
    ediciones[0];

  return (
    <FormNuevaClase
      ediciones={ediciones.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        anio: e.anio,
        activa: e.activa,
        fechaInicio: aISOFecha(e.fechaInicio),
        fechaFin: aISOFecha(e.fechaFin),
      }))}
      edicionInicialId={edicionInicial.id}
    />
  );
}
