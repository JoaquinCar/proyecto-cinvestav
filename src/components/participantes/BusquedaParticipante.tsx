"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Participante {
  id: string;
  nombre: string;
  apellidos: string;
  edad: number;
  escuela: string;
  grado: string;
  createdAt: Date | string;
  inscripciones?: Array<{
    id: string;
    edicion: { id: string; anio: number; nombre: string; activa?: boolean };
    constanciaGenerada: boolean;
  }>;
}

interface BusquedaParticipanteProps {
  edicionId: string;
  /** Llamado cuando el usuario selecciona un participante existente */
  onSelect: (participante: Participante) => void;
  /** Llamado cuando el texto de búsqueda cambia (para pre-llenar nombre) */
  onQueryChange?: (q: string) => void;
  placeholder?: string;
}

// ── Hook de búsqueda con debounce ────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function fetchParticipantes(q: string, edicionId: string): Promise<Participante[]> {
  const params = new URLSearchParams({ q, edicionId });
  const res = await fetch(`/api/participantes?${params}`);
  if (!res.ok) throw new Error("Error al buscar participantes");
  const data = await res.json();
  return data.participantes ?? [];
}

// ── Badge de ediciones anteriores ────────────────────────────────────────────

function BadgeAnterior({ anios }: { anios: number[] }) {
  if (anios.length === 0) return null;
  const label =
    anios.length === 1
      ? `Ya participó en ${anios[0]}`
      : `Participó en ${anios.join(", ")}`;
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-secondary/12 border border-secondary/35 text-secondary-foreground">
      <Clock size={10} />
      {label}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function BusquedaParticipante({
  edicionId,
  onSelect,
  onQueryChange,
  placeholder = "Buscar por nombre o apellidos…",
}: BusquedaParticipanteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ["participantes-busqueda", debouncedQuery, edicionId],
    queryFn: () => fetchParticipantes(debouncedQuery, edicionId),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    onQueryChange?.(val);
    setOpen(val.trim().length >= 2);
  }

  function handleSelect(p: Participante) {
    onSelect(p);
    setQuery(`${p.nombre} ${p.apellidos}`);
    setOpen(false);
  }

  function handleClear() {
    setQuery("");
    onQueryChange?.("");
    setOpen(false);
  }

  const showDropdown = open && debouncedQuery.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
        />
        <Input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-9 h-11 text-sm rounded-xl bg-muted border border-border focus-visible:ring-primary"
          aria-label="Buscar participante"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors hover:bg-muted text-muted-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-2xl overflow-hidden bg-card border border-border shadow-lg"
        >
          {isFetching && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Buscando…
            </div>
          )}

          {!isFetching && resultados.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No se encontraron participantes con ese nombre
            </div>
          )}

          {!isFetching && resultados.length > 0 && (
            <ul className="max-h-64 overflow-y-auto py-1">
              {resultados.map((p) => {
                const aniosAnteriores =
                  p.inscripciones?.map((i) => i.edicion.anio) ?? [];
                return (
                  <li key={p.id} role="option">
                    <button
                      type="button"
                      className="attendance-item w-full text-left rounded-none border-x-0 border-b border-t-0 last:border-b-0 px-4 py-3 min-h-0 gap-3 border-border"
                      onClick={() => handleSelect(p)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-foreground">
                          {p.nombre} {p.apellidos}
                        </div>
                        <div className="text-xs mt-0.5 truncate text-muted-foreground">
                          {p.escuela} · {p.grado} · <span className="tabular">{p.edad}</span> años
                        </div>
                        {aniosAnteriores.length > 0 && (
                          <div className="mt-1.5">
                            <BadgeAnterior anios={aniosAnteriores} />
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
