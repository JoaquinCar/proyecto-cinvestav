"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { BotonAsistencia } from "@/components/asistencia/BotonAsistencia";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AsistenciaItem {
  inscripcion: {
    id: string;
    participante: {
      nombre: string;
      apellidos: string;
      escuela: string;
    };
  };
  presente: boolean | null;
}

interface AsistenciaResponse {
  asistencias: AsistenciaItem[];
  resumen: {
    total: number;
    presentes: number;
    ausentes: number;
  };
}

interface BatchPostBody {
  items: Array<{ inscripcionId: string; sesionId: string; presente: boolean }>;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sesionId: string;
  claseNombre: string;
  fecha: string;
  edicionNombre: string;
  readOnly?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ── Sub-component: row skeleton while loading ─────────────────────────────────

function FilaSkeleton() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-4 rounded-xl"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: "1px solid oklch(0.28 0.055 248)",
      }}
    >
      <Skeleton
        className="w-12 h-12 rounded-xl shrink-0"
        style={{ background: "oklch(0.22 0.04 248)" }}
      />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-40 rounded" style={{ background: "oklch(0.22 0.04 248)" }} />
        <Skeleton className="h-3 w-28 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
      </div>
      <Skeleton
        className="h-6 w-20 rounded-full shrink-0"
        style={{ background: "oklch(0.20 0.035 248)" }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ListaAsistencia({
  sesionId,
  readOnly = false,
}: Props) {
  const queryClient = useQueryClient();

  // Server state
  const { data, isLoading, isError } = useQuery<AsistenciaResponse>({
    queryKey: ["asistencia", sesionId],
    queryFn: async () => {
      const res = await fetch(`/api/sesiones/${sesionId}/asistencia`);
      if (!res.ok) throw new Error("Error al cargar asistencias");
      return res.json() as Promise<AsistenciaResponse>;
    },
    staleTime: 30_000,
  });

  // Local optimistic overrides: inscripcionId -> presente
  const [pendientes, setPendientes] = useState<Map<string, boolean>>(new Map());
  // Debounce batch: collect changes to flush after 800ms silence
  const debounceTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendientesRef  = useRef<Map<string, boolean>>(new Map());

  // Search filter
  const [busqueda, setBusqueda] = useState("");

  // ── Mutation ────────────────────────────────────────────────────────────────

  const mutation = useMutation<{ updated: number }, Error, BatchPostBody>({
    mutationFn: async (body) => {
      const res = await fetch("/api/asistencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? "Error al guardar asistencias");
      }
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: () => {
      // After successful save, clear optimistic state and refetch
      setPendientes(new Map());
      pendientesRef.current = new Map();
      void queryClient.invalidateQueries({ queryKey: ["asistencia", sesionId] });
    },
    onError: () => {
      // Rollback: clear pending optimistic updates so UI reverts to server state
      setPendientes(new Map());
      pendientesRef.current = new Map();
    },
  });

  // ── Debounced flush ──────────────────────────────────────────────────────────

  const flushPendientes = useCallback(() => {
    const snap = new Map(pendientesRef.current);
    if (snap.size === 0) return;

    const items = Array.from(snap.entries()).map(([inscripcionId, presente]) => ({
      inscripcionId,
      sesionId,
      presente,
    }));

    mutation.mutate({ items });
  }, [mutation, sesionId]);

  // Schedule a flush 800ms after the last toggle
  const scheduleFlush = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      flushPendientes();
    }, 800);
  }, [flushPendientes]);

  // Flush on unmount so no changes are lost
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      // Flush remaining changes synchronously is not possible on unmount —
      // so we fire-and-forget the final batch if there's anything pending.
      if (pendientesRef.current.size > 0) {
        const items = Array.from(pendientesRef.current.entries()).map(
          ([inscripcionId, presente]) => ({ inscripcionId, sesionId, presente }),
        );
        void fetch("/api/asistencias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
          keepalive: true,
        });
      }
    };
  }, [sesionId]);

  // ── Toggle handler ───────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    (inscripcionId: string, currentPresente: boolean) => {
      if (readOnly) return;

      const nuevoValor = !currentPresente;

      // Update optimistic state
      setPendientes((prev) => {
        const next = new Map(prev);
        next.set(inscripcionId, nuevoValor);
        return next;
      });
      pendientesRef.current.set(inscripcionId, nuevoValor);

      scheduleFlush();
    },
    [readOnly, scheduleFlush],
  );

  // ── Derived state ────────────────────────────────────────────────────────────

  const asistencias = data?.asistencias ?? [];

  // Merge server data with optimistic overrides
  const asistenciasConEstado = asistencias.map((item) => ({
    ...item,
    presente: pendientes.has(item.inscripcion.id)
      ? (pendientes.get(item.inscripcion.id) ?? false)
      : (item.presente ?? false),
  }));

  // Count presentes from merged state
  const totalPresentes = asistenciasConEstado.filter((a) => a.presente).length;
  const totalParticipantes = asistencias.length;

  // Filter by search
  const query = normalizarTexto(busqueda.trim());
  const filtradas = query
    ? asistenciasConEstado.filter((item) => {
        const p = item.inscripcion.participante;
        const texto = normalizarTexto(
          `${p.nombre} ${p.apellidos} ${p.escuela}`,
        );
        return texto.includes(query);
      })
    : asistenciasConEstado;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div
        className="rounded-xl p-6 text-center text-sm"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.60 0.21 25 / 0.35)",
          color: "oklch(0.75 0.10 25)",
        }}
      >
        No se pudo cargar la lista de asistencia. Por favor recarga la página.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Counter bar + save indicator */}
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}
      >
        <div className="flex items-center gap-2">
          <Users
            size={16}
            strokeWidth={1.8}
            style={{ color: "oklch(0.72 0.165 72)" }}
            aria-hidden
          />
          <span className="text-sm" style={{ color: "oklch(0.75 0.06 235)" }}>
            Asistentes
          </span>
        </div>

        <div className="flex items-center gap-3">
          {mutation.isPending && (
            <span
              className="text-xs animate-pulse"
              style={{ color: "oklch(0.62 0.06 235)" }}
              aria-live="polite"
            >
              Guardando…
            </span>
          )}
          {mutation.isError && (
            <span
              className="text-xs"
              style={{ color: "oklch(0.60 0.21 25)" }}
              role="alert"
            >
              Error al guardar
            </span>
          )}

          <span
            className="stat-number text-2xl tabular-nums"
            aria-live="polite"
            aria-label={`${totalPresentes} de ${totalParticipantes} presentes`}
          >
            {isLoading ? (
              <Skeleton
                className="h-7 w-16 rounded inline-block"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
            ) : (
              <span>
                <span style={{ color: "oklch(0.72 0.165 72)" }}>
                  {totalPresentes}
                </span>
                <span
                  className="text-base font-normal mx-1"
                  style={{ color: "oklch(0.45 0.04 248)" }}
                >
                  /
                </span>
                <span style={{ color: "oklch(0.62 0.06 235)" }}>
                  {totalParticipantes}
                </span>
              </span>
            )}
          </span>

          {!isLoading && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: "oklch(0.72 0.165 72 / 0.12)",
                border: "1px solid oklch(0.72 0.165 72 / 0.30)",
                color: "oklch(0.72 0.165 72)",
              }}
            >
              {totalParticipantes > 0
                ? `${Math.round((totalPresentes / totalParticipantes) * 100)}%`
                : "—"}
            </span>
          )}
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search
          size={15}
          strokeWidth={1.8}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "oklch(0.45 0.04 248)" }}
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Buscar por nombre, apellidos o escuela…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9 h-10"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
            color: "oklch(0.88 0.02 80)",
          }}
          aria-label="Buscar participante"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando lista">
          {Array.from({ length: 8 }).map((_, i) => (
            <FilaSkeleton key={i} />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          message={
            busqueda
              ? `Sin resultados para "${busqueda}"`
              : "No hay participantes inscritos en esta edición"
          }
          detail={
            busqueda
              ? "Intenta con otro nombre, apellido o escuela."
              : undefined
          }
        />
      ) : (
        <ul className="space-y-2" aria-label="Lista de asistencia">
          {filtradas.map((item) => {
            const p = item.inscripcion.participante;
            const nombreCompleto = `${p.nombre} ${p.apellidos}`;
            const esPendiente = pendientes.has(item.inscripcion.id);

            return (
              <li
                key={item.inscripcion.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
                style={{
                  background: item.presente
                    ? "oklch(0.52 0.17 152 / 0.07)"
                    : "oklch(0.18 0.032 248)",
                  border: item.presente
                    ? "1px solid oklch(0.52 0.17 152 / 0.25)"
                    : "1px solid oklch(0.28 0.055 248)",
                  minHeight: "64px",
                }}
              >
                {/* Toggle button */}
                <BotonAsistencia
                  presente={item.presente}
                  onToggle={() => handleToggle(item.inscripcion.id, item.presente)}
                  disabled={readOnly || mutation.isPending || esPendiente}
                  nombre={nombreCompleto}
                />

                {/* Participant info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm sm:text-base leading-snug truncate"
                    style={{
                      color: item.presente
                        ? "oklch(0.92 0.02 80)"
                        : "oklch(0.78 0.04 240)",
                    }}
                  >
                    {nombreCompleto}
                  </p>
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ color: "oklch(0.52 0.05 240)" }}
                  >
                    {p.escuela}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium hidden sm:inline-flex"
                  style={
                    item.presente
                      ? {
                          background: "oklch(0.52 0.17 152 / 0.12)",
                          border: "1px solid oklch(0.52 0.17 152 / 0.30)",
                          color: "oklch(0.72 0.12 152)",
                        }
                      : {
                          background: "oklch(0.21 0.035 248)",
                          border: "1px solid oklch(0.28 0.055 248)",
                          color: "oklch(0.45 0.04 248)",
                        }
                  }
                  aria-hidden
                >
                  {item.presente ? "Presente" : "Ausente"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Read-only notice */}
      {readOnly && (
        <p
          className="text-center text-xs mt-2"
          style={{ color: "oklch(0.45 0.04 248)" }}
        >
          Modo solo lectura — no puedes modificar la asistencia
        </p>
      )}
    </div>
  );
}
