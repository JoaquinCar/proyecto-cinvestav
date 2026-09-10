import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { MobileBottomNav } from "@/components/layout/MobileNavItemClient";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // El rol decide qué entradas de navegación se ven (la importación es de ADMIN).
  const session = await auth();
  const esAdmin = session?.user.role === "ADMIN";

  // El badge de la barra superior mostraba "Edición 2026" escrito a mano. El
  // año sale ahora de la edición activa.
  const edicionActiva = await prisma.edicion.findFirst({
    where: { activa: true },
    select: { anio: true },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar esAdmin={esAdmin} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar anioEdicionActiva={edicionActiva?.anio ?? null} />
        {/* Extra bottom padding on mobile so content isn't hidden behind the fixed bottom nav */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-[calc(1.5rem+4.5rem)] lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — self-contained client component */}
      <MobileBottomNav />
    </div>
  );
}
