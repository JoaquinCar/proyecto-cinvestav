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
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
        aria-label="Agregar nueva sesión"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        Agregar Sesión
      </button>
    ) : (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors bg-muted border border-border text-primary hover:bg-surface-alt"
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

      <DialogContent className="sm:max-w-[28rem] bg-card border border-border text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-secondary/10">
              <CalendarPlus
                size={17}
                strokeWidth={1.8}
                className="text-secondary-foreground"
                aria-hidden
              />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-foreground">
                Nueva Sesión
              </DialogTitle>
              <p className="text-xs mt-0.5 text-muted-foreground">
                {claseNombre}
              </p>
            </div>
          </div>
          <div className="h-px bg-border mt-3" />
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 mt-2"
          noValidate
          aria-label="Formulario de nueva sesión"
        >
          {/* Fecha */}
          <div className="space-y-2">
            <Label htmlFor="sesion-fecha" className="text-sm font-medium text-foreground">
              Fecha de la sesión
            </Label>
            <Input
              id="sesion-fecha"
              type="date"
              {...register("fecha")}
              className={`h-11 transition-colors bg-surface-alt border-border focus:border-primary focus:ring-primary ${errors.fecha ? "border-destructive" : ""}`}
              aria-describedby={errors.fecha ? "sesion-fecha-error" : undefined}
            />
            {errors.fecha && (
              <p id="sesion-fecha-error" className="text-xs text-destructive" role="alert">
                {errors.fecha.message}
              </p>
            )}
          </div>

          {/* Temas */}
          <div className="space-y-2">
            <Label htmlFor="sesion-temas" className="text-sm font-medium text-foreground">
              Temas tratados
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="sesion-temas"
              placeholder="Ej: Introducción al sistema solar, planetas rocosos…"
              rows={3}
              {...register("temas")}
              className={`resize-none transition-colors bg-surface-alt border-border focus:border-primary focus:ring-primary ${errors.temas ? "border-destructive" : ""}`}
              aria-describedby={errors.temas ? "sesion-temas-error" : "sesion-temas-hint"}
            />
            {errors.temas ? (
              <p id="sesion-temas-error" className="text-xs text-destructive" role="alert">
                {errors.temas.message}
              </p>
            ) : (
              <p id="sesion-temas-hint" className="text-xs text-muted-foreground">
                Puedes actualizar los temas después desde la vista de clase
              </p>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="sesion-notas" className="text-sm font-medium text-foreground">
              Notas internas
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="sesion-notas"
              placeholder="Observaciones, incidencias, material utilizado…"
              rows={2}
              {...register("notas")}
              className={`resize-none transition-colors bg-surface-alt border-border focus:border-primary focus:ring-primary ${errors.notas ? "border-destructive" : ""}`}
              aria-describedby={errors.notas ? "sesion-notas-error" : undefined}
            />
            {errors.notas && (
              <p id="sesion-notas-error" className="text-xs text-destructive" role="alert">
                {errors.notas.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
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
