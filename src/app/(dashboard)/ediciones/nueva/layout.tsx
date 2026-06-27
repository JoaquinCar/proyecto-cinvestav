import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Gate server-side: solo ADMIN puede crear ediciones. La mutación ya está
// protegida en /api/ediciones, esto evita además renderizar el formulario.
export default async function NuevaEdicionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/ediciones");
  return <>{children}</>;
}
