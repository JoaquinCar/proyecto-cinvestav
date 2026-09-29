import Link from "next/link";
import { Plus, Calendar, Users } from "lucide-react";
import { listarEdiciones } from "@/server/queries/ediciones";
import { listarClasesDeEdicion } from "@/server/queries/clases";
import { EmptyState } from "@/components/shared/EmptyState";
import { ClaseCard } from "@/components/clases/ClaseCard";
import { SelectorEdicion } from "@/components/clases/SelectorEdicion";
import { FiltroTipoSesion } from "@/components/clases/FiltroTipoSesion";
import { IconoTipoSesion, clasesTipoSesion } from "@/components/clases/BadgeTipoSesion";
import {
  TIPOS_SESION,
  descripcionTipo,
  esTipoSesion,
  type TipoSesion,
} from "@/lib/tipos-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// El listado de actividades de una edición, compartido por /clases y /eventos.
//
// POR QUÉ UNA SOLA PANTALLA Y NO DOS
//
// El cliente pidió que los eventos especiales tuvieran su propia entrada en la
// barra, y la tienen: /eventos. Pero pedir una entrada en la barra no es pedir
// otro modelo ni otro CRUD. Un evento es lo mismo que una sesión —tiene nombre,
// fecha, descripción, imágenes y se le pasa lista— y lo único que cambia es el
// tipo y si esa asistencia cuenta para la constancia.
//
// Duplicarlo habría significado dos tablas, dos formularios, dos vistas de
// asistencia y dos reportes que mantener en paralelo, y la primera vez que
// alguien arreglara un detalle en uno se olvidaría del otro. Así que /eventos
// es ESTA misma pantalla con `tipoFijo="EVENTO"`: mismo modelo, mismas
// consultas, misma tarjeta, y el filtro hace el resto.
// ─────────────────────────────────────────────────────────────────────────────

