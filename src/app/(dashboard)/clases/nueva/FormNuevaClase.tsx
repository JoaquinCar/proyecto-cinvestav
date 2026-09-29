"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, BookOpen, User, AlignLeft, Layers, Calendar, Tags } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// ── Zod schema (cliente — refleja crearClaseSchema) ───────────────────────────

const formSchema = z
  .object({
    edicionId: z
      .string({ error: "La edición es requerida" })
      .min(1, "Selecciona la edición a la que pertenece la sesión"),

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

    fecha: z
      .string({ error: "La fecha es requerida" })
      .min(1, "Indica el día en que se imparte la sesión"),

    descripcion: z
      .string()
      .max(1000, "La descripción no puede exceder 1000 caracteres")
      .trim()
      .optional(),
  })
  // Mismo criterio que el servidor (`crearClaseSchema`): el investigador solo
  // es obligatorio cuando el tipo lo pide. Una clausura no la imparte nadie.
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
  /** Tipo con el que llega el formulario: desde /eventos ya viene EVENTO. */
  tipoInicial: TipoSesion;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FormNuevaClase({
  ediciones,
  edicionInicialId,
  tipoInicial,
}: FormNuevaClaseProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [edicionId, setEdicionId] = useState(edicionInicialId);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      edicionId: edicionInicialId,
      nombre: "",
      tipo: tipoInicial,
      investigador: "",
      fecha: "",
      descripcion: "",
    },
  });

  // El tipo elegido manda sobre medio formulario: si el investigador es
  // obligatorio, qué se avisa sobre la constancia y a dónde se vuelve.
  const tipo = watch("tipo");
  const d = descripcionTipo(tipo);
  const investigadorObligatorio = exigeInvestigador(tipo);

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
          tipo: data.tipo,
          // Vacío significa "sin investigador": el servidor lo guarda como
          // null y solo lo acepta si el tipo lo permite.
          investigador: data.investigador || undefined,
          fecha: data.fecha,
          descripcion: data.descripcion || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(
          json?.error ??
            `No se pudo crear ${d.etiqueta.toLowerCase()} y no quedó guardada. Vuelve a intentarlo en unos minutos.`,
        );
        return;
      }

      router.push(`/clases/${json.id}`);
      router.refresh();
    } catch {
      setServerError(
        `${MENSAJE_SIN_CONEXION} ${d.etiqueta} no quedó guardada.`,
      );
    } finally {
      setLoading(false);
    }
  }

  // Se vuelve a donde se venía: quien empezó en Eventos no debe acabar en el
  // listado general.
  const volverHref =
    tipo === "EVENTO" ? `/eventos?edicion=${edicionId}` : `/clases?edicion=${edicionId}`;
  const volverTexto = tipo === "EVENTO" ? "Volver a Eventos" : "Volver a Sesiones";

  return (
    <div className="space-y-8 pb-16">
      {/* Volver + título */}
      <div className="animate-fade-up">
        <Link
          href={volverHref}
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={volverTexto}
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          {volverTexto}
        </Link>

        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${clasesTipoSesion(tipo)}`}
          >
            <IconoTipoSesion tipo={tipo} size={20} />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              {tipo === "EVENTO" ? "Nuevo " : "Nueva "}
              <em className="text-primary not-italic font-semibold">
                {tipo === "EVENTO" ? "Evento" : d.etiqueta.replace("Sesión de ", "Sesión de ")}
              </em>
            </h1>
            <p className="text-sm mt-0.5 text-muted-foreground">{d.ayuda}</p>
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
          aria-label={`Formulario de ${d.etiqueta.toLowerCase()}`}
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
                Toda sesión pertenece a una edición. Por defecto se usa la edición activa.
              </p>
            )}
          </div>

          {/* Tipo de actividad */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground mb-2">
              <Tags size={13} strokeWidth={2} aria-hidden />
              Tipo
            </legend>
            {/* Tarjetas de radio y no un <select>: son tres opciones, cada una
                necesita su línea de explicación, y en el teléfono se aciertan
                con el pulgar sin abrir ningún menú. */}
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
            {/* El aviso solo aparece donde cambia algo: lo que no cuenta para
                la constancia hay que decirlo ANTES de crearlo, no después. */}
            {!cuentaParaConstancia(tipo) && (
              <p className="text-xs leading-relaxed rounded-lg px-3 py-2 bg-muted border border-border text-muted-foreground">
                Se le pasa lista igual, pero esa asistencia{" "}
                <strong className="font-semibold text-foreground">
                  no cuenta para el mínimo de la constancia
                </strong>
                : ese mínimo solo lo suman las sesiones de pasaporte.
              </p>
            )}
          </fieldset>

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
              placeholder={
                tipo === "EVENTO"
                  ? "Ej: Clausura 2026"
                  : tipo === "LECTURA"
                    ? "Ej: Lectura: El principito"
                    : "Ej: ¿Cuántos años tienen los peces?"
              }
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
                investigadorObligatorio
                  ? "Dr. / Dra. Nombre Apellido"
                  : "Déjalo vacío si no lo imparte nadie"
              }
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
                {investigadorObligatorio
                  ? "Nombre completo del investigador CINVESTAV que imparte la sesión"
                  : "Un evento especial no lo imparte ningún investigador. Ponlo solo si hay alguien a cargo."}
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
                Con la fecha, la sesión queda lista para pasar lista. Debe caer dentro
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
              placeholder="Breve descripción de los temas que se abordarán en esta sesión…"
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
                Puedes agregarla después —junto con imágenes— desde la página de la sesión
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
                tipo === "EVENTO" ? "Crear Evento" : "Crear Sesión"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
