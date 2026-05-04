"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CalendarPlus } from "lucide-react";

// ── Zod schema ────────────────────────────────────────────────────────────────

const formSchema = z.object({
  fecha: z.string({ error: "La fecha es requerida" }).min(1, "La fecha es requerida"),
  temas: z
    .string()
    .max(500, "Los temas no pueden exceder 500 caracteres")
    .trim()
    .optional(),
  notas: z
    .string()
    .max(1000, "Las notas no pueden exceder 1000 caracteres")
    .trim()
    .optional(),
});

type FormData = z.infer<typeof formSchema>;

// ── Style helpers ─────────────────────────────────────────────────────────────

function fieldStyle(hasError: boolean): React.CSSProperties {
  return {
    background: "oklch(0.16 0.030 248)",
    borderColor: hasError ? "oklch(0.60 0.21 25)" : "oklch(0.28 0.055 248)",
    color: "oklch(0.96 0.01 80)",
  };
}

const labelStyle: React.CSSProperties = { color: "oklch(0.75 0.06 235)" };
const errorStyle: React.CSSProperties = { color: "oklch(0.65 0.18 25)" };
const hintStyle:  React.CSSProperties = { color: "oklch(0.55 0.04 240)" };

// ── Component ─────────────────────────────────────────────────────────────────

interface FormSesionProps {
  claseId: string;
  /** Nombre de la clase — se muestra en el encabezado del modal */
  claseNombre: string;
  /** Callback invocado tras crear la sesión con éxito */
  onSuccess?: () => void;
  /** Variante visual del botón trigger */
  variant?: "primary" | "ghost";
}

export function FormSesion({
  claseId,
  claseNombre,
  onSuccess,
  variant = "primary",
}: FormSesionProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { fecha: "", temas: "", notas: "" },
  });

  // ── Mutation ────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        claseId,
        fecha: data.fecha,
        temas: data.temas || undefined,
        notas: data.notas || undefined,
      };

      const res = await fetch("/api/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Error al crear la sesión");
      }

      return res.json();
    },

    onSuccess: () => {
      toast.success("Sesión agregada correctamente");
      // Invalidate any query that fetches sessions for this clase
      queryClient.invalidateQueries({ queryKey: ["clase", claseId] });
      queryClient.invalidateQueries({ queryKey: ["sesiones", claseId] });
      setOpen(false);
      reset();
      onSuccess?.();
    },

    onError: (err: Error) => {
      toast.error(err.message ?? "Error al crear la sesión");
    },
  });

  function onSubmit(data: FormData) {
    mutation.mutate(data);
  }

  // ── Trigger button ──────────────────────────────────────────────────────────

  const triggerButton =
    variant === "primary" ? (
      <button
        type="button"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all"
        style={{ color: "oklch(0.13 0.028 248)" }}
        aria-label="Agregar nueva sesión"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        Agregar Sesión
      </button>
    ) : (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{
          background: "oklch(0.21 0.035 248)",
          border: "1px solid oklch(0.28 0.055 248)",
          color: "oklch(0.72 0.165 72)",
        }}
        aria-label="Agregar nueva sesión"
      >
        <CalendarPlus size={13} strokeWidth={2} aria-hidden />
        Sesión
      </button>
    );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerButton} />

      <DialogContent
        className="sm:max-w-[28rem]"
        style={{
          background: "oklch(0.17 0.030 248)",
          border: "1px solid oklch(0.28 0.055 248)",
          color: "oklch(0.96 0.01 80)",
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.72 0.165 72 / 0.12)" }}
            >
              <CalendarPlus
                size={17}
                strokeWidth={1.8}
                style={{ color: "oklch(0.72 0.165 72)" }}
                aria-hidden
              />
            </div>
            <div>
              <DialogTitle
                className="font-display text-lg font-medium"
                style={{ color: "oklch(0.96 0.01 80)" }}
              >
                Nueva Sesión
              </DialogTitle>
              <p className="text-xs mt-0.5" style={hintStyle}>
                {claseNombre}
              </p>
            </div>
          </div>
          <div className="gold-rule mt-3" />
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 mt-2"
          noValidate
          aria-label="Formulario de nueva sesión"
        >
          {/* Fecha */}
          <div className="space-y-2">
            <Label htmlFor="sesion-fecha" className="text-sm font-medium" style={labelStyle}>
              Fecha de la sesión
            </Label>
            <Input
              id="sesion-fecha"
              type="date"
              {...register("fecha")}
              style={fieldStyle(!!errors.fecha)}
              className="h-11 transition-colors focus:border-primary"
              aria-describedby={errors.fecha ? "sesion-fecha-error" : undefined}
            />
            {errors.fecha && (
              <p id="sesion-fecha-error" className="text-xs" style={errorStyle} role="alert">
                {errors.fecha.message}
              </p>
            )}
          </div>

          {/* Temas */}
          <div className="space-y-2">
            <Label htmlFor="sesion-temas" className="text-sm font-medium" style={labelStyle}>
              Temas tratados
              <span className="ml-1.5 text-xs font-normal" style={{ color: "oklch(0.45 0.04 248)" }}>
                (opcional)
              </span>
            </Label>
            <Textarea
              id="sesion-temas"
              placeholder="Ej: Introducción al sistema solar, planetas rocosos…"
              rows={3}
              {...register("temas")}
              style={fieldStyle(!!errors.temas)}
              className="resize-none transition-colors focus:border-primary"
              aria-describedby={errors.temas ? "sesion-temas-error" : "sesion-temas-hint"}
            />
            {errors.temas ? (
              <p id="sesion-temas-error" className="text-xs" style={errorStyle} role="alert">
                {errors.temas.message}
              </p>
            ) : (
              <p id="sesion-temas-hint" className="text-xs" style={hintStyle}>
                Puedes actualizar los temas después desde la vista de clase
              </p>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="sesion-notas" className="text-sm font-medium" style={labelStyle}>
              Notas internas
              <span className="ml-1.5 text-xs font-normal" style={{ color: "oklch(0.45 0.04 248)" }}>
                (opcional)
              </span>
            </Label>
            <Textarea
              id="sesion-notas"
              placeholder="Observaciones, incidencias, material utilizado…"
              rows={2}
              {...register("notas")}
              style={fieldStyle(!!errors.notas)}
              className="resize-none transition-colors focus:border-primary"
              aria-describedby={errors.notas ? "sesion-notas-error" : undefined}
            />
            {errors.notas && (
              <p id="sesion-notas-error" className="text-xs" style={errorStyle} role="alert">
                {errors.notas.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "oklch(0.21 0.035 248)",
                border: "1px solid oklch(0.28 0.055 248)",
                color: "oklch(0.68 0.05 240)",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "oklch(0.13 0.028 248)" }}
              aria-busy={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <svg
                    className="animate-spin"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Guardando…
                </>
              ) : (
                "Agregar Sesión"
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
