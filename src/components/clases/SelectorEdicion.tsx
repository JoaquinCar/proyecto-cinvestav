"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Layers } from "lucide-react";

export interface EdicionOpcion {
  id: string;
  nombre: string;
  anio: number;
  activa: boolean;
}

interface SelectorEdicionProps {
  ediciones: EdicionOpcion[];
  edicionActualId: string;
  /** Ruta base a la que se navega al cambiar de edición. */
  basePath?: string;
}

/**
 * Selector de edición del panel general de clases. Usa un `<select>` nativo
 * porque en teléfono abre el selector del sistema, que es más cómodo en campo.
 */
export function SelectorEdicion({
  ediciones,
  edicionActualId,
  basePath = "/clases",
}: SelectorEdicionProps) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  if (ediciones.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <label
        htmlFor="selector-edicion"
        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground shrink-0"
      >
        <Layers size={13} strokeWidth={2} aria-hidden />
        Edición
      </label>
      <select
        id="selector-edicion"
        value={edicionActualId}
        disabled={pendiente}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(() => {
            router.push(`${basePath}?edicion=${id}`);
          });
        }}
        className="flex-1 sm:flex-none min-h-[44px] rounded-xl bg-muted border border-border text-sm text-foreground px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 ring-primary disabled:opacity-60"
      >
        {ediciones.map((edicion) => (
          <option key={edicion.id} value={edicion.id}>
            {edicion.nombre} · {edicion.anio}
            {edicion.activa ? " (activa)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
