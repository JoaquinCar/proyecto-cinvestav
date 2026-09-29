"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Mail, Phone, UserPlus, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BusquedaStaff, nombreCompletoStaff } from "@/components/staff/BusquedaStaff";
import { asignarStaff, quitarStaff, type Staff } from "@/lib/api/staff";
import { mensajeDeError } from "@/lib/api/errores";
import {
  ROLES_STAFF,
  ROL_STAFF_LABEL,
  type RolStaff,
} from "@/lib/schemas/staff.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Quién imparte u organiza ESTA sesión.
//
// El formulario arranca por el BUSCADOR y no por los campos en blanco, igual
// que CampoAcompanante y por la misma razón: el caso que más se repite no es
// dar de alta a alguien nuevo, es volver a poner al mismo becario que estuvo en
// la sesión anterior. Teclearlo otra vez crearía una ficha duplicada y la lista
// de la sesión —la que se anexa— dejaría de cuadrar.
//
// Quitar solo desasigna: la ficha sigue existiendo porque casi siempre está en
// otras sesiones.
// ─────────────────────────────────────────────────────────────────────────────

type DatosNuevos = {
  nombre:      string;
  apellidos:   string;
  telefono:    string;
  correo:      string;
  institucion: string;
  rol:         RolStaff;
};

const EN_BLANCO: DatosNuevos = {
  nombre:      "",
  apellidos:   "",
  telefono:    "",
  correo:      "",
  institucion: "",
  rol:         "BECARIO",
};

interface GestorStaffSesionProps {
  claseId: string;
  sesionNombre: string;
  staff: Staff[];
  /** ADMIN y BECARIO asignan; READONLY solo ve. */
  puedeEditar: boolean;
  /** READONLY no ve teléfono ni correo: llegan en `null` desde el servidor. */
  puedeVerContacto: boolean;
}