export async function PanelSesiones({
  edicionParam,
  tipoParam,
  esAdmin,
  /**
   * Cuando viene, la pantalla es la de ese tipo (hoy: /eventos). El filtro
   * desaparece —no tiene sentido ofrecer «ver también las charlas» en la
   * pantalla de eventos— y los textos se toman del catálogo de tipos.
   */
  tipoFijo,
}: {
  edicionParam?: string;
  tipoParam?: string;
  esAdmin: boolean;
  tipoFijo?: TipoSesion;
}) {
  const ediciones = await listarEdiciones();

  const basePath = tipoFijo ? "/eventos" : "/clases";
  const titulo = tipoFijo ? descripcionTipo(tipoFijo).plural : "Sesiones";
  const nombreNuevo = tipoFijo
    ? descripcionTipo(tipoFijo).etiqueta
    : "Sesión";

  // Sin ediciones no puede haber sesiones: una sesión siempre pertenece a una.
  if (ediciones.length === 0) {
    return (
      <div className="space-y-8 pb-16">
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl font-semibold text-foreground">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tipoFijo
              ? "Día del niño, clausura y demás actividades fuera del pasaporte"
              : "Catálogo de sesiones del programa"}
          </p>
        </div>
        <EmptyState
          message="Todavía no hay ediciones"
          detail={`Cada ${nombreNuevo.toLowerCase()} pertenece a una edición. Crea primero la edición del programa.`}
          action={
            esAdmin ? (
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

  // Edición seleccionada: la del parámetro, si no la activa, si no la más reciente.
  const edicionSeleccionada =
    ediciones.find((e) => e.id === edicionParam) ??
    ediciones.find((e) => e.activa) ??
    ediciones[0];

  // El filtro del querystring solo aplica en /clases; /eventos lo trae fijo.
  // Un `?tipo=` inventado se ignora en vez de reventar: el enlace pudo llegar
  // pegado en un mensaje.
  const tipoFiltro: TipoSesion | undefined =
    tipoFijo ?? (esTipoSesion(tipoParam) ? tipoParam : undefined);

  // Se piden SIEMPRE todas las de la edición: los contadores por tipo tienen
  // que salir del total, no de lo que quedó tras filtrar. El filtro se aplica
  // después, en memoria, sobre una lista de doce elementos.
  const todas = await listarClasesDeEdicion(edicionSeleccionada.id);
  const clases = tipoFiltro ? todas.filter((c) => c.tipo === tipoFiltro) : todas;

  const conteoPorTipo = new Map<TipoSesion, number>();
  for (const c of todas) {
    conteoPorTipo.set(c.tipo, (conteoPorTipo.get(c.tipo) ?? 0) + 1);
  }

  const conFecha = clases.filter((c) => c._count.sesiones > 0).length;

  // En /clases el resumen es el desglose por tipo —que es la novedad y lo que
  // el coordinador quiere ver de un golpe—. En /eventos, donde el tipo ya es
  // uno solo, se enseña lo de siempre: cuántos hay y cuántos tienen fecha.
  const resumen = tipoFijo
    ? [
        {
          clave: "total",
          label: `${descripcionTipo(tipoFijo).plural}`,
          value: clases.length,
          icono: <IconoTipoSesion tipo={tipoFijo} size={13} />,
          marco: clasesTipoSesion(tipoFijo),
        },
        {
          clave: "con-fecha",
          label: "Con fecha",
          value: conFecha,
          icono: <Calendar size={13} strokeWidth={2} className="text-success" aria-hidden />,
          marco: "bg-success/10 border-success/30 text-success",
        },
      ]
    : TIPOS_SESION.map((t) => ({
        clave: t.valor,
        label: t.plural,
        value: conteoPorTipo.get(t.valor) ?? 0,
        icono: <IconoTipoSesion tipo={t.valor} size={13} />,
        marco: clasesTipoSesion(t.valor),
      }));

  // El botón de crear arrastra el tipo: desde /eventos se crea un evento, no
  // una charla que luego haya que corregir.
  const hrefNueva =
    `/clases/nueva?edicion=${edicionSeleccionada.id}` +
    (tipoFiltro ? `&tipo=${tipoFiltro}` : "");

  const botonNueva = esAdmin ? (
    <Link
      href={hrefNueva}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px] w-full sm:w-auto"
      aria-label={`Crear ${nombreNuevo.toLowerCase()}`}
    >
      <Plus size={16} strokeWidth={2.5} aria-hidden />
      {tipoFijo ? "Nuevo evento" : "Nueva Sesión"}
    </Link>
  ) : null;

  return (
    <div className="space-y-8 pb-16">
      {/* Encabezado */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              {titulo}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {clases.length}{" "}
              {tipoFijo
                ? clases.length === 1
                  ? "evento"
                  : "eventos"
                : clases.length === 1
                  ? "sesión"
                  : "sesiones"}{" "}
              en {edicionSeleccionada.nombre} · {edicionSeleccionada.anio}
            </p>
          </div>
          <div className="hidden sm:block shrink-0">{botonNueva}</div>
        </div>

        {/* Selector de edición + botón (móvil) */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <SelectorEdicion
            ediciones={ediciones.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              anio: e.anio,
              activa: e.activa,
            }))}
            edicionActualId={edicionSeleccionada.id}
            basePath={basePath}
          />
          <div className="sm:hidden">{botonNueva}</div>
        </div>

        {/* Filtro por tipo — solo donde hay más de un tipo que enseñar */}
        {!tipoFijo && todas.length > 0 && (
          <div className="mt-4">
            <FiltroTipoSesion
              edicionId={edicionSeleccionada.id}
              tipoActual={tipoFiltro}
              conteos={TIPOS_SESION.map((t) => ({
                tipo: t.valor,
                cantidad: conteoPorTipo.get(t.valor) ?? 0,
              }))}
              total={todas.length}
            />
          </div>
        )}
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Resumen */}
      {todas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
          {resumen.map(({ clave, label, value, icono, marco }) => (
            <div
              key={clave}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  {label}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${marco}`}
                >
                  {icono}
                </div>
              </div>
              <div className="stat-number text-4xl tabular">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Listado */}
      {clases.length === 0 ? (
        <div className="animate-fade-up animate-fade-up-delay-2">
          <EmptyState
            message={
              tipoFiltro
                ? `No hay ${descripcionTipo(tipoFiltro).plural.toLowerCase()} en esta edición`
                : "No hay sesiones registradas en esta edición"
            }
            detail={
              esAdmin
                ? `Crea ${tipoFijo ? "el primer evento especial" : "la primera sesión"} para esta edición del programa.`
                : "El administrador aún no ha registrado nada para esta edición."
            }
            action={
              esAdmin ? (
                <Link
                  href={hrefNueva}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
                >
                  <Plus size={15} strokeWidth={2.5} aria-hidden />
                  {tipoFijo ? "Crear primer evento" : "Crear primera sesión"}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          className="grid gap-4 animate-fade-up animate-fade-up-delay-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))",
          }}
        >
          {clases.map((clase, i) => (
            <div
              key={clase.id}
              className={`animate-fade-up ${
                i < 4 ? `animate-fade-up-delay-${Math.min(i + 2, 4) as 1 | 2 | 3 | 4}` : ""
              }`}
            >
              <ClaseCard clase={clase} />
            </div>
          ))}
        </div>
      )}

      {/* Investigadores: solo tiene sentido donde hay charlas. */}
      {!tipoFijo && clases.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-up">
          <Users size={12} strokeWidth={2} aria-hidden />
          {new Set(clases.map((c) => c.investigador).filter(Boolean)).size}{" "}
          {new Set(clases.map((c) => c.investigador).filter(Boolean)).size === 1
            ? "investigador"
            : "investigadores"}{" "}
          en lo que se está mostrando
        </p>
      )}
    </div>
  );
}
