"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import type { Participante } from "@/components/participantes/BusquedaParticipante";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function fetchParticipantes(q: string, edicionId: string): Promise<Participante[]> {
  const params = new URLSearchParams({ edicionId });
  if (q) params.set("q", q);
  const res = await fetch(`/api/participantes?${params}`);
  if (!res.ok) throw new Error("Error al buscar participantes");
  const data = await res.json();
  return data.participantes ?? [];
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ListaParticipantesClientProps {
  participantesIniciales: Participante[];
  edicionId: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ListaParticipantesClient({
  participantesIniciales,
  edicionId,
}: ListaParticipantesClientProps) {
  const [query, setQuery] = useState("");

  // Debounce manual sin hook externo para evitar stale-closure issues
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    const t = setTimeout(() => setDebouncedQuery(val), 300);
    setDebounceTimer(t);
  }

  function handleClear() {
    setQuery("");
    setDebouncedQuery("");
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  // Solo hace fetch cuando hay texto; si está vacío usa los datos iniciales del server
  const { data: resultadosBusqueda, isFetching } = useQuery({
    queryKey: ["participantes", edicionId, debouncedQuery],
    queryFn: () => fetchParticipantes(debouncedQuery, edicionId),
    enabled: debouncedQuery.trim().length >= 2,
    initialData: debouncedQuery.trim().length < 2 ? participantesIniciales : undefined,
    staleTime: 30_000,
  });

  const participantes =
    debouncedQuery.trim().length >= 2
      ? (resultadosBusqueda ?? participantesIniciales)
      : participantesIniciales;

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "oklch(0.55 0.05 240)" }}
        />
        <Input
          type="text"
          value={query}
          onChange={handleSearchChange}
          placeholder="Filtrar por nombre, escuela…"
          className="pl-9 pr-9 h-11 text-sm w-full"
          style={{
            background: "oklch(0.18 0.032 248)",
            borderColor: "oklch(0.28 0.055 248)",
            color: "oklch(0.96 0.01 80)",
          }}
          aria-label="Buscar en la lista"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-white/10 transition-colors"
            style={{ color: "oklch(0.55 0.05 240)" }}
            aria-label="Limpiar filtro"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Indicador de carga */}
      {isFetching && <TableSkeleton rows={4} />}

      {/* Lista */}
      {!isFetching && (
        <>
          {participantes.length === 0 && (
            <div
              className="rounded-xl px-4 py-8 text-center text-sm"
              style={{
                background: "oklch(0.18 0.032 248)",
                border: "1px solid oklch(0.28 0.055 248)",
                color: "oklch(0.62 0.06 235)",
              }}
            >
              No hay participantes que coincidan con &ldquo;{query}&rdquo;
            </div>
          )}

          {participantes.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "oklch(0.18 0.032 248)",
                border: "1px solid oklch(0.28 0.055 248)",
              }}
            >
              <ul role="list" className="divide-y" style={{ borderColor: "oklch(0.22 0.038 248)" }}>
                {participantes.map((p, idx) => {
                  const inscripcionActual = p.inscripciones?.find(
                    (i) => i.edicion.id === edicionId
                  );
                  const tieneConstancia = inscripcionActual?.constanciaGenerada ?? false;

                  return (
                    <li key={p.id}>
                      <Link
                        href={`/participantes/${p.id}`}
                        className="attendance-item group rounded-none border-0 flex items-center gap-3 sm:gap-4 px-4 py-3.5"
                        aria-label={`Ver perfil de ${p.nombre} ${p.apellidos}`}
                      >
                        {/* Avatar inicial */}
                        <div
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                          style={{
                            background: `oklch(${0.20 + (idx % 5) * 0.02} 0.04 ${200 + (idx % 6) * 15})`,
                            color: "oklch(0.72 0.165 72)",
                            border: "1px solid oklch(0.28 0.055 248)",
                          }}
                          aria-hidden="true"
                        >
                          {p.nombre.charAt(0).toUpperCase()}
                          {p.apellidos.charAt(0).toUpperCase()}
                        </div>

                        {/* Datos */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-medium truncate"
                            style={{ color: "oklch(0.92 0.01 80)" }}
                          >
                            {p.nombre} {p.apellidos}
                          </div>
                          <div
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "oklch(0.62 0.06 235)" }}
                          >
                            {p.escuela}
                            <span
                              className="mx-1.5"
                              style={{ color: "oklch(0.35 0.04 248)" }}
                            >·</span>
                            {p.grado}
                            <span
                              className="mx-1.5"
                              style={{ color: "oklch(0.35 0.04 248)" }}
                            >·</span>
                            {p.edad} años
                          </div>
                        </div>

                        {/* Badge estado */}
                        <div className="shrink-0 flex items-center gap-2">
                          {tieneConstancia ? (
                            <EstadoBadge estado="constancia" />
                          ) : (
                            <EstadoBadge estado="en-progreso" />
                          )}
                          <ChevronRight
                            size={16}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: "oklch(0.55 0.05 240)" }}
                            aria-hidden="true"
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Footer con conteo */}
              <div
                className="px-4 py-2.5 text-xs"
                style={{
                  borderTop: "1px solid oklch(0.22 0.038 248)",
                  color: "oklch(0.52 0.05 240)",
                }}
              >
                {participantes.length} participante{participantes.length !== 1 ? "s" : ""}
                {debouncedQuery && ` · resultado${participantes.length !== 1 ? "s" : ""} para "${debouncedQuery}"`}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
