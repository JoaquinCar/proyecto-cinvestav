import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Images, BookOpen, CameraOff, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { listarEdiciones } from "@/server/queries/ediciones";
import { listarImagenesDeEdicionPorSesion } from "@/server/queries/imagenes-clase";
import { resolverEdicionSeleccionada } from "@/lib/edicion-seleccionada";
import { EmptyState } from "@/components/shared/EmptyState";
import { SelectorEdicion } from "@/components/clases/SelectorEdicion";
import { GaleriaSesion } from "@/components/biblioteca/GaleriaSesion";
import { formatearFecha, aISOFecha } from "@/lib/fechas";

export const metadata: Metadata = {
  title: "Biblioteca de fotos · Pasaporte Científico",
};

// ── Página ────────────────────────────────────────────────────────────────────
//
// Todas las fotos de una edición, agrupadas por la sesión en que se tomaron.
// Nace de una petición concreta del programa: "un apartado biblioteca donde
// estén todas las fotos, divididas por sesiones", para armar el reporte anual
// sin ir entrando sesión por sesión.
//
// Dos decisiones que conviene no deshacer sin querer:
//
// · Se renderiza en el servidor, no se pide por JSON desde el navegador. La
//   lista sale de UNA consulta y llega dentro del HTML; lo que el navegador pide
//   después son los archivos de las fotos, y esos van por el proxy autenticado.
//
// · El proxy es innegociable: en estas fotos aparecen menores. Nada de
//   `next/image` ni de URLs públicas — ver los comentarios en
//   `src/server/queries/imagenes-clase.ts`.

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  // Reordenar es una decisión editorial sobre el reporte: la toman quienes
  // trabajan el programa. READONLY consulta la biblioteca y nada más.
  const puedeReordenar =
    session.user.role === "ADMIN" || session.user.role === "BECARIO";

  const { edicion: edicionParam } = await searchParams;
  const ediciones = await listarEdiciones();

  if (ediciones.length === 0) {
    return (
      <div className="space-y-8 pb-16">
        <Encabezado total={0} sesiones={0} subtitulo="Fotos del programa" />
        <EmptyState
          message="Todavía no hay ediciones"
          detail="Las fotos cuelgan de las sesiones de una edición. Crea primero la edición del programa."
          action={
            isAdmin ? (
              <Link
                href="/ediciones/nueva"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
              >
                <Plus size={15} strokeWidth={2.5} aria-hidden />
                Crear edición
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const edicionSeleccionada = resolverEdicionSeleccionada(
    ediciones,
    edicionParam,
  )!;

  const grupos = await listarImagenesDeEdicionPorSesion(edicionSeleccionada.id);

  const totalFotos = grupos.reduce((suma, g) => suma + g.imagenes.length, 0);
  const conFotos = grupos.filter((g) => g.imagenes.length > 0);
  const sinFotos = grupos.filter((g) => g.imagenes.length === 0);

  return (
    <div className="space-y-8 pb-16">
      <div className="animate-fade-up">
        <Encabezado
          total={totalFotos}
          sesiones={conFotos.length}
          subtitulo={`${edicionSeleccionada.nombre} · ${edicionSeleccionada.anio}`}
        />

        <div className="mt-4">
          <SelectorEdicion
            ediciones={ediciones.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              anio: e.anio,
              activa: e.activa,
            }))}
            edicionActualId={edicionSeleccionada.id}
            basePath="/biblioteca"
          />
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {grupos.length === 0 ? (
        <div className="animate-fade-up animate-fade-up-delay-2">
          <EmptyState
            message="Esta edición todavía no tiene sesiones"
            detail="Las fotos se suben desde cada sesión; sin sesiones no hay dónde ponerlas."
            action={
              isAdmin ? (
                <Link
                  href={`/clases/nueva?edicion=${edicionSeleccionada.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
                >
                  <Plus size={15} strokeWidth={2.5} aria-hidden />
                  Crear sesión
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : totalFotos === 0 ? (
        <div className="animate-fade-up animate-fade-up-delay-2">
          <EmptyState
            message="Todavía no hay fotos en esta edición"
            detail="Las fotos se agregan desde la página de cada sesión: ahí se pueden subir, pegar con ⌘/Ctrl + V o arrastrar."
            action={
              <Link
                href={`/clases?edicion=${edicionSeleccionada.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
              >
                <BookOpen size={15} strokeWidth={2.2} aria-hidden />
                Ir a las sesiones
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-4 animate-fade-up animate-fade-up-delay-2">
            {conFotos.map((grupo) => (
              <GaleriaSesion
                key={grupo.claseId}
                claseId={grupo.claseId}
                nombre={grupo.nombre}
                investigador={grupo.investigador}
                fechaTexto={
                  grupo.fecha ? formatearFecha(grupo.fecha, "media") : null
                }
                fechaISO={grupo.fecha ? aISOFecha(grupo.fecha) : null}
                imagenes={grupo.imagenes.map((imagen) => ({
                  id: imagen.id,
                  url: imagen.url,
                  titulo: imagen.titulo,
                  tamano: imagen.tamano,
                }))}
                puedeReordenar={puedeReordenar}
              />
            ))}
          </div>

          {/* Qué falta por subir. Armar el reporte es justamente descubrir que
              a una sesión no se le tomó ni una foto, y eso no se ve en una
              biblioteca que solo enseña lo que ya está. */}
          {sinFotos.length > 0 && (
            <section
              className="animate-fade-up animate-fade-up-delay-3 bg-muted/40 border border-dashed border-border rounded-2xl p-4 sm:p-5"
              aria-labelledby="sesiones-sin-fotos"
            >
              <h2
                id="sesiones-sin-fotos"
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <CameraOff
                  size={15}
                  strokeWidth={1.8}
                  className="text-muted-foreground"
                  aria-hidden
                />
                {sinFotos.length === 1
                  ? "Una sesión sin fotos"
                  : `${sinFotos.length} sesiones sin fotos`}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {sinFotos.map((grupo) => (
                  <li key={grupo.claseId}>
                    <Link
                      href={`/clases/${grupo.claseId}`}
                      className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-card border border-border text-primary hover:bg-surface-alt min-h-[36px]"
                    >
                      {grupo.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Encabezado ────────────────────────────────────────────────────────────────

function Encabezado({
  total,
  sesiones,
  subtitulo,
}: {
  total: number;
  sesiones: number;
  subtitulo: string;
}) {
  return (
    <div className="flex items-start gap-4 min-w-0">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary/10">
        <Images
          size={22}
          strokeWidth={1.8}
          className="text-secondary-foreground"
          aria-hidden
        />
      </div>
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
          Biblioteca
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total > 0
            ? `${total} ${total === 1 ? "foto" : "fotos"} en ${sesiones} ${
                sesiones === 1 ? "sesión" : "sesiones"
              } · ${subtitulo}`
            : subtitulo}
        </p>
      </div>
    </div>
  );
}
