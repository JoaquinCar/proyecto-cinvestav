"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, UserRound, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CampoAcompanante,
  ACOMPANANTE_VACIO,
  aEleccionAcompanante,
  acompananteIncompleto,
  type EstadoAcompanante,
} from "@/components/acompanantes/CampoAcompanante";
import { nombreCompletoAcompanante } from "@/components/acompanantes/BusquedaAcompanante";
import {
  asignarAcompanante,
  quitarAcompanante,
  type Acompanante,
} from "@/lib/api/acompanantes";
import { mensajeDeError } from "@/lib/api/errores";
import { PARENTESCO_LABEL } from "@/lib/schemas/acompanante.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Con quién vino el niño en UNA edición, dentro de su ficha.
//
// Se puede cambiar y se puede quitar: en campo pasa a menudo que el primer día
// lo trae la mamá y el resto la abuela, y que alguien se equivoque al capturar.
// Quitar solo desliga — la ficha del acompañante sigue existiendo porque casi
// siempre acompaña a alguien más.
// ─────────────────────────────────────────────────────────────────────────────

interface GestorAcompananteProps {
  inscripcionId: string;
  acompanante: Acompanante | null;
  /** ADMIN y BECARIO capturan; READONLY solo ve. */
  puedeEditar: boolean;
  edicionNombre: string;
}

export function GestorAcompanante({
  inscripcionId,
  acompanante,
  puedeEditar,
  edicionNombre,
}: GestorAcompananteProps) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [estado, setEstado] = useState<EstadoAcompanante>(ACOMPANANTE_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function guardar() {
    if (acompananteIncompleto(estado)) {
      setError(
        "Escribe al menos el nombre del acompañante, o cancela si el niño viene solo.",
      );
      return;
    }

    const eleccion = aEleccionAcompanante(estado);
    if (!eleccion) {
      setError("Busca a un acompañante o captura uno nuevo antes de guardar.");
      return;
    }

    setCargando(true);
    try {
      const guardado = await asignarAcompanante(inscripcionId, eleccion);
      toast.success(
        `${nombreCompletoAcompanante(guardado)} queda como acompañante en ${edicionNombre}`,
      );
      setEditando(false);
      setEstado(ACOMPANANTE_VACIO);
      setError(null);
      router.refresh();
    } catch (err) {
      const mensaje = mensajeDeError(
        err,
        "No se pudo guardar el acompañante; la inscripción sigue como estaba.",
      );
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  async function quitar() {
    setCargando(true);
    try {
      await quitarAcompanante(inscripcionId);
      toast.success(`Se quitó el acompañante en ${edicionNombre}`);
      router.refresh();
    } catch (err) {
      const mensaje = mensajeDeError(
        err,
        "No se pudo quitar el acompañante; la inscripción sigue como estaba.",
      );
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  const claseEnlace =
    "text-xs underline underline-offset-2 transition-opacity hover:opacity-70 text-muted-foreground disabled:opacity-50";

  // ── Formulario abierto ─────────────────────────────────────────────────────
  if (editando) {
    return (
      <div className="space-y-3">
        <CampoAcompanante
          valor={estado}
          onChange={(v) => {
            setEstado(v);
            setError(null);
          }}
          error={error}
          disabled={cargando}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={guardar}
            disabled={cargando}
            className="btn-primary h-11 sm:h-9 rounded-xl text-sm font-semibold px-4"
          >
            {cargando ? "Guardando…" : "Guardar acompañante"}
          </Button>
          <button
            type="button"
            disabled={cargando}
            onClick={() => {
              setEditando(false);
              setEstado(ACOMPANANTE_VACIO);
              setError(null);
            }}
            className="px-4 rounded-xl text-sm font-medium min-h-[44px] sm:min-h-0 sm:h-9 transition-colors bg-muted border border-border text-foreground hover:bg-secondary/10 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── Sin acompañante registrado ─────────────────────────────────────────────
  if (!acompanante) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs text-muted-foreground">
          Sin acompañante registrado
        </span>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => {
              setEstado({
                modo: "nuevo",
                datos: {
                  nombre: "", apellidos: "", telefono: "", correo: "",
                  parentesco: "MADRE",
                },
              });
              setEditando(true);
            }}
            className={claseEnlace}
          >
            Agregar acompañante
          </button>
        )}
      </div>
    );
  }

  // ── Con acompañante ────────────────────────────────────────────────────────
  const acompanados = acompanante._count?.inscripciones ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-secondary/15">
          {acompanante.parentesco === "GRUPO" ||
          acompanante.parentesco === "INSTITUCION" ? (
            <Users size={14} className="text-secondary-foreground" />
          ) : (
            <UserRound size={14} className="text-secondary-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={`/acompanantes/${acompanante.id}`}
            className="text-sm font-medium truncate text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground"
          >
            {nombreCompletoAcompanante(acompanante)}
          </Link>
          <p className="text-xs mt-0.5 text-muted-foreground">
            {PARENTESCO_LABEL[acompanante.parentesco]}
            {acompanante.telefono ? ` · ${acompanante.telefono}` : ""}
            {acompanados > 1 ? (
              <>
                {" · acompaña a "}
                <span className="tabular">{acompanados}</span> niños
              </>
            ) : null}
          </p>

          {puedeEditar && (
            <div className="flex flex-wrap gap-3 mt-1.5">
              <button
                type="button"
                disabled={cargando}
                onClick={() => {
                  setEstado({
                    modo: "nuevo",
                    datos: {
                      nombre: "", apellidos: "", telefono: "", correo: "",
                      parentesco: "MADRE",
                    },
                  });
                  setEditando(true);
                }}
                className={claseEnlace}
              >
                Cambiar
              </button>
              <button
                type="button"
                disabled={cargando}
                onClick={quitar}
                className={claseEnlace}
              >
                Quitar
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed text-destructive bg-destructive/10 border border-destructive/40"
          role="alert"
        >
          <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
