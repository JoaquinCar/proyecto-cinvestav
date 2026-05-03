"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorParticipantesProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorParticipantes({
  error,
  reset,
}: ErrorParticipantesProps) {
  const router = useRouter();

  useEffect(() => {
    // Loguear en consola para debugging (en producción sería Sentry u otro)
    console.error("[ParticipantesPage]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Icono de error */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: "oklch(0.60 0.21 25 / 0.12)",
          border: "1px solid oklch(0.60 0.21 25 / 0.3)",
        }}
      >
        <AlertTriangle
          size={24}
          strokeWidth={1.8}
          style={{ color: "oklch(0.60 0.21 25)" }}
        />
      </div>

      {/* Título */}
      <h2
        className="font-display text-2xl font-medium mb-2"
        style={{ color: "oklch(0.96 0.01 80)" }}
      >
        Error al cargar participantes
      </h2>

      {/* Descripción */}
      <p
        className="text-sm max-w-sm leading-relaxed mb-2"
        style={{ color: "oklch(0.62 0.06 235)" }}
      >
        No fue posible obtener la lista de participantes. Esto puede ser un
        problema temporal de conexión con la base de datos.
      </p>

      {/* Detalle técnico (solo visible en desarrollo) */}
      {process.env.NODE_ENV === "development" && error.message && (
        <pre
          className="mt-3 mb-5 rounded-lg px-4 py-3 text-xs text-left max-w-md w-full overflow-x-auto"
          style={{
            background: "oklch(0.16 0.028 248)",
            border: "1px solid oklch(0.28 0.055 248)",
            color: "oklch(0.60 0.21 25)",
          }}
        >
          {error.message}
          {error.digest && `\n\nDigest: ${error.digest}`}
        </pre>
      )}

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-3 mt-5">
        <Button
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          className="gap-2"
          style={{
            borderColor: "oklch(0.28 0.055 248)",
            color: "oklch(0.75 0.06 235)",
            background: "transparent",
          }}
        >
          <ArrowLeft size={16} />
          Volver
        </Button>

        <Button
          size="lg"
          onClick={reset}
          className="btn-gold gap-2"
          style={{ color: "oklch(0.13 0.028 248)", border: "none" }}
        >
          <RefreshCw size={16} />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
