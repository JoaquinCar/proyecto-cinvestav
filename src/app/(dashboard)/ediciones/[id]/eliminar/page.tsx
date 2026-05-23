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
        <Link href={`/ediciones/${params.id}`} className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors" style={{ color: "oklch(0.62 0.06 235)" }}>
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la edición
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.60 0.21 25 / 0.12)" }}>
            <Trash2 size={18} strokeWidth={1.8} style={{ color: "oklch(0.72 0.16 25)" }} aria-hidden />
          </div>
          <h1 className="font-display text-3xl font-light" style={{ color: "oklch(0.96 0.01 80)" }}>
            Eliminar <em style={{ color: "oklch(0.72 0.16 25)" }}>Edición</em>
          </h1>
        </div>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      <div className="animate-fade-up animate-fade-up-delay-2 rounded-xl p-6 sm:p-8" style={{ background: "oklch(0.18 0.032 248)", border: "1px solid oklch(0.60 0.21 25 / 0.3)", maxWidth: "36rem" }}>
        <div className="flex items-start gap-3 mb-6">
          <AlertTriangle size={20} strokeWidth={1.8} className="shrink-0 mt-0.5" style={{ color: "oklch(0.72 0.16 25)" }} aria-hidden />
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.88 0.02 80)" }}>
              Esta acción es irreversible
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.62 0.06 235)" }}>
              Solo se puede eliminar una edición que no tenga participantes inscritos.
              Si tiene inscripciones, la operación será rechazada.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm mb-4" role="alert" style={{ background: "oklch(0.60 0.21 25 / 0.12)", border: "1px solid oklch(0.60 0.21 25 / 0.4)", color: "oklch(0.75 0.15 25)" }}>
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
          <Link href={`/ediciones/${params.id}`} className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "oklch(0.21 0.035 248)", border: "1px solid oklch(0.28 0.055 248)", color: "oklch(0.68 0.05 240)" }}>
            Cancelar
          </Link>
          <button onClick={handleEliminar} disabled={loading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "oklch(0.60 0.21 25 / 0.15)", border: "1px solid oklch(0.60 0.21 25 / 0.5)", color: "oklch(0.75 0.15 25)" }}>
            <Trash2 size={15} strokeWidth={2} aria-hidden />
            {loading ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </div>
      </div>
    </div>
  );
}
