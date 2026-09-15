"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buscarAcompanantes, type Acompanante } from "@/lib/api/acompanantes";
import { PARENTESCO_LABEL } from "@/lib/schemas/acompanante.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Buscador de acompañantes ya capturados.
//
// Mismo patrón que BusquedaParticipante, y a propósito: es el mismo problema.
// Si al registrar al segundo hermano hubiera que teclear otra vez los datos de
// la mamá, se crearía una ficha nueva y la vista "a quién acompaña" mostraría
// un hijo en vez de dos. La búsqueda es global —sin acotar por edición— porque
// lo que se quiere encontrar es justo a quien ya existe, sea de este año o de
// hace tres.
// ─────────────────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** "Laura Pérez" o solo "Laura" si no se capturaron apellidos. */
export function nombreCompletoAcompanante(a: {
  nombre: string;
  apellidos?: string | null;
}): string {
  return [a.nombre, a.apellidos].filter(Boolean).join(" ").trim();
}

interface BusquedaAcompananteProps {
  onSelect: (acompanante: Acompanante) => void;
  placeholder?: string;
  /** Texto inicial del campo (por ejemplo, al reabrir el formulario). */
  valorInicial?: string;
}

export function BusquedaAcompanante({
  onSelect,
  placeholder = "Buscar por nombre o teléfono…",
  valorInicial = "",
}: BusquedaAcompananteProps) {
  const [query, setQuery] = useState(valorInicial);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ["acompanantes-busqueda", debouncedQuery],
    queryFn: () => buscarAcompanantes(debouncedQuery),
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

  function handleSelect(a: Acompanante) {
    onSelect(a);
    setQuery(nombreCompletoAcompanante(a));
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
          aria-label="Buscar acompañante"
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
              {resultados.map((a) => {
                const acompanados = a._count?.inscripciones ?? 0;
                return (
                  <li key={a.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="attendance-item w-full text-left rounded-none border-x-0 border-b border-t-0 last:border-b-0 px-4 py-3 min-h-0 gap-3 border-border"
                      onClick={() => handleSelect(a)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-foreground">
                          {nombreCompletoAcompanante(a)}
                        </div>
                        <div className="text-xs mt-0.5 truncate text-muted-foreground">
                          {PARENTESCO_LABEL[a.parentesco]}
                          {a.telefono ? ` · ${a.telefono}` : ""}
                        </div>
                        {acompanados > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-secondary/12 border border-secondary/35 text-secondary-foreground">
                            <Users size={10} />
                            Acompaña a <span className="tabular">{acompanados}</span>
                            {acompanados === 1 ? " niño" : " niños"}
                          </span>
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
