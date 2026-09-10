import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  obtenerImagenClase,
  descargarImagenDeStorage,
  tipoImagenSeguro,
  extensionImagen,
} from "@/server/queries/imagenes-clase";

type RouteContext = { params: Promise<{ id: string; imagenId: string }> };

/**
 * Cabecera de caché del archivo.
 *
 * `private`: en estas fotos aparecen menores. Solo puede guardarla el navegador
 * de quien la pidió; ninguna caché compartida (el CDN de Vercel, un proxy de la
 * escuela) debe quedarse una copia, porque la respuesta depende de la sesión y
 * no del URL. `Vary: Cookie` lo refuerza para cualquier intermediario que
 * ignore `private`. Jamás `public`.
 *
 * `max-age=3600`: el motivo del cambio es que la URL por fin es estable y el
 * navegador puede reutilizar la imagen; con menos de una hora, un becario que
 * recarga la clase entre sesión y sesión vuelve a descargarlo todo con datos
 * móviles. Una hora cubre una jornada de campo típica sin volver al servidor.
 * El precio es que, si a alguien se le quita el acceso, su navegador puede
 * seguir enseñando durante esa hora las imágenes que ya había descargado. Es
 * una exposición estrictamente menor que la del esquema anterior: la copia
 * cacheada vive solo en ese dispositivo, mientras que una URL firmada de 30
 * minutos funcionaba desde cualquier equipo con quien se compartiera. Todo lo
 * que no esté ya en esa caché —una imagen nueva, otra clase, otro dispositivo—
 * se corta en el instante en que se revoca la sesión.
 *
 * `immutable`: el contenido de un (claseId, imagenId) no cambia nunca. No hay
 * endpoint que reemplace el archivo de una imagen; editar significa borrar y
 * subir otra, con id nuevo. Así se evita también la revalidación condicional,
 * que era el otro viaje de red que queríamos ahorrar en campo.
 */
const CACHE_ARCHIVO = "private, max-age=3600, immutable";

/** Roles que pueden ver las imágenes de una clase. */
const ROLES_CON_LECTURA: readonly Role[] = ["ADMIN", "BECARIO", "READONLY"];

// ── GET /api/clases/[id]/imagenes/[imagenId]/archivo ──────────────────────────
//
// Proxy autenticado: sustituye a las URLs firmadas de Supabase Storage. Cada
// petición del archivo vuelve a comprobar la sesión, así que retirar el acceso
// surte efecto de inmediato en vez de dentro de treinta minutos.

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Ver las imágenes de una clase está permitido a los tres roles, igual que
    // en `GET /api/clases/[id]/imagenes`; subir y borrar sigue siendo
    // ADMIN/BECARIO. Se comprueba con una lista explícita en vez de dar por
    // buena cualquier sesión: si mañana se añade un rol nuevo, entra sin acceso
    // a las fotos hasta que alguien lo decida a propósito.
    if (!ROLES_CON_LECTURA.includes(session.user.role)) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id, imagenId } = await context.params;

    const imagen = await obtenerImagenClase(imagenId);

    // No se confía en que el id de la clase de la URL sea coherente: pedir
    // /api/clases/<clase-que-sí-puedo-ver>/imagenes/<imagen-de-otra>/archivo no
    // debe servir nada.
    if (!imagen || imagen.claseId !== id) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    // Respaldo data URI: esas filas viajan dentro del HTML/JSON y no tienen
    // archivo que servir. Que el proxy no las resuelva es lo correcto.
    if (!imagen.storagePath) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const archivo = await descargarImagenDeStorage(imagen.storagePath);
    if (!archivo) {
      // Storage no configurado, caído, o el objeto ya no está en el bucket. La
      // galería lo pinta como un hueco; el resto de la clase sigue funcionando.
      return NextResponse.json(
        { error: "No se pudo leer la imagen" },
        { status: 502 },
      );
    }

    const tipo = tipoImagenSeguro(imagen.mimeType);

    return new NextResponse(archivo.stream(), {
      status: 200,
      headers: {
        "Content-Type": tipo,
        "Content-Length": String(archivo.size),
        "Cache-Control": CACHE_ARCHIVO,
        Vary: "Cookie",
        // El nombre se construye con el id, nunca con el título que escribió el
        // usuario: así no hay forma de inyectar cabecera desde la base.
        "Content-Disposition": `inline; filename="imagen-${imagen.id}.${extensionImagen(imagen.mimeType)}"`,
        // Aunque `tipoImagenSeguro` ya acota el tipo, se impide además que el
        // navegador adivine otro distinto del declarado.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
