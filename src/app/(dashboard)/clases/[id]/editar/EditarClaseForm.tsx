"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Pencil, BookOpen, User, ImageIcon, Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";

// ── Zod schema (cliente — refleja editarClaseSchema) ──────────────────────────

const formSchema = z.object({
  /**
   * La fecha se corrige aquí porque la página de la clase ya no ofrece crear
   * fechas sueltas: sin esto, un dedazo quedaría permanente.
   */
  fecha: z
    .string()
    .min(1, "Indica el día en que se imparte la clase")
    .optional(),

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
});

type FormData = z.infer<typeof formSchema>;

interface EditarClaseFormProps {
  clase: {
    id: string;
    nombre: string;
    investigador: string;
    /** Fecha de la clase como "AAAA-MM-DD"; null si no tiene ninguna todavía. */
    fecha: string | null;
    /** Cuántas fechas tiene. Más de una obliga a editarlas desde la clase. */
    totalFechas: number;
  };
  /** Rango de la edición: acota el calendario a días válidos. */
  edicion: { fechaInicio: string; fechaFin: string };
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EditarClaseForm({ clase, edicion }: EditarClaseFormProps) {
  // Con varias fechas no se sabe cuál cambiar: cada una se edita desde su
  // tarjeta en la página de la clase. Con una o ninguna, se edita aquí.
  const puedeEditarFecha = clase.totalFechas <= 1;

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
      nombre: clase.nombre,
      investigador: clase.investigador,
      fecha: clase.fecha ?? "",
    },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setServerError(null);

    try {
      const res = await fetch(`/api/clases/${clase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.nombre,
          investigador: data.investigador,
          // La fecha solo viaja si se puede editar y cambió de verdad: así una
          // clase con varias fechas nunca manda una que el servidor rechazaría.
          ...(puedeEditarFecha &&
            data.fecha &&
            data.fecha !== clase.fecha && { fecha: data.fecha }),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(
          json?.error ??
            "No se pudieron guardar los cambios; la clase sigue como estaba. Vuelve a intentarlo en unos minutos.",
        );
        return;
      }

      router.push(`/clases/${clase.id}`);
      router.refresh();
    } catch {
      setServerError(`${MENSAJE_SIN_CONEXION} Los cambios de la clase no se guardaron.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Volver + título */}
      <div className="animate-fade-up">
        <Link
          href={`/clases/${clase.id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Volver a la clase"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la clase
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
            <Pencil size={18} strokeWidth={1.8} className="text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground truncate">
              Editar <em className="text-primary not-italic font-semibold">{clase.nombre}</em>
            </h1>
            <p className="text-sm mt-0.5 text-muted-foreground">
              Datos generales de la clase
            </p>
          </div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Formulario */}
      <div
        className="animate-fade-up animate-fade-up-delay-2 bg-card border border-border rounded-2xl p-5 sm:p-8"
        style={{ maxWidth: "38rem" }}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
          noValidate
          aria-label="Formulario de edición de clase"
        >
          {/* Nombre */}
          <div className="space-y-2">
            <Label
              htmlFor="nombre"
              className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
            >
              <BookOpen size={13} strokeWidth={2} aria-hidden />
              Nombre de la clase
            </Label>
            <Input
              id="nombre"
              type="text"
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

          {/* Investigador */}
          <div className="space-y-2">
            <Label
              htmlFor="investigador"
              className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
            >
              <User size={13} strokeWidth={2} aria-hidden />
              Investigador responsable
            </Label>
            <Input
              id="investigador"
              type="text"
              {...register("investigador")}
              className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.investigador ? "border-destructive focus:ring-destructive" : ""}`}
              aria-describedby={errors.investigador ? "investigador-error" : undefined}
            />
            {errors.investigador && (
              <p id="investigador-error" className="text-xs text-destructive" role="alert">
                {errors.investigador.message}
              </p>
            )}
          </div>

          {/* Fecha de la clase */}
          {puedeEditarFecha ? (
            <div className="space-y-2">
              <Label
                htmlFor="fecha"
                className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
              >
                <Calendar size={13} strokeWidth={2} aria-hidden />
                Día en que se imparte
              </Label>
              <Input
                id="fecha"
                type="date"
                min={edicion.fechaInicio}
                max={edicion.fechaFin}
                {...register("fecha")}
                className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.fecha ? "border-destructive focus:ring-destructive" : ""}`}
                aria-describedby={errors.fecha ? "fecha-error" : "fecha-hint"}
              />
              {errors.fecha ? (
                <p id="fecha-error" className="text-xs text-destructive" role="alert">
                  {errors.fecha.message}
                </p>
              ) : (
                <p id="fecha-hint" className="text-xs text-muted-foreground">
                  Debe caer dentro de la edición. Es la fecha con la que se pasa lista.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-muted border border-border px-4 py-3">
              <Calendar
                size={15}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0 text-primary"
                aria-hidden
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Esta clase tiene {clase.totalFechas} fechas. Cambia cada una desde su
                tarjeta en la <span className="text-foreground font-medium">página de la clase</span>.
              </p>
            </div>
          )}

          {/* Aviso: la descripción y las imágenes se gestionan en el detalle */}
          <div className="flex items-start gap-2.5 rounded-xl bg-muted border border-border px-4 py-3">
            <ImageIcon
              size={15}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              La descripción y las imágenes se agregan y editan desde la página de la
              clase, en la sección <span className="text-foreground font-medium">Contenido</span>.
            </p>
          </div>

          {/* Error del servidor */}
          {serverError && (
            <div
              className="rounded-lg px-4 py-3 text-sm text-destructive bg-destructive/10 border border-destructive/40"
              role="alert"
            >
              {serverError}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link
              href={`/clases/${clase.id}`}
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
                "Guardar cambios"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
