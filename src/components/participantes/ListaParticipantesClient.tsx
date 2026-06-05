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
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
        />
        <Input
          type="text"
          value={query}
          onChange={handleSearchChange}
          placeholder="Filtrar por nombre, escuela…"
          className="pl-9 pr-9 h-11 text-sm w-full rounded-xl bg-muted border border-border focus-visible:ring-primary"
          aria-label="Buscar en la lista"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted transition-colors text-muted-foreground"
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
            <div className="rounded-xl px-4 py-8 text-center text-sm bg-card border border-border text-muted-foreground">
              No hay participantes que coincidan con &ldquo;{query}&rdquo;
            </div>
          )}

          {participantes.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-card border border-border">
              <ul role="list" className="divide-y divide-border">
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
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-muted border border-border text-primary"
                          aria-hidden="true"
                          data-idx={idx}
                        >
                          {p.nombre.charAt(0).toUpperCase()}
                          {p.apellidos.charAt(0).toUpperCase()}
                        </div>

                        {/* Datos */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate text-foreground">
                            {p.nombre} {p.apellidos}
                          </div>
                          <div className="text-xs mt-0.5 truncate text-muted-foreground">
                            {p.escuela}
                            <span className="mx-1.5 text-border">·</span>
                            {p.grado}
                            <span className="mx-1.5 text-border">·</span>
                            <span className="tabular">{p.edad}</span> años
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
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Footer con conteo */}
              <div className="px-4 py-2.5 text-xs border-t border-border text-muted-foreground tabular">
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
