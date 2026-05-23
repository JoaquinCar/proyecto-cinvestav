import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function ReportesEdicionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  redirect("/estadisticas");
}
