import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";

export default async function ParticipantesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const edicion = await prisma.edicion.findFirst({ where: { activa: true } });
  if (edicion) redirect(`/ediciones/${edicion.id}/participantes`);
  redirect("/ediciones");
}
