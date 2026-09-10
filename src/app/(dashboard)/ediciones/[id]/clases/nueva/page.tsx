import { redirect } from "next/navigation";

// La creación de clases vive ahora en el panel general (`/clases/nueva`), no
// dentro de la ruta de una edición concreta. Se conserva el redirect para no
// romper enlaces guardados.

export default async function NuevaClaseDeEdicionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clases/nueva?edicion=${id}`);
}
