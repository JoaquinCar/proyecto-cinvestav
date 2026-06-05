"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react";

export default function EliminarEdicionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEliminar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ediciones/${params.id}`, { method: "DELETE" });
      if (res.status === 204) {
        router.push("/ediciones");
        router.refresh();
        return;
      }
      const json = await res.json();
      setError(json?.error ?? "Error al eliminar.");
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <Link
          href={`/ediciones/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la edición
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-destructive/10">
            <Trash2 size={18} strokeWidth={1.8} className="text-destructive" aria-hidden />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Eliminar <em className="text-destructive not-italic font-semibold">Edición</em>
          </h1>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <div
        className="animate-fade-up animate-fade-up-delay-2 bg-card border border-destructive/30 rounded-2xl p-6 sm:p-8"
        style={{ maxWidth: "36rem" }}
      >
        <div className="flex items-start gap-3 mb-6">
          <AlertTriangle
            size={20}
            strokeWidth={1.8}
            className="shrink-0 mt-0.5 text-destructive"
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium mb-1 text-foreground">
              Esta acción es irreversible
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Solo se puede eliminar una edición que no tenga participantes inscritos.
              Si tiene inscripciones, la operación será rechazada.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm mb-4 text-destructive bg-destructive/10 border border-destructive/40"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href={`/ediciones/${params.id}`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            Cancelar
          </Link>
          <button
            onClick={handleEliminar}
            disabled={loading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-destructive/15 border border-destructive/50 text-destructive hover:bg-destructive/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden />
            {loading ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </div>
      </div>
    </div>
  );
}
