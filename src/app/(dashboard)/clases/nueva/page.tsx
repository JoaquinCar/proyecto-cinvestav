import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listarEdiciones } from "@/server/queries/ediciones";
import { aISOFecha } from "@/lib/fechas";
import { esTipoSesion, TIPO_SESION_POR_DEFECTO } from "@/lib/tipos-sesion";
import { FormNuevaClase } from "./FormNuevaClase";

export const metadata: Metadata = {
  title: "Nueva sesión · Pasaporte Científico",
};

export default async function NuevaClasePage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string; tipo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/clases");

  const { edicion: edicionParam, tipo: tipoParam } = await searchParams;

  // El tipo llega del botón que trajo aquí: desde /eventos viene EVENTO. Un
  // valor inventado se ignora y se cae al de siempre, como en el listado.
  const tipoInicial = esTipoSesion(tipoParam) ? tipoParam : TIPO_SESION_POR_DEFECTO;
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
      tipoInicial={tipoInicial}
    />
  );
}