export function GestorStaffSesion({
  claseId,
  sesionNombre,
  staff,
  puedeEditar,
  puedeVerContacto,
}: GestorStaffSesionProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<DatosNuevos>(EN_BLANCO);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const asignados = staff.map((s) => s.id);

  function cerrar() {
    setAbierto(false);
    setDatos(EN_BLANCO);
    setError(null);
  }

  async function asignar(eleccion: Parameters<typeof asignarStaff>[1]) {
    setCargando(true);
    try {
      const guardado = await asignarStaff(claseId, eleccion);
      toast.success(
        `${nombreCompletoStaff(guardado)} queda en ${sesionNombre}`,
      );
      cerrar();
      router.refresh();
    } catch (err) {
      const mensaje = mensajeDeError(
        err,
        "No se pudo asignar a esta persona; la sesión sigue como estaba.",
      );
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  async function guardarNueva() {
    if (datos.nombre.trim().length === 0) {
      setError("Escribe al menos el nombre de la persona, o busca a alguien ya registrado.");
      return;
    }
    await asignar({
      staff: {
        nombre:      datos.nombre.trim(),
        apellidos:   datos.apellidos.trim()   || undefined,
        telefono:    datos.telefono.trim()    || undefined,
        correo:      datos.correo.trim()      || undefined,
        institucion: datos.institucion.trim() || undefined,
        rol:         datos.rol,
      },
    });
  }

  async function quitar(persona: Staff) {
    setCargando(true);
    try {
      await quitarStaff(claseId, persona.id);
      toast.success(`Se quitó a ${nombreCompletoStaff(persona)} de ${sesionNombre}`);
      router.refresh();
    } catch (err) {
      const mensaje = mensajeDeError(
        err,
        "No se pudo quitar a esta persona; la sesión sigue como estaba.",
      );
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  const claseCampo = [
    "h-11 rounded-xl bg-muted border border-border transition-colors",
    "focus-visible:ring-primary",
  ].join(" ");

  const actualizar = (parcial: Partial<DatosNuevos>) =>
    setDatos((previos) => ({ ...previos, ...parcial }));

  return (
    <div className="space-y-3">
      {/* ── Quién está asignado ───────────────────────────────────────────── */}
      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay nadie asignado a esta sesión.
        </p>
      ) : (
        <ul className="rounded-2xl overflow-hidden bg-card border border-border">
          {staff.map((persona) => (
            <li
              key={persona.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0"
            >
              <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-secondary/15">
                <UserRound size={15} className="text-secondary-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground break-words">
                  {nombreCompletoStaff(persona)}
                </p>
                <p className="text-xs mt-0.5 text-muted-foreground break-words">
                  {ROL_STAFF_LABEL[persona.rol]}
                  {persona.institucion ? ` · ${persona.institucion}` : ""}
                </p>
                {puedeVerContacto && (persona.telefono || persona.correo) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {persona.telefono && (
                      <span className="flex items-center gap-1">
                        <Phone size={11} />
                        <span className="tabular">{persona.telefono}</span>
                      </span>
                    )}
                    {persona.correo && (
                      <span className="flex items-center gap-1 break-all">
                        <Mail size={11} />
                        {persona.correo}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {puedeEditar && (
                <button
                  type="button"
                  disabled={cargando}
                  onClick={() => quitar(persona)}
                  className="shrink-0 text-xs underline underline-offset-2 transition-opacity hover:opacity-70 text-muted-foreground disabled:opacity-50 min-h-[44px] sm:min-h-0 px-1"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Agregar ───────────────────────────────────────────────────────── */}
      {puedeEditar && !abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-2 px-3 rounded-xl text-sm font-medium min-h-[44px] sm:min-h-0 sm:py-2 transition-colors bg-muted border border-border text-foreground hover:bg-secondary/10"
        >
          <UserPlus size={15} />
          Agregar a alguien
        </button>
      )}

      {puedeEditar && abierto && (
        <div className="space-y-3 rounded-2xl p-4 bg-muted/40 border border-border">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm font-medium text-foreground">
              Agregar al staff de esta sesión
            </Label>
            <button
              type="button"
              disabled={cargando}
              onClick={cerrar}
              className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-70 text-muted-foreground disabled:opacity-50"
            >
              <X size={13} />
              Cancelar
            </button>
          </div>

          {/* Primero buscar: casi siempre ya está capturado. */}
          <BusquedaStaff
            yaAsignados={asignados}
            onSelect={(s) => asignar({ staffId: s.id })}
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              O captura a alguien nuevo
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="staff-nombre" className="text-sm font-medium text-foreground">
                Nombre(s)
              </Label>
              <Input
                id="staff-nombre"
                type="text"
                placeholder="Ej. Rocío"
                value={datos.nombre}
                disabled={cargando}
                onChange={(e) => actualizar({ nombre: e.target.value })}
                className={claseCampo}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-apellidos" className="text-sm font-medium text-foreground">
                Apellidos
              </Label>
              <Input
                id="staff-apellidos"
                type="text"
                placeholder="Ej. Canul Uc"
                value={datos.apellidos}
                disabled={cargando}
                onChange={(e) => actualizar({ apellidos: e.target.value })}
                className={claseCampo}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Qué hace en el programa
              </Label>
              <Select
                value={datos.rol}
                disabled={cargando}
                onValueChange={(v) => actualizar({ rol: v as RolStaff })}
              >
                <SelectTrigger
                  className="h-11 w-full rounded-xl bg-muted border border-border focus:ring-primary"
                  aria-label="Seleccionar rol en el programa"
                >
                  {/* Sin esta función el disparador muestra el valor crudo
                      («BECARIO»), no la etiqueta que lee quien captura. */}
                  <SelectValue placeholder="—">
                    {(valor: unknown) => ROL_STAFF_LABEL[valor as RolStaff] ?? "—"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLES_STAFF.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROL_STAFF_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-institucion" className="text-sm font-medium text-foreground">
                Institución
              </Label>
              <Input
                id="staff-institucion"
                type="text"
                placeholder="Ej. CINVESTAV Mérida"
                value={datos.institucion}
                disabled={cargando}
                onChange={(e) => actualizar({ institucion: e.target.value })}
                className={claseCampo}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="staff-telefono" className="text-sm font-medium text-foreground">
                Teléfono
              </Label>
              <Input
                id="staff-telefono"
                type="tel"
                inputMode="tel"
                placeholder="999 123 4567"
                value={datos.telefono}
                disabled={cargando}
                onChange={(e) => actualizar({ telefono: e.target.value })}
                className={claseCampo}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-correo" className="text-sm font-medium text-foreground">
                Correo
              </Label>
              <Input
                id="staff-correo"
                type="email"
                inputMode="email"
                placeholder="correo@ejemplo.com"
                value={datos.correo}
                disabled={cargando}
                onChange={(e) => actualizar({ correo: e.target.value })}
                className={claseCampo}
              />
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

          <Button
            type="button"
            onClick={guardarNueva}
            disabled={cargando}
            className="btn-primary h-11 sm:h-9 rounded-xl text-sm font-semibold px-4 w-full sm:w-auto"
          >
            {cargando ? "Guardando…" : "Agregar a la sesión"}
          </Button>
        </div>
      )}
    </div>
  );
}
