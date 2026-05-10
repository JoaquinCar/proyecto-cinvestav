"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, UserCheck } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BusquedaParticipante,
  type Participante,
} from "@/components/participantes/BusquedaParticipante";

// ── Schema de validación ──────────────────────────────────────────────────────

const formSchema = z.object({
  nombre:    z.string().min(1, "Nombre requerido").max(100).trim(),
  apellidos: z.string().min(1, "Apellidos requeridos").max(100).trim(),
  edad:      z
    .number({ error: "Edad requerida" })
    .int()
    .min(5, "Mínimo 5 años")
    .max(18, "Máximo 18 años"),
  escuela:   z.string().min(1, "Escuela requerida").max(200).trim(),
  grado:     z.string().min(1, "Grado requerido"),
});

type FormValues = z.infer<typeof formSchema>;

const GRADOS = [
  "1° primaria",
  "2° primaria",
  "3° primaria",
  "4° primaria",
  "5° primaria",
  "6° primaria",
] as const;

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function fieldStyle(hasError: boolean): React.CSSProperties {
  return {
    background: "oklch(0.16 0.030 248)",
    borderColor: hasError ? "oklch(0.60 0.21 25)" : "oklch(0.28 0.055 248)",
    color: "oklch(0.96 0.01 80)",
  };
}

const labelStyle: React.CSSProperties = { color: "oklch(0.75 0.06 235)" };
const errorStyle: React.CSSProperties = { color: "oklch(0.60 0.21 25)" };

// ── Funciones API ─────────────────────────────────────────────────────────────

async function crearParticipante(data: FormValues): Promise<Participante> {
  const res = await fetch("/api/participantes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al crear participante");
  }
  return res.json();
}

