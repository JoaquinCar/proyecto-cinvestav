"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buscarStaff, type Staff } from "@/lib/api/staff";
import { ROL_STAFF_LABEL } from "@/lib/schemas/staff.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Buscador de staff ya capturado.
//
// Mismo patrón que BusquedaAcompanante y BusquedaParticipante, y a propósito:
// es el mismo problema. Un becario estará en veinte sesiones. Si en cada una
// hubiera que teclear su nombre, nacerían veinte fichas —"Rocío Canul", "Rocio
// Canul", "R. Canul"— y la lista de la sesión dejaría de servir para lo que se
// pidió, que es anexarla. La búsqueda es global, sin acotar por edición, porque
// lo que se quiere encontrar es justo a quien ya existe: de este año o del
// anterior.
// ─────────────────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** "Rocío Canul", o solo "Rocío" si no se capturaron apellidos. */
export function nombreCompletoStaff(s: {
  nombre: string;
  apellidos?: string | null;
}): string {
  return [s.nombre, s.apellidos].filter(Boolean).join(" ").trim();
}

interface BusquedaStaffProps {
  onSelect: (staff: Staff) => void;
  placeholder?: string;
  /** Ids ya asignados a esta sesión: se muestran, pero no se pueden repetir. */
  yaAsignados?: string[];
}

export function BusquedaStaff({
  onSelect,
  placeholder = "Buscar por nombre, correo o institución…",
  yaAsignados = [],
}: BusquedaStaffProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ["staff-busqueda", debouncedQuery],
    queryFn: () => buscarStaff(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

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
    setOpen(val.trim().length >= 2);
  }

  function handleSelect(s: Staff) {
    onSelect(s);
    setQuery("");
    setOpen(false);
  }

  const showDropdown = open && debouncedQuery.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full">
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
          aria-label="Buscar persona de staff"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors hover:bg-muted text-muted-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>

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
              Nadie con ese nombre. Captúralo abajo como nuevo.
            </div>
          )}

          {!isFetching && resultados.length > 0 && (
            <ul className="max-h-64 overflow-y-auto py-1">
              {resultados.map((s) => {
                const sesiones = s._count?.sesiones ?? 0;
                const asignado = yaAsignados.includes(s.id);
                return (
                  <li key={s.id} role="option" aria-selected={asignado}>
                    <button
                      type="button"
                      disabled={asignado}
                      className="attendance-item w-full text-left rounded-none border-x-0 border-b border-t-0 last:border-b-0 px-4 py-3 min-h-0 gap-3 border-border disabled:opacity-50"
                      onClick={() => handleSelect(s)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-foreground">
                          {nombreCompletoStaff(s)}
                        </div>
                        <div className="text-xs mt-0.5 truncate text-muted-foreground">
                          {ROL_STAFF_LABEL[s.rol]}
                          {s.institucion ? ` · ${s.institucion}` : ""}
                        </div>
                        {asignado ? (
                          <span className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-muted border border-border text-muted-foreground">
                            Ya está en esta sesión
                          </span>
                        ) : (
                          sesiones > 0 && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-secondary/12 border border-secondary/35 text-secondary-foreground">
                              <CalendarCheck size={10} />
                              En <span className="tabular">{sesiones}</span>
                              {sesiones === 1 ? " sesión" : " sesiones"}
                            </span>
                          )
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
