import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PanelSesiones } from "@/components/clases/PanelSesiones";

export const metadata: Metadata = {
  title: "Eventos especiales · Pasaporte Científico",
};

// ── Página ────────────────────────────────────────────────────────────────────
// Eventos especiales: día del niño, clausura y demás.
//
// El cliente los pidió con su propia entrada en la barra, y esta es. Por dentro
// NO son otra cosa: son el mismo registro que una sesión, con `tipo = EVENTO`.
// Esta página es `PanelSesiones` acotado a ese tipo — una pantalla propia sin
// un modelo propio. El porqué está explicado en PanelSesiones.tsx.
//
// Lo que sí los hace independientes es que un evento puede caer el mismo día
// que una sesión de pasaporte sin estorbarla: son dos registros distintos, cada
// uno con su propia lista de asistencia.

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { edicion } = await searchParams;

  return (
    <PanelSesiones
      edicionParam={edicion}
      esAdmin={session.user.role === "ADMIN"}
      tipoFijo="EVENTO"
    />
  );
}
