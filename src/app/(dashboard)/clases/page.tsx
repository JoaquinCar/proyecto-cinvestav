import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PanelSesiones } from "@/components/clases/PanelSesiones";

export const metadata: Metadata = {
  title: "Sesiones · Pasaporte Científico",
};

// ── Página ────────────────────────────────────────────────────────────────────
// Panel general de sesiones: aquí se ven todas las de una edición —de los tres
// tipos— y aquí se crean las nuevas. Antes la creación colgaba de la ruta de una
// edición concreta, lo que hacía parecer que se creaba "desde dentro" de otra.
//
// El cuerpo vive en `PanelSesiones` porque /eventos es esta misma pantalla con
// el tipo fijo; ver el comentario de ese archivo.

export default async function ClasesPage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string; tipo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { edicion, tipo } = await searchParams;

  return (
    <PanelSesiones
      edicionParam={edicion}
      tipoParam={tipo}
      esAdmin={session.user.role === "ADMIN"}
    />
  );
}
