"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, BookOpen, User, AlignLeft, Layers, Calendar } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";

// ── Zod schema (cliente — refleja crearClaseSchema) ───────────────────────────

const formSchema = z.object({
  edicionId: z
    .string({ error: "La edición es requerida" })
    .min(1, "Selecciona la edición a la que pertenece la clase"),

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

  fecha: z
    .string({ error: "La fecha es requerida" })
    .min(1, "Indica el día en que se imparte la clase"),

  descripcion: z
    .string()
    .max(1000, "La descripción no puede exceder 1000 caracteres")
    .trim()
    .optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EdicionOpcion {
  id: string;
  nombre: string;
  anio: number;
  activa: boolean;
  /** Rango de la edición como "AAAA-MM-DD": acota el selector de fecha. */
  fechaInicio: string;
  fechaFin: string;
}

interface FormNuevaClaseProps {
  ediciones: EdicionOpcion[];
  edicionInicialId: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FormNuevaClase({
  ediciones,
  edicionInicialId,
}: FormNuevaClaseProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [edicionId, setEdicionId] = useState(edicionInicialId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      edicionId: edicionInicialId,
      nombre: "",
      investigador: "",
      fecha: "",
      descripcion: "",
    },
  });

  const registroEdicion = register("edicionId");

  // El `<input type="date">` se acota al rango de la edición elegida: así el
  // calendario del teléfono no ofrece días que el servidor va a rechazar.
  const edicionElegida =
    ediciones.find((e) => e.id === edicionId) ?? ediciones[0];

  async function onSubmit(data: FormData) {
    setLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/clases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edicionId: data.edicionId,
          nombre: data.nombre,
          investigador: data.investigador,
          fecha: data.fecha,
          descripcion: data.descripcion || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(
          json?.error ??
            "No se pudo crear la clase y no quedó guardada. Vuelve a intentarlo en unos minutos.",
        );
        return;
      }

      router.push(`/clases/${json.id}`);
      router.refresh();
    } catch {
      setServerError(`${MENSAJE_SIN_CONEXION} La clase no quedó guardada.`);
    } finally {
      setLoading(false);
    }
  }

  const volverHref = `/clases?edicion=${edicionId}`;

  return (
    <div className="space-y-8 pb-16">
      {/* Volver + título */}
      <div className="animate-fade-up">
        <Link
          href={volverHref}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Volver a Clases"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a Clases
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
            <BookOpen size={20} strokeWidth={1.8} className="text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              Nueva <em className="text-primary not-italic font-semibold">Clase</em>
            </h1>
            <p className="text-sm mt-0.5 text-muted-foreground">
              Una clase es una charla impartida en una fecha
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
          aria-label="Formulario de nueva clase"
        >
          {/* Edición */}
          <div className="space-y-2">
            <Label
              htmlFor="edicionId"
              className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
            >
              <Layers size={13} strokeWidth={2} aria-hidden />
              Edición
            </Label>
            <select
              id="edicionId"
              {...registroEdicion}
              onChange={(e) => {
                void registroEdicion.onChange(e);
                setEdicionId(e.target.value);
              }}
              className={`w-full min-h-[44px] rounded-lg bg-muted border border-border text-sm text-foreground px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 ring-primary ${
                errors.edicionId ? "border-destructive" : ""
              }`}
              aria-describedby={errors.edicionId ? "edicionId-error" : "edicionId-hint"}
            >
              {ediciones.map((edicion) => (
                <option key={edicion.id} value={edicion.id}>
                  {edicion.nombre} · {edicion.anio}
                  {edicion.activa ? " (activa)" : ""}
                </option>
              ))}
            </select>
            {errors.edicionId ? (
              <p id="edicionId-error" className="text-xs text-destructive" role="alert">
                {errors.edicionId.message}
              </p>
            ) : (
              <p id="edicionId-hint" className="text-xs text-muted-foreground">
                Toda clase pertenece a una edición. Por defecto se usa la edición activa.
              </p>
            )}
          </div>

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
              placeholder="Ej: ¿Cuántos años tienen los peces?"
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
              placeholder="Dr. / Dra. Nombre Apellido"
              {...register("investigador")}
              className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.investigador ? "border-destructive focus:ring-destructive" : ""}`}
              aria-describedby={
                errors.investigador ? "investigador-error" : "investigador-hint"
              }
            />
            {errors.investigador ? (
              <p id="investigador-error" className="text-xs text-destructive" role="alert">
                {errors.investigador.message}
              </p>
            ) : (
              <p id="investigador-hint" className="text-xs text-muted-foreground">
                Nombre completo del investigador CINVESTAV que imparte la clase
              </p>
            )}
          </div>

          {/* Fecha */}
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
              min={edicionElegida?.fechaInicio}
              max={edicionElegida?.fechaFin}
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
                Con la fecha, la clase queda lista para pasar lista. Debe caer dentro
                de la edición; después puedes corregirla desde Editar.
              </p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label
              htmlFor="descripcion"
              className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
            >
              <AlignLeft size={13} strokeWidth={2} aria-hidden />
              Descripción
              <span className="text-xs font-normal text-muted-foreground/60">(opcional)</span>
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Breve descripción de los temas que se abordarán en esta clase…"
              rows={4}
              {...register("descripcion")}
              className={`rounded-lg bg-muted border-border resize-none transition-colors focus:ring-primary ${errors.descripcion ? "border-destructive focus:ring-destructive" : ""}`}
              aria-describedby={errors.descripcion ? "descripcion-error" : "descripcion-hint"}
            />
            {errors.descripcion ? (
              <p id="descripcion-error" className="text-xs text-destructive" role="alert">
                {errors.descripcion.message}
              </p>
            ) : (
              <p id="descripcion-hint" className="text-xs text-muted-foreground">
                Puedes agregarla después —junto con imágenes— desde la página de la clase
              </p>
            )}
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
              href={volverHref}
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
                "Crear Clase"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
