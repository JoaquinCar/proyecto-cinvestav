"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, BookOpen, User, AlignLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── Zod schema (client side — mirrors crearClaseSchema) ───────────────────────

const formSchema = z.object({
  nombre: z
    .string({ error: "El nombre es requerido" })
    .min(1, "El nombre no puede estar vacío")
    .max(200, "El nombre no puede exceder 200 caracteres")
    .trim(),

  investigador: z
    .string({ error: "El investigador es requerido" })
    .min(1, "El nombre del investigador no puede estar vacío")
    .max(200, "El nombre del investigador no puede exceder 200 caracteres")
    .trim(),

  descripcion: z
    .string()
    .max(1000, "La descripción no puede exceder 1000 caracteres")
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

export default function NuevaClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: edicionId } = use(params);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: "", investigador: "", descripcion: "" },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/clases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, edicionId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json?.error ?? "Error al crear la clase. Intenta de nuevo.");
        return;
      }

      router.push(`/ediciones/${edicionId}/clases`);
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
          href={`/ediciones/${edicionId}/clases`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors"
          style={{ color: "oklch(0.62 0.06 235)" }}
          aria-label="Volver a Clases"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a Clases
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.72 0.165 72 / 0.12)" }}
          >
            <BookOpen
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
              Nueva{" "}
              <em style={{ color: "oklch(0.72 0.165 72)", fontStyle: "normal" }}>Clase</em>
            </h1>
            <p className="text-sm mt-0.5" style={hintStyle}>
              Agrega una nueva clase al catálogo de esta edición
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
          maxWidth: "38rem",
        }}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
          noValidate
          aria-label="Formulario de nueva clase"
        >
          {/* Nombre */}
          <div className="space-y-2">
            <Label
              htmlFor="nombre"
              className="text-sm font-medium flex items-center gap-1.5"
              style={labelStyle}
            >
              <BookOpen size={13} strokeWidth={2} aria-hidden />
              Nombre de la clase
            </Label>
            <Input
              id="nombre"
              type="text"
              placeholder="Ej: Astronomía, Robótica, Genética…"
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

          {/* Investigador */}
          <div className="space-y-2">
            <Label
              htmlFor="investigador"
              className="text-sm font-medium flex items-center gap-1.5"
              style={labelStyle}
            >
              <User size={13} strokeWidth={2} aria-hidden />
              Investigador responsable
            </Label>
            <Input
              id="investigador"
              type="text"
              placeholder="Dr. / Dra. Nombre Apellido"
              {...register("investigador")}
              style={fieldStyle(!!errors.investigador)}
              className="h-11 transition-colors focus:border-primary"
              aria-describedby={errors.investigador ? "investigador-error" : "investigador-hint"}
            />
            {errors.investigador ? (
              <p id="investigador-error" className="text-xs" style={errorStyle} role="alert">
                {errors.investigador.message}
              </p>
            ) : (
              <p id="investigador-hint" className="text-xs" style={hintStyle}>
                Nombre completo del investigador CINVESTAV que imparte la clase
              </p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label
              htmlFor="descripcion"
              className="text-sm font-medium flex items-center gap-1.5"
              style={labelStyle}
            >
              <AlignLeft size={13} strokeWidth={2} aria-hidden />
              Descripción
              <span
                className="text-xs font-normal"
                style={{ color: "oklch(0.45 0.04 248)" }}
              >
                (opcional)
              </span>
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Breve descripción de los temas que se abordarán en esta clase…"
              rows={4}
              {...register("descripcion")}
              style={fieldStyle(!!errors.descripcion)}
              className="resize-none transition-colors focus:border-primary"
              aria-describedby={errors.descripcion ? "descripcion-error" : "descripcion-hint"}
            />
            {errors.descripcion ? (
              <p id="descripcion-error" className="text-xs" style={errorStyle} role="alert">
                {errors.descripcion.message}
              </p>
            ) : (
              <p id="descripcion-hint" className="text-xs" style={hintStyle}>
                Esta descripción es opcional y puede editarse después
              </p>
            )}
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
              href={`/ediciones/${edicionId}/clases`}
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
                "Crear Clase"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
