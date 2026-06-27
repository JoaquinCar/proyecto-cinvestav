import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Gate server-side: solo ADMIN puede crear clases.
export default async function NuevaClaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/ediciones");
  return <>{children}</>;
}
