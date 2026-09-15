import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  Mail,
  Phone,
  School,
  Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { obtenerAcompanante } from "@/server/queries/acompanantes";
import { PARENTESCO_LABEL } from "@/lib/schemas/acompanante.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Ficha del acompañante: a quién acompaña.
//
// Es la vista que convierte el dato en algo útil. En 2026, un mismo contacto
// inscribió a 25 niños y siete parejas de hermanos compartieron el suyo, pero
// eso solo se podía ver cruzando correos a mano en una hoja. Aquí se ve de un
// vistazo, y agrupado por edición porque quién acompaña cambia de un año a otro.
// ─────────────────────────────────────────────────────────────────────────────

function nombreCompleto(a: { nombre: string; apellidos: string | null }) {
  return [a.nombre, a.apellidos].filter(Boolean).join(" ").trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const acompanante = await obtenerAcompanante(id);
  if (!acompanante) return { title: "Acompañante" };
  return { title: `${nombreCompleto(acompanante)} · Acompañante` };
}

export default async function AcompananteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const acompanante = await obtenerAcompanante(id);

  if (!acompanante) notFound();

  // El teléfono y el correo son datos personales de un adulto: los ve quien
  // captura, no quien solo consulta reportes. Mismo criterio que el listado de
  // participantes, que tampoco expone el contacto de los padres.
  const puedeVerContacto =
    session.user.role === "ADMIN" || session.user.role === "BECARIO";

  // Agrupadas por edición: los 25 del grupo en 2026, los 2 hermanos en 2027.
  const porEdicion = new Map<
    string,
    {
      anio: number;
      nombre: string;
      activa: boolean;
      ninos: typeof acompanante.inscripciones;
    }
  >();

  for (const inscripcion of acompanante.inscripciones) {
    const { edicion } = inscripcion;
    const grupo = porEdicion.get(edicion.id) ?? {
      anio: edicion.anio,
      nombre: edicion.nombre,
      activa: edicion.activa,
      ninos: [],
    };
    grupo.ninos.push(inscripcion);
    porEdicion.set(edicion.id, grupo);
  }

  const ediciones = Array.from(porEdicion.entries()).sort(
    (a, b) => b[1].anio - a[1].anio,
  );

  const totalNinos = acompanante.inscripciones.length;
  const esColectivo =
    acompanante.parentesco === "GRUPO" || acompanante.parentesco === "INSTITUCION";

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/participantes"
        className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 text-muted-foreground"
      >
        <ArrowLeft size={15} />
        Volver a participantes
      </Link>

      {/* Cabecera */}
      <div className="animate-fade-up">
        <div className="flex items-start gap-5">
          <div
            className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center bg-secondary/10 border border-secondary/30 text-secondary-foreground"
            aria-hidden="true"
          >
            {esColectivo ? (
              <Users size={26} />
            ) : (
              <span className="text-2xl font-semibold">
                {acompanante.nombre.charAt(0).toUpperCase()}
                {(acompanante.apellidos ?? "").charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-light leading-tight text-foreground">
              {acompanante.nombre}{" "}
              {acompanante.apellidos && (
                <em className="text-primary not-italic font-semibold">
                  {acompanante.apellidos}
                </em>
              )}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                {PARENTESCO_LABEL[acompanante.parentesco]}
              </span>
              {puedeVerContacto && acompanante.telefono && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} />
                  <span className="tabular">{acompanante.telefono}</span>
                </span>
              )}
              {puedeVerContacto && acompanante.correo && (
                <span className="flex items-center gap-1.5 break-all">
                  <Mail size={14} />
                  {acompanante.correo}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Cuántos niños, en cuántas ediciones */}
      <div className="grid grid-cols-2 gap-3 animate-fade-up animate-fade-up-delay-1">
        {[
          {
            label: totalNinos === 1 ? "Niño acompañado" : "Niños acompañados",
            value: totalNinos,
            colorClass: "text-primary",
          },
          {
            label: ediciones.length === 1 ? "Edición" : "Ediciones",
            value: ediciones.length,
            colorClass: "text-secondary-foreground",
          },
        ].map(({ label, value, colorClass }) => (
          <div key={label} className="rounded-2xl p-4 bg-card border border-border">
            <p
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              style={{ letterSpacing: "0.07em" }}
            >
              {label}
            </p>
            <p className={["stat-number text-4xl mt-2", colorClass].join(" ")}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* A quién acompaña */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <h2
          className="text-sm font-semibold mb-4 uppercase tracking-wide text-muted-foreground"
          style={{ letterSpacing: "0.07em" }}
        >
          A quién acompaña
        </h2>

        {ediciones.length === 0 ? (
          <div className="rounded-2xl px-4 py-8 text-center text-sm bg-card border border-border text-muted-foreground">
            Todavía no acompaña a ningún participante.
          </div>
        ) : (
          <div className="space-y-4">
            {ediciones.map(([edicionId, grupo]) => (
              <div
                key={edicionId}
                className="rounded-2xl bg-card border border-border overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar size={13} className="text-muted-foreground" />
                    <span className="font-display text-base font-medium text-foreground">
                      {grupo.nombre}
                    </span>
                    {grupo.activa && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/12 border border-success/35 text-success">
                        Actual
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    <span className="tabular">{grupo.ninos.length}</span>
                    {grupo.ninos.length === 1 ? " niño" : " niños"}
                  </span>
                </div>

                <ul>
                  {grupo.ninos.map(({ id: inscripcionId, participante }) => (
                    <li key={inscripcionId}>
                      <Link
                        href={`/participantes/${participante.id}`}
                        className="attendance-item w-full text-left rounded-none border-x-0 border-b border-t-0 last:border-b-0 px-4 py-3 min-h-0 gap-3 border-border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate text-foreground">
                            {participante.nombre} {participante.apellidos}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs mt-0.5 text-muted-foreground">
                            <span className="flex items-center gap-1 truncate">
                              <School size={11} />
                              {participante.escuela}
                            </span>
                            <span className="flex items-center gap-1">
                              <GraduationCap size={11} />
                              {participante.grado}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