async function crearInscripcion(participanteId: string, edicionId: string) {
  const res = await fetch("/api/inscripciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participanteId, edicionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al inscribir participante");
  }
  return res.json();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FormRegistroProps {
  edicionId: string;
  onSuccess?: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FormRegistro({ edicionId, onSuccess }: FormRegistroProps) {
  const queryClient = useQueryClient();
  const [participanteExistente, setParticipanteExistente] =
    useState<Participante | null>(null);
  const [modoExistente, setModoExistente] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  // Mutación: flujo nuevo participante → inscripción
  const mutacionNuevo = useMutation({
    mutationFn: async (data: FormValues) => {
      const participante = await crearParticipante(data);
      await crearInscripcion(participante.id, edicionId);
    },
    onSuccess: () => {
      toast.success("Participante registrado e inscrito correctamente");
      queryClient.invalidateQueries({ queryKey: ["participantes", edicionId] });
      reset();
      setParticipanteExistente(null);
      setModoExistente(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Mutación: flujo inscribir existente
  const mutacionExistente = useMutation({
    mutationFn: () =>
      crearInscripcion(participanteExistente!.id, edicionId),
    onSuccess: () => {
      toast.success("Participante inscrito en esta edición");
      queryClient.invalidateQueries({ queryKey: ["participantes", edicionId] });
      reset();
      setParticipanteExistente(null);
      setModoExistente(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const isLoading = mutacionNuevo.isPending || mutacionExistente.isPending;

  // Al seleccionar un participante del buscador
  function handleSelectExistente(p: Participante) {
    setParticipanteExistente(p);
    setModoExistente(true);
    // Pre-llenar campos por si el usuario quiere ver los datos
    setValue("nombre", p.nombre);
    setValue("apellidos", p.apellidos);
    setValue("edad", p.edad);
    setValue("escuela", p.escuela);
    setValue("grado", p.grado);
  }

  function handleDescartarExistente() {
    setParticipanteExistente(null);
    setModoExistente(false);
    reset();
  }

  function onSubmit(data: FormValues) {
    if (modoExistente && participanteExistente) {
      mutacionExistente.mutate();
    } else {
      mutacionNuevo.mutate(data);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

      {/* Búsqueda de participante existente */}
      {!modoExistente && (
        <div className="space-y-2">
          <Label className="text-sm font-medium" style={labelStyle}>
            ¿El participante ya estuvo en ediciones anteriores?
          </Label>
          <BusquedaParticipante
            edicionId={edicionId}
            onSelect={handleSelectExistente}
            placeholder="Buscar por nombre o apellidos…"
          />
          <p className="text-xs" style={{ color: "oklch(0.52 0.05 240)" }}>
            Si ya participó antes, selecciónalo para evitar duplicados.
            Si es nuevo, llena el formulario de abajo.
          </p>
        </div>
      )}

      {/* Banner: participante existente seleccionado */}
      {modoExistente && participanteExistente && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{
            background: "oklch(0.72 0.165 72 / 0.08)",
            border: "1px solid oklch(0.72 0.165 72 / 0.3)",
          }}
        >
          <div
            className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.72 0.165 72 / 0.15)" }}
          >
            <UserCheck size={16} style={{ color: "oklch(0.72 0.165 72)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium"
              style={{ color: "oklch(0.85 0.08 72)" }}
            >
              Participante encontrado
            </p>
            <p
              className="text-sm mt-0.5 truncate"
              style={{ color: "oklch(0.72 0.165 72)" }}
            >
              {participanteExistente.nombre} {participanteExistente.apellidos}
            </p>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "oklch(0.62 0.06 235)" }}
            >
              {participanteExistente.escuela} · {participanteExistente.grado}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDescartarExistente}
            className="text-xs underline underline-offset-2 shrink-0 mt-0.5 transition-opacity hover:opacity-70"
            style={{ color: "oklch(0.62 0.06 235)" }}
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Separador visual */}
      {!modoExistente && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "oklch(0.22 0.038 248)" }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: "oklch(0.45 0.04 248)" }}>
            O registra nuevo
          </span>
          <div className="flex-1 h-px" style={{ background: "oklch(0.22 0.038 248)" }} />
        </div>
      )}

      {/* Campos del formulario (siempre visibles para nuevo; en solo lectura implícito para existente) */}
      <fieldset disabled={modoExistente} className="space-y-4">
        {/* Nombre + Apellidos — row en desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-nombre" className="text-sm font-medium" style={labelStyle}>
              Nombre(s) <span style={{ color: "oklch(0.60 0.21 25)" }}>*</span>
            </Label>
            <Input
              id="reg-nombre"
              type="text"
              autoComplete="given-name"
              placeholder="Ej. María"
              {...register("nombre")}
              style={fieldStyle(!!errors.nombre)}
              className="h-11 transition-colors"
            />
            {errors.nombre && (
              <p className="text-xs" style={errorStyle}>{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-apellidos" className="text-sm font-medium" style={labelStyle}>
              Apellidos <span style={{ color: "oklch(0.60 0.21 25)" }}>*</span>
            </Label>
            <Input
              id="reg-apellidos"
              type="text"
              autoComplete="family-name"
              placeholder="Ej. García López"
              {...register("apellidos")}
              style={fieldStyle(!!errors.apellidos)}
              className="h-11 transition-colors"
            />
            {errors.apellidos && (
              <p className="text-xs" style={errorStyle}>{errors.apellidos.message}</p>
            )}
          </div>
        </div>

        {/* Edad + Grado — row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-edad" className="text-sm font-medium" style={labelStyle}>
              Edad <span style={{ color: "oklch(0.60 0.21 25)" }}>*</span>
            </Label>
            <Input
              id="reg-edad"
              type="number"
              min={5}
              max={18}
              placeholder="10"
              {...register("edad", { valueAsNumber: true })}
              style={fieldStyle(!!errors.edad)}
              className="h-11 transition-colors"
            />
            {errors.edad && (
              <p className="text-xs" style={errorStyle}>{errors.edad.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={labelStyle}>
              Grado <span style={{ color: "oklch(0.60 0.21 25)" }}>*</span>
            </Label>
            <Controller
              name="grado"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className="h-11 w-full"
                    style={fieldStyle(!!errors.grado)}
                    aria-label="Seleccionar grado"
                  >
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADOS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.grado && (
              <p className="text-xs" style={errorStyle}>{errors.grado.message}</p>
            )}
          </div>
        </div>

        {/* Escuela */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-escuela" className="text-sm font-medium" style={labelStyle}>
            Escuela <span style={{ color: "oklch(0.60 0.21 25)" }}>*</span>
          </Label>
          <Input
            id="reg-escuela"
            type="text"
            placeholder="Ej. Primaria José María Morelos"
            {...register("escuela")}
            style={fieldStyle(!!errors.escuela)}
            className="h-11 transition-colors"
          />
          {errors.escuela && (
            <p className="text-xs" style={errorStyle}>{errors.escuela.message}</p>
          )}
        </div>
      </fieldset>

      {/* Botón de envío */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-12 font-semibold text-sm btn-gold mt-2"
        style={{ color: "oklch(0.13 0.028 248)", border: "none" }}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {modoExistente ? "Inscribiendo…" : "Registrando…"}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <UserPlus size={16} />
            {modoExistente ? "Inscribir en esta edición" : "Registrar participante"}
          </span>
        )}
      </Button>
    </form>
  );
}
