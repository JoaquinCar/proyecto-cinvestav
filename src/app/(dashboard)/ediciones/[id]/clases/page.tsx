import { redirect } from "next/navigation";

// Las clases se administran desde un único panel general (`/clases`), con un
// selector de edición. Esta ruta se conserva solo para no romper enlaces
// existentes (detalle de edición, hub de asistencia, marcadores del navegador).

export default async function ClasesDeEdicionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clases?edicion=${id}`);
}
