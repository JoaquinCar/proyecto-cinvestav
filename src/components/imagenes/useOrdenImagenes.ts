"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { mensajeDeError } from "@/lib/api/errores";
import { reordenarImagenes } from "@/lib/api/imagenes";
import { moverImagen, posicionDestino, type Movimiento } from "@/lib/orden-imagenes";

/**
 * Estado del orden de una galería: lo comparten la biblioteca y el detalle de
 * la sesión, que pintan las fotos distinto pero las reordenan igual.
 *
 * Lo que resuelve, por partes:
 *
 * · **Se ve antes de guardarse.** La foto cambia de sitio al instante y la
 *   petición sale después. Reordenar son muchos toques seguidos y esperar al
 *   servidor entre uno y otro haría el trabajo insoportable desde el teléfono.
 *
 * · **Una petición por ráfaga, no por toque.** Cuatro toques para bajar una
 *   foto cuatro puestos son una sola llamada: el guardado se aplaza medio
 *   segundo y cada toque reinicia la espera. Como se manda siempre la lista
 *   completa, la última gana y las intermedias no hacen falta.
 *
 * · **Si falla, se deshace.** Se recuerda el último orden que el servidor
 *   confirmó y la galería vuelve a él, para que nadie se quede creyendo que
 *   guardó algo que no se guardó.
 */

/** Espera antes de mandar el orden, para agrupar toques seguidos. */
const RETARDO_GUARDADO = 600;

export type EstadoOrden = "inactivo" | "guardando" | "guardado" | "error";

export interface OrdenImagenes {
  /** Ids en el orden que se está mostrando. */
  ids: readonly string[];
  /** Mueve una foto; no hace nada si el movimiento no la cambia de sitio. */
  mover: (id: string, movimiento: Movimiento) => void;
  /** Manda ya lo que esté pendiente (al salir del modo ordenar, por ejemplo). */
  guardarPendiente: () => void;
  estado: EstadoOrden;
  /** Texto para la región `aria-live`: lo único que oye un lector de pantalla. */
  anuncio: string;
}

export function useOrdenImagenes(
  claseId: string,
  idsIniciales: readonly string[],
): OrdenImagenes {
  const [ids, setIds] = useState<readonly string[]>(idsIniciales);
  const [estado, setEstado] = useState<EstadoOrden>("inactivo");
  const [anuncio, setAnuncio] = useState("");

  /** Último orden que el servidor confirmó: a este se vuelve si algo falla. */
  const confirmados = useRef<readonly string[]>(idsIniciales);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Las peticiones se encadenan para que no se adelante una a otra. */
  const cola = useRef<Promise<void>>(Promise.resolve());

  // El servidor manda: tras subir o borrar una foto la página se refresca con
  // otra lista y hay que adoptarla, o la galería se quedaría pintando la vieja.
  //
  // Se ajusta durante el render y no en un efecto, que es lo que React
  // recomienda para "este estado se deriva de una prop que cambió": con un
  // efecto habría un repintado de más con la lista vieja. Se compara el
  // contenido, porque `idsIniciales` es un array nuevo en cada render del padre.
  const firmaInicial = idsIniciales.join(",");
  const [firmaAdoptada, setFirmaAdoptada] = useState(firmaInicial);
  if (firmaInicial !== firmaAdoptada) {
    setFirmaAdoptada(firmaInicial);
    setIds(idsIniciales);
  }

  // El "último orden confirmado" se apunta después de pintar, no durante el
  // render: tocar una ref mientras se renderiza rompe la regla de React de que
  // el render sea puro. Entre el repintado y este efecto puede colarse un
  // guardado que revierta a la lista anterior, y da igual: esa lista también la
  // había confirmado el servidor.
  // La lista sale de la propia firma, y no de `idsIniciales`, para que la
  // dependencia del efecto sea un string: con el array —nuevo en cada render
  // del padre— el efecto correría siempre y pisaría el orden que `guardar`
  // acaba de confirmar con el que traía la página, que ya es el viejo.
  useEffect(() => {
    confirmados.current = firmaAdoptada === "" ? [] : firmaAdoptada.split(",");
  }, [firmaAdoptada]);

  const guardar = useCallback(
    async (objetivo: readonly string[]) => {
      setEstado("guardando");
      try {
        await reordenarImagenes(claseId, objetivo);
        confirmados.current = objetivo;
        setEstado("guardado");
      } catch (error) {
        // Se vuelve a lo último confirmado: si el servidor rechazó el cambio,
        // dejar las fotos movidas en pantalla sería mentir.
        setIds(confirmados.current);
        setEstado("error");
        toast.error(
          mensajeDeError(
            error,
            "No se pudo guardar el nuevo orden de las fotos; siguen como estaban. Vuelve a intentarlo en unos minutos.",
          ),
        );
      }
    },
    [claseId],
  );

  /** Orden aplazado que todavía no ha salido hacia el servidor. */
  const pendiente = useRef<readonly string[] | null>(null);

  const programar = useCallback(
    (objetivo: readonly string[]) => {
      pendiente.current = objetivo;
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        temporizador.current = null;
        pendiente.current = null;
        cola.current = cola.current.then(() => guardar(objetivo));
      }, RETARDO_GUARDADO);
    },
    [guardar],
  );

  const mover = useCallback(
    (id: string, movimiento: Movimiento) => {
      setIds((actuales) => {
        const siguientes = moverImagen(actuales, id, movimiento);
        // Misma referencia: el movimiento no cambiaba nada (la primera no puede
        // subir). Ni se repinta ni se manda nada.
        if (siguientes === actuales) return actuales;

        const posicion = posicionDestino(actuales, id, movimiento);
        setAnuncio(
          `Foto movida a la posición ${posicion} de ${actuales.length}.`,
        );
        programar(siguientes);
        return siguientes;
      });
    },
    [programar],
  );

  const guardarPendiente = useCallback(() => {
    const objetivo = pendiente.current;
    if (!objetivo) return;

    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    pendiente.current = null;
    cola.current = cola.current.then(() => guardar(objetivo));
  }, [guardar]);

  // Al desmontar —irse a otra página, cerrar la pestaña— se manda lo que quedara
  // aplazado, sin pasar por `guardar`: ese componente ya no existe y no puede
  // enseñar un toast ni revertir nada. Perder el orden por salir medio segundo
  // después del último toque sería peor que un fallo silencioso.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      const objetivo = pendiente.current;
      if (objetivo) {
        void reordenarImagenes(claseId, objetivo).catch(() => {});
      }
    };
  }, [claseId]);

  return { ids, mover, guardarPendiente, estado, anuncio };
}
