"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, FlaskConical, Calendar, Hash } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  })
  .refine((d) => new Date(d.fechaFin) > new Date(d.fechaInicio), {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["fechaFin"],
  });

type FormData = z.infer<typeof formSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function NuevaEdicionPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      anio: new Date().getFullYear(),
      nombre: "",
      fechaInicio: "",
      fechaFin: "",
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
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Volver a Ediciones"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a Ediciones
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
            <FlaskConical
              size={20}
              strokeWidth={1.8}
              className="text-primary"
              aria-hidden
            />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Nueva <em className="text-primary not-italic font-semibold">Edición</em>
            </h1>
            <p className="text-sm mt-0.5 text-muted-foreground">
              Registra una nueva instancia anual del programa
            </p>
          </div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Form card */}
      <div
        className="animate-fade-up animate-fade-up-delay-2 bg-card border border-border rounded-2xl p-6 sm:p-8"
        style={{ maxWidth: "42rem" }}
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
                className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
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
                className={`h-11 rounded-lg bg-muted border-border tabular transition-colors focus:ring-primary ${errors.anio ? "border-destructive focus:ring-destructive" : ""}`}
                aria-describedby={errors.anio ? "anio-error" : undefined}
              />
              {errors.anio && (
                <p id="anio-error" className="text-xs text-destructive" role="alert">
                  {errors.anio.message}
                </p>
              )}
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label
                htmlFor="nombre"
                className="text-sm font-medium text-muted-foreground"
              >
                Nombre de la edición
              </Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Pasaporte Científico 2026"
                {...register("nombre")}
                className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.nombre ? "border-destructive focus:ring-destructive" : ""}`}
                aria-describedby={errors.nombre ? "nombre-error" : undefined}
              />
              {errors.nombre && (
                <p id="nombre-error" className="text-xs text-destructive" role="alert">
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
                className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
              >
                <Calendar size={13} strokeWidth={2} aria-hidden />
                Fecha de inicio
              </Label>
              <Input
                id="fechaInicio"
                type="date"
                {...register("fechaInicio")}
                className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.fechaInicio ? "border-destructive focus:ring-destructive" : ""}`}
                aria-describedby={errors.fechaInicio ? "fechaInicio-error" : undefined}
              />
              {errors.fechaInicio && (
                <p id="fechaInicio-error" className="text-xs text-destructive" role="alert">
                  {errors.fechaInicio.message}
                </p>
              )}
            </div>

            {/* Fecha fin */}
            <div className="space-y-2">
              <Label
                htmlFor="fechaFin"
                className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
              >
                <Calendar size={13} strokeWidth={2} aria-hidden />
                Fecha de fin
              </Label>
              <Input
                id="fechaFin"
                type="date"
                {...register("fechaFin")}
                className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.fechaFin ? "border-destructive focus:ring-destructive" : ""}`}
                aria-describedby={errors.fechaFin ? "fechaFin-error" : undefined}
              />
              {errors.fechaFin && (
                <p id="fechaFin-error" className="text-xs text-destructive" role="alert">
                  {errors.fechaFin.message}
                </p>
              )}
            </div>
          </div>

          {/* Server error */}
          {serverError && (
            <div
              className="rounded-lg px-4 py-3 text-sm text-destructive bg-destructive/10 border border-destructive/40"
              role="alert"
            >
              {serverError}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link
              href="/ediciones"
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
