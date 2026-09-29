import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { busquedaStaffSchema, staffSchema } from "@/lib/schemas/staff.schema";
import { buscarStaff, crearStaff } from "@/server/queries/staff";
import {
  fallaInesperada,
  leerCuerpoJson,
  mensajeCamposInvalidos,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

// ─────────────────────────────────────────────────────────────────────────────
// Staff: quien imparte u organiza una sesión.
//
// ADMIN y BECARIO capturan; READONLY solo consulta y para eso está
// GET /api/staff/[id], que devuelve la ficha sin el contacto. El buscador NO
// se le abre a READONLY porque su respuesta trae teléfonos y correos, igual
// que el de acompañantes.
// ─────────────────────────────────────────────────────────────────────────────

/** Sesión con permiso de captura, o la respuesta que lo niega. */
async function exigirCaptura(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { role } = session.user;
  if (role !== "ADMIN" && role !== "BECARIO") {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }
  return null;
}

// ── GET /api/staff?q=texto ────────────────────────────────────────────────────
// Buscador para REUTILIZAR a alguien ya capturado. Es lo que evita que el mismo
// becario acabe con veinte fichas, una por sesión.

export async function GET(request: NextRequest) {
  const negado = await exigirCaptura();
  if (negado) return negado;

  const { searchParams } = new URL(request.url);
  const parsed = busquedaStaffSchema.safeParse({
    q: searchParams.get("q") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: mensajeCamposInvalidos(parsed.error), detalles: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const staff = await buscarStaff(parsed.data.q);
    return NextResponse.json({ staff });
  } catch (err) {
    return fallaInesperada(
      "GET /api/staff",
      err,
      "No se pudo buscar entre el staff. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
  }
}

// ── POST /api/staff ───────────────────────────────────────────────────────────
// Alta suelta, sin asignar todavía: el coordinador arma la plantilla del año
// antes de que existan las sesiones. Para dar de alta Y asignar en un paso está
// PUT /api/clases/[id]/staff.

export async function POST(request: NextRequest) {
  const negado = await exigirCaptura();
  if (negado) return negado;

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) return cuerpo.respuesta;

  const parsed = staffSchema.safeParse(cuerpo.datos);
  if (!parsed.success) {
    return respuestaCamposInvalidos(parsed.error);
  }

  try {
    const staff = await crearStaff(parsed.data);
    return NextResponse.json({ staff }, { status: 201 });
  } catch (err) {
    return fallaInesperada(
      "POST /api/staff",
      err,
      "No se pudo guardar a esta persona y no quedó registrada. Vuelve a intentarlo en unos minutos.",
    );
  }
}
