"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { mensajeDeError } from "@/lib/api/errores";
import { Save, Trash2, AlertTriangle, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  participanteSchema,
  type ParticipanteInput,
  type EditarParticipanteInput,
} from "@/lib/schemas/participante.schema";
import {
  editarParticipante,
  eliminarParticipante,
} from "@/lib/api/participantes";

// ── Grados sugeridos ──────────────────────────────────────────────────────────
// Van en un <datalist>, no en un <select>: hay fichas importadas con grados
// fuera de esta lista ("3° secundaria", "Preescolar") y un select los borraría
// al guardar.

const GRADOS_SUGERIDOS = [
  "1° primaria",
  "2° primaria",
  "3° primaria",
  "4° primaria",
  "5° primaria",
  "6° primaria",
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ParticipanteEditable {
  id:        string;
  nombre:    string;
  apellidos: string;
  edad:      number;
  escuela:   string;
  grado:     string;
  genero:    "FEMENINO" | "MASCULINO" | null;
}

interface FormEditarParticipanteProps {
  participante: ParticipanteEditable;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FormEditarParticipante({
  participante,
}: FormEditarParticipanteProps) {
  const router = useRouter();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ParticipanteInput>({
    resolver: zodResolver(participanteSchema),
    defaultValues: {
      nombre:    participante.nombre,
      apellidos: participante.apellidos,
      edad:      participante.edad,
      escuela:   participante.escuela,
      grado:     participante.grado,
      genero:    participante.genero ?? undefined,
    },
  });

  // Guardar ── solo se mandan los campos que cambiaron
  const mutacionGuardar = useMutation({
    mutationFn: (data: ParticipanteInput) => {
      const cambios: EditarParticipanteInput = {};
      if (data.nombre    !== participante.nombre)    cambios.nombre    = data.nombre;
      if (data.apellidos !== participante.apellidos) cambios.apellidos = data.apellidos;
      if (data.edad      !== participante.edad)      cambios.edad      = data.edad;
      if (data.escuela   !== participante.escuela)   cambios.escuela   = data.escuela;
      if (data.grado     !== participante.grado)     cambios.grado     = data.grado;
      if (data.genero && data.genero !== participante.genero) {
        cambios.genero = data.genero;
      }

      if (Object.keys(cambios).length === 0) {
        return Promise.resolve(null);
      }
      return editarParticipante(participante.id, cambios);
    },
    onSuccess: (resultado) => {
      if (resultado === null) {
        toast.info("No hay cambios que guardar");
        return;
      }
      toast.success("Datos del participante actualizados");
      router.push(`/participantes/${participante.id}`);
      router.refresh();
    },
    onError: (err: Error) =>
      toast.error(
        `No se pudieron guardar los cambios de ${participante.nombre} ${participante.apellidos}: ` +
          mensajeDeError(err, "el servidor no completó la operación."),
      ),
  });

  // Eliminar ── el 409 del servidor trae el detalle de qué lo impide
  const mutacionEliminar = useMutation({
    mutationFn: () => eliminarParticipante(participante.id),
    onSuccess: () => {
      toast.success(
        `Se eliminó la ficha de ${participante.nombre} ${participante.apellidos}`,
      );
      router.push("/participantes");
      router.refresh();
    },
    onError: (err: Error) => {
      setErrorBorrado(
        mensajeDeError(
          err,
          "No se pudo eliminar al participante; su ficha sigue registrada. Vuelve a intentarlo en unos minutos.",
        ),
      );
      setConfirmandoBorrado(false);
    },
  });

  const guardando = mutacionGuardar.isPending;
  const borrando  = mutacionEliminar.isPending;

  const claseCampo = (hayError: boolean) =>
    [
      "h-11 rounded-xl bg-muted border transition-colors focus-visible:ring-primary",
      hayError ? "border-destructive" : "border-border",
    ].join(" ");

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit((data) => mutacionGuardar.mutate(data))}
        className="space-y-5"
        noValidate
      >
        {/* Nombre + Apellidos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-nombre" className="text-sm font-medium text-foreground">
              Nombre(s) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-nombre"
              type="text"
              autoComplete="given-name"
              {...register("nombre")}
              className={claseCampo(!!errors.nombre)}
            />
            {errors.nombre && (
              <p className="text-xs text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-apellidos" className="text-sm font-medium text-foreground">
              Apellidos <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-apellidos"
              type="text"
              autoComplete="family-name"
              {...register("apellidos")}
              className={claseCampo(!!errors.apellidos)}
            />
            {errors.apellidos && (
              <p className="text-xs text-destructive">{errors.apellidos.message}</p>
            )}
          </div>
        </div>

        {/* Edad + Grado */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-edad" className="text-sm font-medium text-foreground">
              Edad <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-edad"
              type="number"
              min={5}
              max={18}
              inputMode="numeric"
              {...register("edad", { valueAsNumber: true })}
              className={`${claseCampo(!!errors.edad)} tabular`}
            />
            {errors.edad && (
              <p className="text-xs text-destructive">{errors.edad.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-grado" className="text-sm font-medium text-foreground">
              Grado <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-grado"
              type="text"
              list="grados-sugeridos"
              {...register("grado")}
              className={claseCampo(!!errors.grado)}
            />
            <datalist id="grados-sugeridos">
              {GRADOS_SUGERIDOS.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            {errors.grado && (
              <p className="text-xs text-destructive">{errors.grado.message}</p>
            )}
          </div>
        </div>

        {/* Escuela + Género */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-escuela" className="text-sm font-medium text-foreground">
              Escuela <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-escuela"
              type="text"
              {...register("escuela")}
              className={claseCampo(!!errors.escuela)}
            />
            {errors.escuela && (
              <p className="text-xs text-destructive">{errors.escuela.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-genero" className="text-sm font-medium text-foreground">
              Género{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            {/* select nativo: en móvil abre la rueda del sistema y no depende de JS */}
            <select
              id="edit-genero"
              {...register("genero")}
              className="h-11 w-full rounded-xl bg-muted border border-border px-3 text-sm text-foreground focus-visible:ring-primary"
            >
              <option value="">Sin especificar</option>
              <option value="FEMENINO">Niña</option>
              <option value="MASCULINO">Niño</option>
            </select>
          </div>
        </div>

        <Button
          type="submit"
          disabled={guardando || !isDirty}
          className="w-full sm:w-auto h-12 px-6 font-semibold text-sm rounded-xl btn-primary"
        >
          {guardando ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Guardando…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save size={16} />
              Guardar cambios
            </span>
          )}
        </Button>
      </form>

      <div className="h-px bg-border" />

      {/* ── Zona de riesgo ───────────────────────────────────────────────── */}
      <section className="rounded-2xl p-4 sm:p-5 bg-card border border-destructive/30">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="shrink-0 mt-0.5 text-destructive"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                Eliminar participante
              </h2>
              <p className="text-sm mt-1 leading-relaxed text-muted-foreground">
                Borra la ficha del niño de forma permanente. Solo es posible si
                no conserva inscripciones ni asistencias: su historial respalda
                las constancias emitidas. Para sacarlo de una edición concreta,
                usa <strong className="font-medium">Dar de baja</strong> en su
                historial.
              </p>
            </div>

            {errorBorrado && (
              <div
                className="rounded-lg px-3 py-2.5 text-sm text-destructive bg-destructive/10 border border-destructive/40"
                role="alert"
              >
                {errorBorrado}
              </div>
            )}

            {!confirmandoBorrado ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setErrorBorrado(null);
                  setConfirmandoBorrado(true);
                }}
                className="h-11 px-4 rounded-xl w-full sm:w-auto"
              >
                <Trash2 size={15} />
                Eliminar participante
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  ¿Seguro? Esta acción no se puede deshacer.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={borrando}
                    onClick={() => mutacionEliminar.mutate()}
                    className="h-11 px-4 rounded-xl"
                  >
                    <Trash2 size={15} />
                    {borrando ? "Eliminando…" : "Sí, eliminar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={borrando}
                    onClick={() => setConfirmandoBorrado(false)}
                    className="h-11 px-4 rounded-xl"
                  >
                    <X size={15} />
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
