"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Pencil, Calendar, Hash, Percent, Globe } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z
  .object({
    anio: z.number({ error: "El año es requerido" }).int().min(2020).max(2100),
    nombre: z.string({ error: "El nombre es requerido" }).min(1).max(200).trim(),
    fechaInicio: z.string().min(1, "La fecha de inicio es requerida"),
    fechaFin: z.string().min(1, "La fecha de fin es requerida"),
    minAsistencias: z.number({ error: "Ingresa un número" }).int().min(1),
    porcentajeMinimo: z.number().min(0).max(100).nullable(),
    asistenciaGlobal: z.boolean(),
  })
  .refine((d) => new Date(d.fechaFin) > new Date(d.fechaInicio), {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["fechaFin"],
  });

type FormData = z.infer<typeof formSchema>;

function toDateInput(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

const labelStyle: React.CSSProperties = { color: "oklch(0.75 0.06 235)" };
const errorStyle: React.CSSProperties = { color: "oklch(0.65 0.18 25)" };
const hintStyle: React.CSSProperties = { color: "oklch(0.55 0.04 240)" };
function fieldStyle(err: boolean): React.CSSProperties {
  return { background: "oklch(0.16 0.030 248)", borderColor: err ? "oklch(0.60 0.21 25)" : "oklch(0.28 0.055 248)", color: "oklch(0.96 0.01 80)" };
}

interface Props {
  edicion: {
    id: string;
    anio: number;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    minAsistencias: number;
    porcentajeMinimo: number | null;
    asistenciaGlobal: boolean;
  };
}

export function EditarEdicionForm({ edicion }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      anio: edicion.anio,
      nombre: edicion.nombre,
      fechaInicio: toDateInput(edicion.fechaInicio),
      fechaFin: toDateInput(edicion.fechaFin),
      minAsistencias: edicion.minAsistencias,
      porcentajeMinimo: edicion.porcentajeMinimo,
      asistenciaGlobal: edicion.asistenciaGlobal,
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
        <Link href={`/ediciones/${edicion.id}`} className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors" style={{ color: "oklch(0.62 0.06 235)" }}>
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la edición
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.72 0.165 72 / 0.12)" }}>
            <Pencil size={18} strokeWidth={1.8} style={{ color: "oklch(0.72 0.165 72)" }} aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-3xl font-light" style={{ color: "oklch(0.96 0.01 80)" }}>
              Editar <em style={{ color: "oklch(0.72 0.165 72)" }}>{edicion.nombre}</em>
            </h1>
          </div>
        </div>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      <div className="animate-fade-up animate-fade-up-delay-2 rounded-xl p-6 sm:p-8" style={{ background: "oklch(0.18 0.032 248)", border: "1px solid oklch(0.28 0.055 248)", maxWidth: "42rem" }}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="anio" className="text-sm font-medium flex items-center gap-1.5" style={labelStyle}>
                <Hash size={13} strokeWidth={2} aria-hidden /> Año
              </Label>
              <Input id="anio" type="number" {...register("anio", { valueAsNumber: true })} style={fieldStyle(!!errors.anio)} className="h-11" />
              {errors.anio && <p className="text-xs" style={errorStyle}>{errors.anio.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-sm font-medium" style={labelStyle}>Nombre de la edición</Label>
              <Input id="nombre" type="text" {...register("nombre")} style={fieldStyle(!!errors.nombre)} className="h-11" />
              {errors.nombre && <p className="text-xs" style={errorStyle}>{errors.nombre.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio" className="text-sm font-medium flex items-center gap-1.5" style={labelStyle}>
                <Calendar size={13} strokeWidth={2} aria-hidden /> Fecha de inicio
              </Label>
              <Input id="fechaInicio" type="date" {...register("fechaInicio")} style={fieldStyle(!!errors.fechaInicio)} className="h-11" />
              {errors.fechaInicio && <p className="text-xs" style={errorStyle}>{errors.fechaInicio.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaFin" className="text-sm font-medium flex items-center gap-1.5" style={labelStyle}>
                <Calendar size={13} strokeWidth={2} aria-hidden /> Fecha de fin
              </Label>
              <Input id="fechaFin" type="date" {...register("fechaFin")} style={fieldStyle(!!errors.fechaFin)} className="h-11" />
              {errors.fechaFin && <p className="text-xs" style={errorStyle}>{errors.fechaFin.message}</p>}
            </div>
          </div>

          <div className="h-px" style={{ background: "oklch(0.24 0.04 248)" }} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minAsistencias" className="text-sm font-medium flex items-center gap-1.5" style={labelStyle}>
                <Hash size={13} strokeWidth={2} aria-hidden /> Mínimo de asistencias
              </Label>
              <Input id="minAsistencias" type="number" min={1} {...register("minAsistencias", { valueAsNumber: true })} style={fieldStyle(!!errors.minAsistencias)} className="h-11" />
              {errors.minAsistencias && <p className="text-xs" style={errorStyle}>{errors.minAsistencias.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="porcentajeMinimo" className="text-sm font-medium flex items-center gap-1.5" style={labelStyle}>
                <Percent size={13} strokeWidth={2} aria-hidden /> Porcentaje mínimo <span className="text-xs font-normal" style={{ color: "oklch(0.45 0.04 248)" }}>(opcional)</span>
              </Label>
              <Input id="porcentajeMinimo" type="number" min={0} max={100} step={0.1} placeholder="—"
                {...register("porcentajeMinimo", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
                style={fieldStyle(!!errors.porcentajeMinimo)} className="h-11" />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "oklch(0.16 0.030 248)", border: "1px solid oklch(0.24 0.04 248)" }}>
            <Controller name="asistenciaGlobal" control={control} render={({ field }) => (
              <Checkbox id="asistenciaGlobal" checked={field.value} onCheckedChange={field.onChange} className="mt-0.5 shrink-0" />
            )} />
            <div>
              <Label htmlFor="asistenciaGlobal" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer" style={{ color: "oklch(0.88 0.02 80)" }}>
                <Globe size={13} strokeWidth={2} aria-hidden /> Asistencia global
              </Label>
              <p className="text-xs mt-1 leading-relaxed" style={hintStyle}>
                Asistencias contadas en todas las sesiones de la edición, independientemente de la clase.
              </p>
            </div>
          </div>

          {serverError && (
            <div className="rounded-lg px-4 py-3 text-sm" role="alert" style={{ background: "oklch(0.60 0.21 25 / 0.12)", border: "1px solid oklch(0.60 0.21 25 / 0.4)", color: "oklch(0.75 0.15 25)" }}>
              {serverError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link href={`/ediciones/${edicion.id}`} className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "oklch(0.21 0.035 248)", border: "1px solid oklch(0.28 0.055 248)", color: "oklch(0.68 0.05 240)" }}>
              Cancelar
            </Link>
            <button type="submit" disabled={loading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "oklch(0.13 0.028 248)" }} aria-busy={loading}>
              {loading ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
