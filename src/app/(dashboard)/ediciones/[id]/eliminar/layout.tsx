import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Gate server-side: solo ADMIN puede eliminar ediciones.
export default async function EliminarEdicionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/ediciones");
  return <>{children}</>;
}
