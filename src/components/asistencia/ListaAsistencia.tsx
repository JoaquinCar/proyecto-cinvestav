"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { mensajeDeError, MENSAJE_SIN_CONEXION } from "@/lib/api/errores";
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
    <div className="flex items-center gap-4 px-4 py-4 rounded-xl bg-card border border-border">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0 bg-muted" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-40 rounded bg-muted" />
        <Skeleton className="h-3 w-28 rounded bg-muted" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full shrink-0 bg-muted" />
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
  const { data, isLoading, isError, error } = useQuery<AsistenciaResponse>({
    queryKey: ["asistencia", sesionId],
    queryFn: async () => {
      const res = await fetch(`/api/sesiones/${sesionId}/asistencia`);
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          cuerpo.error ??
            "No se pudo cargar la lista de asistencia. Revisa tu conexión y vuelve a intentarlo.",
        );
      }
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
      let res: Response;
      try {
        res = await fetch("/api/asistencias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // La petición no salió del teléfono: pasar lista en el aula, con mala
        // señal, es justo el caso en el que esto ocurre.
        throw new Error(
          `${MENSAJE_SIN_CONEXION} Las marcas que hiciste se deshicieron: vuelve a marcarlas cuando tengas señal.`,
        );
      }
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errorData.error ??
            "No se pudo guardar la asistencia y las marcas se deshicieron. Vuelve a marcarlas e inténtalo de nuevo.",
        );
      }
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (_data, variables) => {
      // Escribir los valores guardados directo en el cache (sin refetch → sin parpadeo)
      const saved = new Map(variables.items.map((i) => [i.inscripcionId, i.presente]));
      queryClient.setQueryData<AsistenciaResponse>(["asistencia", sesionId], (old) => {
        if (!old) return old;
        const asistencias = old.asistencias.map((a) =>
          saved.has(a.inscripcion.id)
            ? { ...a, presente: saved.get(a.inscripcion.id)! }
            : a,
        );
        const presentes = asistencias.filter((a) => a.presente).length;
        return {
          asistencias,
          resumen: { total: asistencias.length, presentes, ausentes: asistencias.length - presentes },
        };
      });
      // Limpiar solo los pendientes ya guardados que siguen coincidiendo
      // (conserva toggles hechos mientras la petición viajaba)
      const clear = (prev: Map<string, boolean>) => {
        const next = new Map(prev);
        for (const it of variables.items) {
          if (next.get(it.inscripcionId) === it.presente) next.delete(it.inscripcionId);
        }
        return next;
      };
      setPendientes((prev) => clear(prev));
      pendientesRef.current = clear(pendientesRef.current);
    },
    onError: (error) => {
      // Rollback: descartar optimismo para volver al estado del servidor.
      //
      // Este rollback era MUDO: las palomitas volvían solas a su sitio y nadie
      // se enteraba de que la lista no se había guardado. En campo eso significa
      // dar por registrada una asistencia que no existe, así que el aviso es
      // obligatorio y dice explícitamente que hay que volver a marcar.
      setPendientes(new Map());
      pendientesRef.current = new Map();
      toast.error(
        mensajeDeError(
          error,
          "No se pudo guardar la asistencia y las marcas se deshicieron. Vuelve a marcarlas e inténtalo de nuevo.",
        ),
        { duration: 10_000 },
      );
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
    }, 400);
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
        // Último envío al salir de la pantalla. Si falla, el aviso todavía se
        // ve mientras no se cierre la pestaña: antes se perdía sin rastro.
        void fetch("/api/asistencias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
          keepalive: true,
        })
          .then(async (res) => {
            if (res.ok) return;
            const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
            toast.error(
              cuerpo.error ??
                "Las últimas marcas de asistencia no se guardaron al salir de la lista. Vuelve a abrirla y márcalas de nuevo.",
              { duration: 10_000 },
            );
          })
          .catch(() => {
            toast.error(
              `${MENSAJE_SIN_CONEXION} Las últimas marcas de asistencia no se guardaron: vuelve a abrir la lista y márcalas de nuevo.`,
              { duration: 10_000 },
            );
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
        className="rounded-2xl p-6 text-center text-sm bg-destructive/10 border border-destructive/40 text-destructive"
        role="alert"
      >
        {mensajeDeError(
          error,
          "No se pudo cargar la lista de asistencia. Revisa tu conexión y vuelve a cargar la página.",
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Counter bar + save indicator */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2">
          <Users
            size={16}
            strokeWidth={1.8}
            className="text-primary"
            aria-hidden
          />
          <span className="text-sm text-foreground">Asistentes</span>
        </div>

        <div className="flex items-center gap-3">
          {mutation.isPending && (
            <span
              className="text-xs animate-pulse text-muted-foreground"
              aria-live="polite"
            >
              Guardando…
            </span>
          )}
          {mutation.isError && (
            <span
              className="text-xs text-destructive"
              role="alert"
            >
              Sin guardar
            </span>
          )}

          <span
            className="stat-number text-2xl tabular"
            aria-live="polite"
            aria-label={`${totalPresentes} de ${totalParticipantes} presentes`}
          >
            {isLoading ? (
              <Skeleton className="h-7 w-16 rounded inline-block bg-muted" />
            ) : (
              <span>
                <span className="text-success">{totalPresentes}</span>
                <span className="text-base font-normal mx-1 text-muted-foreground">/</span>
                <span className="text-muted-foreground">{totalParticipantes}</span>
              </span>
            )}
          </span>

          {!isLoading && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-primary/10 border border-primary/30 text-primary">
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
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Buscar por nombre, apellidos o escuela…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9 h-10 bg-surface-alt border-border text-foreground focus:border-primary focus:ring-primary"
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

            return (
              <li
                key={item.inscripcion.id}
                className={`attendance-item${item.presente ? " presente" : ""}`}
              >
                {/* Toggle button */}
                <BotonAsistencia
                  presente={item.presente}
                  onToggle={() => handleToggle(item.inscripcion.id, item.presente)}
                  disabled={readOnly}
                  nombre={nombreCompleto}
                />

                {/* Participant info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-semibold text-sm sm:text-base leading-snug truncate ${
                      item.presente ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {nombreCompleto}
                  </p>
                  <p className="text-xs mt-0.5 truncate text-muted-foreground">
                    {p.escuela}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium hidden sm:inline-flex ${
                    item.presente
                      ? "bg-success/10 border border-success/30 text-success"
                      : "bg-muted border border-border text-muted-foreground"
                  }`}
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
        <p className="text-center text-xs mt-2 text-muted-foreground">
          Modo solo lectura — no puedes modificar la asistencia
        </p>
      )}
    </div>
  );
}
