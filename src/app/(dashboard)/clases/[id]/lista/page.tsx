import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  School,
  User,
  Users,
  UsersRound,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { obtenerListaDeSesion } from "@/server/queries/listas-sesion";
import { listarStaffDeClase } from "@/server/queries/staff";
import { GestorStaffSesion } from "@/components/staff/GestorStaffSesion";
import { etiquetaTipo } from "@/lib/tipos-sesion";
import { formatearFecha, aISOFecha } from "@/lib/fechas";

// ─────────────────────────────────────────────────────────────────────────────
// La lista de una sesión: niños y staff, en una sola pantalla.
//
// Es lo que el cliente pidió «anexar». El Word exportable lo hará otro agente
// consumiendo `obtenerListaDeSesion`, la misma función que alimenta esta
// página: así la pantalla y el documento no pueden decir cosas distintas.
//
// Recordatorio: `[id]` es el id de una `Clase`, que en pantalla se llama
// «sesión»; las «fechas» son el modelo `Sesion`.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lista = await obtenerListaDeSesion(id);
  return {
    title: lista
      ? `Lista · ${lista.sesion.nombre} · Pasaporte Científico`
      : "Lista de la sesión · Pasaporte Científico",
  };
}

export default async function ListaSesionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { role } = session.user;
  const puedeEditar     = role === "ADMIN" || role === "BECARIO";
  const puedeVerContacto = puedeEditar;

  const { id } = await params;

  const [lista, staffAsignado] = await Promise.all([
    obtenerListaDeSesion(id, { incluirContactoStaff: puedeVerContacto }),
    // El gestor necesita la ficha completa de cada persona para poder
    // desasignarla; la lista de arriba es la vista de solo lectura.
    listarStaffDeClase(id),
  ]);

  if (!lista) notFound();

  const { sesion, fechas, ninos, staff, totales } = lista;

  const metricas = [
    { label: totales.ninos === 1 ? "Niño asistente" : "Niños asistentes",
      value: totales.ninos, colorClass: "text-primary" },
    { label: totales.staff === 1 ? "Persona de staff" : "Personas de staff",
      value: totales.staff, colorClass: "text-secondary-foreground" },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-3xl">
      <Link
        href={`/clases/${sesion.id}`}
        className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 text-muted-foreground"
      >
        <ArrowLeft size={15} />
        Volver a la sesión
      </Link>

      {/* Cabecera */}
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-snug text-foreground">
          Lista de la sesión
        </h1>
        <p className="text-sm mt-1.5 text-muted-foreground break-words">
          {sesion.nombre} · {sesion.edicion.nombre}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/30 text-secondary-foreground">
            {etiquetaTipo(sesion.tipo)}
          </span>
          {/* Un evento especial no lo imparte nadie: `investigador` es null y
              la línea sencillamente no se pinta. */}
          {sesion.investigador && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User size={13} strokeWidth={1.8} aria-hidden />
              {sesion.investigador}
            </span>
          )}
        </div>
        {fechas.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            <Calendar size={13} strokeWidth={1.8} aria-hidden />
            {fechas.map((f) => (
              <time key={f.id} dateTime={aISOFecha(f.fecha)}>
                {formatearFecha(f.fecha, "completa")}
              </time>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3 animate-fade-up animate-fade-up-delay-1">
        {metricas.map(({ label, value, colorClass }) => (
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

      {/* ── Staff ─────────────────────────────────────────────────────────── */}
      <section className="animate-fade-up animate-fade-up-delay-2">
        <h2
          className="flex items-center gap-2 text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground"
          style={{ letterSpacing: "0.07em" }}
        >
          <UsersRound size={14} aria-hidden />
          Staff de la sesión
        </h2>

        <GestorStaffSesion
          claseId={sesion.id}
          sesionNombre={sesion.nombre}
          staff={staffAsignado.map((persona) => ({
            ...persona,
            telefono: puedeVerContacto ? persona.telefono : null,
            correo:   puedeVerContacto ? persona.correo   : null,
          }))}
          puedeEditar={puedeEditar}
          puedeVerContacto={puedeVerContacto}
        />

        {!puedeEditar && staff.length > 0 && (
          <p className="text-xs mt-2 text-muted-foreground">
            Tu cuenta solo consulta: para cambiar el staff, pide acceso al
            coordinador.
          </p>
        )}
      </section>

      {/* ── Niños ─────────────────────────────────────────────────────────── */}
      <section className="animate-fade-up animate-fade-up-delay-3">
        <h2
          className="flex items-center gap-2 text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground"
          style={{ letterSpacing: "0.07em" }}
        >
          <Users size={14} aria-hidden />
          Niños que asistieron
        </h2>

        {ninos.length === 0 ? (
          <div className="rounded-2xl px-4 py-8 text-center text-sm bg-card border border-border text-muted-foreground">
            Todavía no hay asistencias registradas en esta sesión. La lista se
            llena al pasar lista.
          </div>
        ) : (
          <ol className="rounded-2xl overflow-hidden bg-card border border-border">
            {ninos.map((nino, i) => (
              <li
                key={nino.inscripcionId}
                className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0"
              >
                <span className="tabular text-xs mt-0.5 w-6 shrink-0 text-muted-foreground">
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/participantes/${nino.participanteId}`}
                    className="text-sm font-medium text-foreground break-words underline underline-offset-2 decoration-border hover:decoration-foreground"
                  >
                    {nino.nombre} {nino.apellidos}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs mt-0.5 text-muted-foreground">
                    <span className="flex items-center gap-1 break-words">
                      <School size={11} />
                      {nino.escuela}
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap size={11} />
                      {nino.grado}
                    </span>
                    <span className="tabular">{nino.edad} años</span>
                  </div>
                  {/* Con varias fechas hace falta saber a cuál vino; con una
                      sola, repetirla en cada renglón sería ruido. */}
                  {fechas.length > 1 && (
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      {nino.fechasAsistidas
                        .map((f) => formatearFecha(f, "media"))
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

    </div>
  );
}
