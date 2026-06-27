"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Pencil, Calendar, Hash } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const formSchema = z
  .object({
    anio: z.number({ error: "El año es requerido" }).int().min(2020).max(2100),
    nombre: z.string({ error: "El nombre es requerido" }).min(1).max(200).trim(),
    fechaInicio: z.string().min(1, "La fecha de inicio es requerida"),
    fechaFin: z.string().min(1, "La fecha de fin es requerida"),
  })
  .refine((d) => new Date(d.fechaFin) > new Date(d.fechaInicio), {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["fechaFin"],
  });

type FormData = z.infer<typeof formSchema>;

function toDateInput(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

interface Props {
  edicion: {
    id: string;
    anio: number;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
  };
}

export function EditarEdicionForm({ edicion }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      anio: edicion.anio,
      nombre: edicion.nombre,
      fechaInicio: toDateInput(edicion.fechaInicio),
      fechaFin: toDateInput(edicion.fechaFin),
    },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/ediciones/${edicion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fechaInicio: `${data.fechaInicio}T00:00:00.000Z`,
          fechaFin: `${data.fechaFin}T00:00:00.000Z`,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setServerError(json?.error ?? "Error al guardar."); return; }
      router.push(`/ediciones/${edicion.id}`);
      router.refresh();
    } catch {
      setServerError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <Link
          href={`/ediciones/${edicion.id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la edición
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
            <Pencil size={18} strokeWidth={1.8} className="text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Editar <em className="text-primary not-italic font-semibold">{edicion.nombre}</em>
            </h1>
          </div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <div
        className="animate-fade-up animate-fade-up-delay-2 bg-card border border-border rounded-2xl p-6 sm:p-8"
        style={{ maxWidth: "42rem" }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="anio" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                <Hash size={13} strokeWidth={2} aria-hidden /> Año
              </Label>
              <Input
                id="anio"
                type="number"
                {...register("anio", { valueAsNumber: true })}
                className={`h-11 rounded-lg bg-muted border-border tabular transition-colors focus:ring-primary ${errors.anio ? "border-destructive focus:ring-destructive" : ""}`}
              />
              {errors.anio && <p className="text-xs text-destructive">{errors.anio.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-sm font-medium text-muted-foreground">Nombre de la edición</Label>
              <Input
                id="nombre"
                type="text"
                {...register("nombre")}
                className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.nombre ? "border-destructive focus:ring-destructive" : ""}`}
              />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                <Calendar size={13} strokeWidth={2} aria-hidden /> Fecha de inicio
              </Label>
              <Input
                id="fechaInicio"
                type="date"
                {...register("fechaInicio")}
                className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.fechaInicio ? "border-destructive focus:ring-destructive" : ""}`}
              />
              {errors.fechaInicio && <p className="text-xs text-destructive">{errors.fechaInicio.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaFin" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                <Calendar size={13} strokeWidth={2} aria-hidden /> Fecha de fin
              </Label>
              <Input
                id="fechaFin"
                type="date"
                {...register("fechaFin")}
                className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.fechaFin ? "border-destructive focus:ring-destructive" : ""}`}
              />
              {errors.fechaFin && <p className="text-xs text-destructive">{errors.fechaFin.message}</p>}
            </div>
          </div>

          {serverError && (
            <div
              className="rounded-lg px-4 py-3 text-sm text-destructive bg-destructive/10 border border-destructive/40"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link
              href={`/ediciones/${edicion.id}`}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              aria-busy={loading}
            >
              {loading ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
