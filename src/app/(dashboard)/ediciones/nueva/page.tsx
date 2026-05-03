"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, FlaskConical, Calendar, Hash, Percent, Globe } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// ── Zod schema (client-side — matches backend crearEdicionSchema) ─────────────

const formSchema = z
  .object({
    anio: z
      .number({ error: "El año es requerido" })
      .int("El año debe ser un número entero")
      .min(2020, "El año mínimo es 2020")
      .max(2100, "El año máximo es 2100"),

    nombre: z
      .string({ error: "El nombre es requerido" })
      .min(1, "El nombre no puede estar vacío")
      .max(200, "El nombre no puede exceder 200 caracteres")
      .trim(),

    // date inputs give us "YYYY-MM-DD"; we append T00:00:00Z for ISO 8601
    fechaInicio: z
      .string({ error: "La fecha de inicio es requerida" })
      .min(1, "La fecha de inicio es requerida"),

    fechaFin: z
      .string({ error: "La fecha de fin es requerida" })
      .min(1, "La fecha de fin es requerida"),

    minAsistencias: z
      .number({ error: "Ingresa un número" })
      .int("Debe ser un entero")
      .min(1, "Mínimo 1 asistencia"),

    porcentajeMinimo: z
      .number({ error: "Ingresa un número" })
      .min(0, "No puede ser negativo")
      .max(100, "No puede superar 100")
      .nullable(),

    asistenciaGlobal: z.boolean(),
  })
  .refine((d) => new Date(d.fechaFin) > new Date(d.fechaInicio), {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["fechaFin"],
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
const hintStyle: React.CSSProperties = { color: "oklch(0.55 0.04 240)" };

// ── Component ─────────────────────────────────────────────────────────────────

export default function NuevaEdicionPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      anio: new Date().getFullYear(),
      nombre: "",
      fechaInicio: "",
      fechaFin: "",
      minAsistencias: 5,
      porcentajeMinimo: null,
      asistenciaGlobal: true,
    },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setServerError(null);

    // Convert date strings "YYYY-MM-DD" → full ISO 8601 for the API
    const payload = {
      ...data,
      fechaInicio: data.fechaInicio ? `${data.fechaInicio}T00:00:00.000Z` : data.fechaInicio,
      fechaFin: data.fechaFin ? `${data.fechaFin}T00:00:00.000Z` : data.fechaFin,
    };

    try {
      const res = await fetch("/api/ediciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json?.error ?? "Error al crear la edición. Intenta de nuevo.");
        return;
      }

      // Redirect to the list on success
      router.push("/ediciones");
      router.refresh();
    } catch {
      setServerError("Error de red. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Back link + title */}
      <div className="animate-fade-up">
        <Link
          href="/ediciones"
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors"
          style={{ color: "oklch(0.62 0.06 235)" }}
          aria-label="Volver a Ediciones"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a Ediciones
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.72 0.165 72 / 0.12)" }}
          >
            <FlaskConical
              size={20}
              strokeWidth={1.8}
              style={{ color: "oklch(0.72 0.165 72)" }}
              aria-hidden
            />
          </div>
          <div>
            <h1
              className="font-display text-3xl font-light"
              style={{ color: "oklch(0.96 0.01 80)" }}
            >
              Nueva <em style={{ color: "oklch(0.72 0.165 72)" }}>Edición</em>
            </h1>
            <p className="text-sm mt-0.5" style={hintStyle}>
              Registra una nueva instancia anual del programa
            </p>
          </div>
        </div>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Form card */}
      <div
        className="animate-fade-up animate-fade-up-delay-2 rounded-xl p-6 sm:p-8"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
          maxWidth: "42rem",
        }}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
          noValidate
          aria-label="Formulario de nueva edición"
        >
          {/* Row 1: Año + Nombre */}
          <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-4">
            {/* Año */}
            <div className="space-y-2">
              <Label
                htmlFor="anio"
                className="text-sm font-medium flex items-center gap-1.5"
                style={labelStyle}
              >
                <Hash size={13} strokeWidth={2} aria-hidden />
                Año
              </Label>
              <Input
                id="anio"
                type="number"
                inputMode="numeric"
                min={2020}
                max={2100}
                placeholder="2026"
                {...register("anio", { valueAsNumber: true })}
                style={fieldStyle(!!errors.anio)}
                className="h-11 transition-colors focus:border-primary"
                aria-describedby={errors.anio ? "anio-error" : undefined}
              />
              {errors.anio && (
                <p id="anio-error" className="text-xs" style={errorStyle} role="alert">
                  {errors.anio.message}
                </p>
              )}
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label
                htmlFor="nombre"
                className="text-sm font-medium"
                style={labelStyle}
              >
                Nombre de la edición
              </Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Pasaporte Científico 2026"
                {...register("nombre")}
                style={fieldStyle(!!errors.nombre)}
                className="h-11 transition-colors focus:border-primary"
                aria-describedby={errors.nombre ? "nombre-error" : undefined}
              />
              {errors.nombre && (
                <p id="nombre-error" className="text-xs" style={errorStyle} role="alert">
                  {errors.nombre.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fecha inicio */}
            <div className="space-y-2">
              <Label
                htmlFor="fechaInicio"
                className="text-sm font-medium flex items-center gap-1.5"
                style={labelStyle}
              >
                <Calendar size={13} strokeWidth={2} aria-hidden />
                Fecha de inicio
              </Label>
              <Input
                id="fechaInicio"
                type="date"
                {...register("fechaInicio")}
                style={fieldStyle(!!errors.fechaInicio)}
                className="h-11 transition-colors focus:border-primary"
                aria-describedby={errors.fechaInicio ? "fechaInicio-error" : undefined}
              />
              {errors.fechaInicio && (
                <p id="fechaInicio-error" className="text-xs" style={errorStyle} role="alert">
                  {errors.fechaInicio.message}
                </p>
              )}
            </div>

            {/* Fecha fin */}
            <div className="space-y-2">
              <Label
                htmlFor="fechaFin"
                className="text-sm font-medium flex items-center gap-1.5"
                style={labelStyle}
              >
                <Calendar size={13} strokeWidth={2} aria-hidden />
                Fecha de fin
              </Label>
              <Input
                id="fechaFin"
                type="date"
                {...register("fechaFin")}
                style={fieldStyle(!!errors.fechaFin)}
                className="h-11 transition-colors focus:border-primary"
                aria-describedby={errors.fechaFin ? "fechaFin-error" : undefined}
              />
              {errors.fechaFin && (
                <p id="fechaFin-error" className="text-xs" style={errorStyle} role="alert">
                  {errors.fechaFin.message}
                </p>
              )}
            </div>
          </div>

          {/* Separator */}
          <div
            className="h-px"
            style={{ background: "oklch(0.24 0.04 248)" }}
            role="separator"
          />

          {/* Row 3: Asistencias + Porcentaje */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mínimo de asistencias */}
            <div className="space-y-2">
              <Label
                htmlFor="minAsistencias"
                className="text-sm font-medium flex items-center gap-1.5"
                style={labelStyle}
              >
                <Hash size={13} strokeWidth={2} aria-hidden />
                Mínimo de asistencias
              </Label>
              <Input
                id="minAsistencias"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="5"
                {...register("minAsistencias", { valueAsNumber: true })}
                style={fieldStyle(!!errors.minAsistencias)}
                className="h-11 transition-colors focus:border-primary"
                aria-describedby={
                  errors.minAsistencias ? "minAsistencias-error" : "minAsistencias-hint"
                }
              />
              {errors.minAsistencias ? (
                <p
                  id="minAsistencias-error"
                  className="text-xs"
                  style={errorStyle}
                  role="alert"
                >
                  {errors.minAsistencias.message}
                </p>
              ) : (
                <p id="minAsistencias-hint" className="text-xs" style={hintStyle}>
                  Sesiones requeridas para obtener constancia
                </p>
              )}
            </div>

            {/* Porcentaje mínimo (opcional) */}
            <div className="space-y-2">
              <Label
                htmlFor="porcentajeMinimo"
                className="text-sm font-medium flex items-center gap-1.5"
                style={labelStyle}
              >
                <Percent size={13} strokeWidth={2} aria-hidden />
                Porcentaje mínimo
                <span
                  className="text-xs font-normal"
                  style={{ color: "oklch(0.45 0.04 248)" }}
                >
                  (opcional)
                </span>
              </Label>
              <Input
                id="porcentajeMinimo"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.1}
                placeholder="80"
                {...register("porcentajeMinimo", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
                style={fieldStyle(!!errors.porcentajeMinimo)}
                className="h-11 transition-colors focus:border-primary"
                aria-describedby={
                  errors.porcentajeMinimo ? "porcentaje-error" : "porcentaje-hint"
                }
              />
              {errors.porcentajeMinimo ? (
                <p
                  id="porcentaje-error"
                  className="text-xs"
                  style={errorStyle}
                  role="alert"
                >
                  {errors.porcentajeMinimo.message}
                </p>
              ) : (
                <p id="porcentaje-hint" className="text-xs" style={hintStyle}>
                  Deja vacío para usar solo conteo absoluto
                </p>
              )}
            </div>
          </div>

          {/* Row 4: Asistencia global toggle */}
          <div
            className="flex items-start gap-3 p-4 rounded-lg"
            style={{
              background: "oklch(0.16 0.030 248)",
              border: "1px solid oklch(0.24 0.04 248)",
            }}
          >
            <Controller
              name="asistenciaGlobal"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="asistenciaGlobal"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5 shrink-0"
                  aria-describedby="asistenciaGlobal-desc"
                  style={
                    {
                      "--checkbox-bg": "oklch(0.72 0.165 72)",
                    } as React.CSSProperties
                  }
                />
              )}
            />
            <div>
              <Label
                htmlFor="asistenciaGlobal"
                className="text-sm font-medium flex items-center gap-1.5 cursor-pointer"
                style={{ color: "oklch(0.88 0.02 80)" }}
              >
                <Globe size={13} strokeWidth={2} aria-hidden />
                Asistencia global
              </Label>
              <p
                id="asistenciaGlobal-desc"
                className="text-xs mt-1 leading-relaxed"
                style={hintStyle}
              >
                Las asistencias se cuentan en todas las sesiones de la edición,
                independientemente de la clase. Desactiva para contar por clase.
              </p>
            </div>
          </div>

          {/* Server error */}
          {serverError && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              role="alert"
              style={{
                background: "oklch(0.60 0.21 25 / 0.12)",
                border: "1px solid oklch(0.60 0.21 25 / 0.4)",
                color: "oklch(0.75 0.15 25)",
              }}
            >
              {serverError}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link
              href="/ediciones"
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "oklch(0.21 0.035 248)",
                border: "1px solid oklch(0.28 0.055 248)",
                color: "oklch(0.68 0.05 240)",
              }}
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold btn-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "oklch(0.13 0.028 248)" }}
              aria-busy={loading}
            >
              {loading ? (
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
                "Crear Edición"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
