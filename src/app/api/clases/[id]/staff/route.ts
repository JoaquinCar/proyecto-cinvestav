import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asignarStaffSchema } from "@/lib/schemas/staff.schema";
import {
  asignarStaffAClase,
  listarStaffDeClase,
  SesionNoEncontradaError,
  StaffNoEncontradoError,
  type EleccionStaff,
} from "@/server/queries/staff";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

// ─────────────────────────────────────────────────────────────────────────────
// El staff de UNA sesión: quién la imparte u organiza.
//
// `[id]` es el id de una `Clase`, que en pantalla se llama «sesión». La ruta
// cuelga de /api/clases porque ese es el nombre interno que el resto del
// sistema ya usa (ver el comentario sobre `model Clase` en el schema).
//
// ADMIN y BECARIO asignan; READONLY consulta la lista pero sin el contacto.
// ─────────────────────────────────────────────────────────────────────────────

const SESION_NO_ENCONTRADA =
  "Esta sesión ya no existe: alguien pudo eliminarla desde otra pantalla. Vuelve a cargar la página para ver el estado actual.";

const STAFF_NO_ENCONTRADO =
  "La persona que elegiste ya no existe: puede que alguien haya eliminado su ficha mientras llenabas el formulario. Búscala de nuevo o captúrala como nueva.";

const ENLACE_INCOMPLETO =
  "El enlace de la sesión está incompleto. Vuelve a abrirlo desde la lista de sesiones.";

type Contexto = { params: Promise<{ id: string }> };

// ── GET /api/clases/[id]/staff ────────────────────────────────────────────────
// Quién está asignado. Los tres roles pueden verlo; el teléfono y el correo se
// omiten para READONLY, igual que en la ficha de un acompañante.

export async function GET(_request: NextRequest, { params }: Contexto) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: ENLACE_INCOMPLETO }, { status: 400 });
  }

  const puedeVerContacto =
    session.user.role === "ADMIN" || session.user.role === "BECARIO";

  try {
    const staff = await listarStaffDeClase(id);
    return NextResponse.json({
      staff: staff.map((persona) => ({
        ...persona,
        telefono: puedeVerContacto ? persona.telefono : null,
        correo:   puedeVerContacto ? persona.correo   : null,
      })),
    });
  } catch (err) {
    return fallaInesperada(
      "GET /api/clases/[id]/staff",
      err,
      "No se pudo cargar el staff de la sesión. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
  }
}

// ── PUT /api/clases/[id]/staff ────────────────────────────────────────────────
// Asigna a alguien a esta sesión. Dos caminos, uno por petición:
//   { staffId }      → reutiliza una ficha existente (el caso normal).
//   { staff: {…} }   → la crea y la asigna (la primera vez que aparece).
//
// Es idempotente: volver a asignar a quien ya estaba no falla ni duplica, lo
// impide `@@unique([staffId, claseId])` en la base.

export async function PUT(request: NextRequest, { params }: Contexto) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { role } = session.user;
  if (role !== "ADMIN" && role !== "BECARIO") {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: ENLACE_INCOMPLETO }, { status: 400 });
  }

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) return cuerpo.respuesta;

  const parsed = asignarStaffSchema.safeParse(cuerpo.datos);
  if (!parsed.success) {
    return respuestaCamposInvalidos(parsed.error);
  }

  try {
    const asignacion = await asignarStaffAClase(
      id,
      parsed.data as EleccionStaff,
    );
    return NextResponse.json({ asignacion }, { status: 201 });
  } catch (err) {
    if (err instanceof SesionNoEncontradaError) {
      return NextResponse.json({ error: SESION_NO_ENCONTRADA }, { status: 404 });
    }
    if (err instanceof StaffNoEncontradoError) {
      return NextResponse.json({ error: STAFF_NO_ENCONTRADO }, { status: 404 });
    }
    return fallaInesperada(
      "PUT /api/clases/[id]/staff",
      err,
      "No se pudo asignar a esta persona; la sesión sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}
