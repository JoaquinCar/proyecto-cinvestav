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
          <Label className="text-sm font-medium text-foreground">
            ¿El participante ya estuvo en ediciones anteriores?
          </Label>
          <BusquedaParticipante
            edicionId={edicionId}
            onSelect={handleSelectExistente}
            placeholder="Buscar por nombre o apellidos…"
          />
          <p className="text-xs text-muted-foreground">
            Si ya participó antes, selecciónalo para evitar duplicados.
            Si es nuevo, llena el formulario de abajo.
          </p>
        </div>
      )}

      {/* Banner: participante existente seleccionado */}
      {modoExistente && participanteExistente && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-secondary/10 border border-secondary/30">
          <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-secondary/15">
            <UserCheck size={16} className="text-secondary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Participante encontrado
            </p>
            <p className="text-sm mt-0.5 truncate text-secondary-foreground">
              {participanteExistente.nombre} {participanteExistente.apellidos}
            </p>
            <p className="text-xs mt-0.5 truncate text-muted-foreground">
              {participanteExistente.escuela} · {participanteExistente.grado}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDescartarExistente}
            className="text-xs underline underline-offset-2 shrink-0 mt-0.5 transition-opacity hover:opacity-70 text-muted-foreground"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Separador visual */}
      {!modoExistente && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            O registra nuevo
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Campos del formulario */}
      <fieldset disabled={modoExistente} className="space-y-4">
        {/* Nombre + Apellidos — row en desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-nombre" className="text-sm font-medium text-foreground">
              Nombre(s) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg-nombre"
              type="text"
              autoComplete="given-name"
              placeholder="Ej. María"
              {...register("nombre")}
              className={[
                "h-11 rounded-xl bg-muted border transition-colors",
                "focus-visible:ring-primary",
                errors.nombre ? "border-destructive" : "border-border",
              ].join(" ")}
            />
            {errors.nombre && (
              <p className="text-xs text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-apellidos" className="text-sm font-medium text-foreground">
              Apellidos <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg-apellidos"
              type="text"
              autoComplete="family-name"
              placeholder="Ej. García López"
              {...register("apellidos")}
              className={[
                "h-11 rounded-xl bg-muted border transition-colors",
                "focus-visible:ring-primary",
                errors.apellidos ? "border-destructive" : "border-border",
              ].join(" ")}
            />
            {errors.apellidos && (
              <p className="text-xs text-destructive">{errors.apellidos.message}</p>
            )}
          </div>
        </div>

        {/* Edad + Grado — row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-edad" className="text-sm font-medium text-foreground">
              Edad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reg-edad"
              type="number"
              min={5}
              max={18}
              placeholder="10"
              {...register("edad", { valueAsNumber: true })}
              className={[
                "h-11 rounded-xl bg-muted border tabular transition-colors",
                "focus-visible:ring-primary",
                errors.edad ? "border-destructive" : "border-border",
              ].join(" ")}
            />
            {errors.edad && (
              <p className="text-xs text-destructive">{errors.edad.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Grado <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="grado"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className={[
                      "h-11 w-full rounded-xl bg-muted border",
                      "focus:ring-primary",
                      errors.grado ? "border-destructive" : "border-border",
                    ].join(" ")}
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
              <p className="text-xs text-destructive">{errors.grado.message}</p>
            )}
          </div>
        </div>

        {/* Escuela */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-escuela" className="text-sm font-medium text-foreground">
            Escuela <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reg-escuela"
            type="text"
            placeholder="Ej. Primaria José María Morelos"
            {...register("escuela")}
            className={[
              "h-11 rounded-xl bg-muted border transition-colors",
              "focus-visible:ring-primary",
              errors.escuela ? "border-destructive" : "border-border",
            ].join(" ")}
          />
          {errors.escuela && (
            <p className="text-xs text-destructive">{errors.escuela.message}</p>
          )}
        </div>
      </fieldset>

      {/* Botón de envío */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-12 font-semibold text-sm rounded-xl btn-primary mt-2"
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
