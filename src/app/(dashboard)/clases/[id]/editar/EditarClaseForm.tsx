"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Pencil, BookOpen, User, ImageIcon, Calendar, Tags } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";
import {
  TIPOS_SESION,
  VALORES_TIPO_SESION,
  descripcionTipo,
  exigeInvestigador,
  cuentaParaConstancia,
  type TipoSesion,
} from "@/lib/tipos-sesion";
import { IconoTipoSesion, clasesTipoSesion } from "@/components/clases/BadgeTipoSesion";

// ── Zod schema (cliente — refleja editarClaseSchema) ──────────────────────────

const formSchema = z.object({
  /**
   * La fecha se corrige aquí porque la página de la clase ya no ofrece crear
   * fechas sueltas: sin esto, un dedazo quedaría permanente.
   */
  fecha: z
    .string()
    .min(1, "Indica el día en que se imparte la sesión")
    .optional(),

  nombre: z
    .string({ error: "El nombre es requerido" })
    .min(1, "El nombre no puede estar vacío")
    .max(200, "El nombre no puede exceder 200 caracteres")
    .trim(),

  tipo: z.enum(VALORES_TIPO_SESION, {
    error: "Elige si es sesión de pasaporte, de lectura o un evento especial",
  }),

  investigador: z
    .string()
    .max(200, "El nombre del investigador no puede exceder 200 caracteres")
    .trim()
    .optional(),
})
  // Mismo criterio que el servidor: el investigador solo es obligatorio cuando
  // el tipo lo pide. Cambiar una charla a evento permite dejarlo vacío.
  .superRefine((datos, ctx) => {
    if (exigeInvestigador(datos.tipo) && !datos.investigador) {
      ctx.addIssue({
        code: "custom",
        path: ["investigador"],
        message: "El nombre del investigador no puede estar vacío",
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

interface EditarClaseFormProps {
  clase: {
    id: string;
    nombre: string;
    tipo: TipoSesion;
    /** Null en los eventos especiales: no los imparte ningún investigador. */
    investigador: string | null;
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
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: clase.nombre,
      tipo: clase.tipo,
      investigador: clase.investigador ?? "",
      fecha: clase.fecha ?? "",
    },
  });

  const tipo = watch("tipo");
  const investigadorObligatorio = exigeInvestigador(tipo);
  // Cambiar el tipo cambia si esa asistencia sigue contando: hay que decirlo
  // antes de guardar, porque puede dejar a un niño sin constancia (o dársela).
  const cambiaElConteo =
    tipo !== clase.tipo &&
    cuentaParaConstancia(tipo) !== cuentaParaConstancia(clase.tipo);

  async function onSubmit(data: FormData) {
    setLoading(true);
    setServerError(null);

    try {
      const res = await fetch(`/api/clases/${clase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.nombre,
          tipo: data.tipo,
          // Vacío significa "sin investigador"; el servidor solo lo acepta si
          // el tipo final lo permite.
          investigador: data.investigador || null,
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
            "No se pudieron guardar los cambios; la sesión sigue como estaba. Vuelve a intentarlo en unos minutos.",
        );
        return;
      }

      router.push(`/clases/${clase.id}`);
      router.refresh();
    } catch {
      setServerError(`${MENSAJE_SIN_CONEXION} Los cambios de la sesión no se guardaron.`);
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
          aria-label="Volver a la sesión"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver a la sesión
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
              Datos generales de la sesión
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
          aria-label="Formulario de edición de sesión"
        >
          {/* Nombre */}
          <div className="space-y-2">
            <Label
              htmlFor="nombre"
              className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
            >
              <BookOpen size={13} strokeWidth={2} aria-hidden />
              Nombre
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

          {/* Tipo de actividad */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground mb-2">
              <Tags size={13} strokeWidth={2} aria-hidden />
              Tipo
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TIPOS_SESION.map((opcion) => {
                const activo = tipo === opcion.valor;
                return (
                  <label
                    key={opcion.valor}
                    className={[
                      "flex sm:flex-col items-start gap-2 sm:gap-1.5 rounded-xl border p-3 cursor-pointer transition-colors min-h-[44px]",
                      "focus-within:outline-none focus-within:ring-2 ring-primary",
                      activo
                        ? clasesTipoSesion(opcion.valor)
                        : "bg-muted border-border text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      value={opcion.valor}
                      {...register("tipo")}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-1.5 font-semibold text-sm">
                      <IconoTipoSesion tipo={opcion.valor} size={15} />
                      {opcion.corta}
                    </span>
                    <span
                      className={`text-xs leading-snug ${activo ? "opacity-80" : "text-muted-foreground"}`}
                    >
                      {opcion.ayuda}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.tipo && (
              <p className="text-xs text-destructive" role="alert">
                {errors.tipo.message}
              </p>
            )}
            {/* Cambiar el tipo mueve asistencias dentro o fuera del conteo de
                la constancia. Avisarlo aquí es más barato que explicarlo
                después, cuando a un niño le cambió el número sin motivo
                aparente. */}
            {cambiaElConteo && (
              <p className="text-xs leading-relaxed rounded-lg px-3 py-2 bg-destructive/10 border border-destructive/35 text-foreground">
                {cuentaParaConstancia(tipo) ? (
                  <>
                    Al cambiarla a <strong>{descripcionTipo(tipo).etiqueta.toLowerCase()}</strong>, las
                    asistencias ya registradas <strong>empezarán a contar</strong> para el mínimo
                    de la constancia.
                  </>
                ) : (
                  <>
                    Al cambiarla a <strong>{descripcionTipo(tipo).etiqueta.toLowerCase()}</strong>, las
                    asistencias ya registradas <strong>dejarán de contar</strong> para el mínimo de
                    la constancia. No se borran, pero algún niño puede quedarse por debajo.
                  </>
                )}
              </p>
            )}
          </fieldset>

          {/* Investigador */}
          <div className="space-y-2">
            <Label
              htmlFor="investigador"
              className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"
            >
              <User size={13} strokeWidth={2} aria-hidden />
              Investigador responsable
              {!investigadorObligatorio && (
                <span className="text-xs font-normal text-muted-foreground/60">
                  (opcional)
                </span>
              )}
            </Label>
            <Input
              id="investigador"
              type="text"
              placeholder={
                investigadorObligatorio ? undefined : "Déjalo vacío si no lo imparte nadie"
              }
              {...register("investigador")}
              className={`h-11 rounded-lg bg-muted border-border transition-colors focus:ring-primary ${errors.investigador ? "border-destructive focus:ring-destructive" : ""}`}
              aria-describedby={errors.investigador ? "investigador-error" : undefined}
            />
            {errors.investigador ? (
              <p id="investigador-error" className="text-xs text-destructive" role="alert">
                {errors.investigador.message}
              </p>
            ) : (
              !investigadorObligatorio && (
                <p className="text-xs text-muted-foreground">
                  Un evento especial no lo imparte ningún investigador. Puedes dejarlo vacío.
                </p>
              )
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
                Esta sesión tiene {clase.totalFechas} fechas. Cambia cada una desde su
                tarjeta en la <span className="text-foreground font-medium">página de la sesión</span>.
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
              sesión, en la sección <span className="text-foreground font-medium">Contenido</span>.
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
