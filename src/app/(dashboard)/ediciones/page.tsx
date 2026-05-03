import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { EdicionCard, type EdicionCardData } from "@/components/ediciones/EdicionCard";

export const metadata: Metadata = { title: "Ediciones · Pasaporte Científico" };

async function getEdiciones(): Promise<EdicionCardData[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/ediciones`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    // Surface error gracefully — page still renders with empty state
    return [];
  }

  const json = await res.json();

  // Guard against { error: "..." } shape
  if (!Array.isArray(json)) return [];

  return json as EdicionCardData[];
}

export default async function EdicionesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const ediciones = await getEdiciones();

  // Sort: activa first, then descending by year
  const sorted = [...ediciones].sort((a, b) => {
    if (a.activa && !b.activa) return -1;
    if (!a.activa && b.activa) return 1;
    return b.anio - a.anio;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <PageHeader
          title="Ediciones"
          subtitle="Instancias anuales del programa Pasaporte Científico"
          action={
            isAdmin ? (
              <Link
                href="/ediciones/nueva"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all"
                style={{ color: "oklch(0.13 0.028 248)" }}
                aria-label="Crear nueva edición"
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden />
                Nueva Edición
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Cards grid */}
      {sorted.length === 0 ? (
        <div className="animate-fade-up animate-fade-up-delay-2">
          <EmptyState
            message="No hay ediciones registradas aún"
            detail={
              isAdmin
                ? "Crea la primera edición del programa para comenzar."
                : "El administrador aún no ha registrado ninguna edición."
            }
            action={
              isAdmin ? (
                <Link
                  href="/ediciones/nueva"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all"
                  style={{ color: "oklch(0.13 0.028 248)" }}
                >
                  <Plus size={15} strokeWidth={2.5} aria-hidden />
                  Crear primera edición
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          className="grid gap-4 animate-fade-up animate-fade-up-delay-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 22rem), 1fr))",
          }}
        >
          {sorted.map((edicion, i) => (
            <div
              key={edicion.id}
              className={`animate-fade-up ${
                i < 4 ? `animate-fade-up-delay-${Math.min(i + 1, 4)}` : ""
              }`}
            >
              <EdicionCard edicion={edicion} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
