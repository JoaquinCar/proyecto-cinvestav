"use client";

import { UserCheck, UserPlus, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BusquedaAcompanante,
  nombreCompletoAcompanante,
} from "@/components/acompanantes/BusquedaAcompanante";
import type { Acompanante, EleccionAcompanante } from "@/lib/api/acompanantes";
import {
  PARENTESCOS,
  PARENTESCO_LABEL,
  type Parentesco,
} from "@/lib/schemas/acompanante.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Campo de acompañante — OPCIONAL.
//
// Arranca cerrado: quien registra a un niño que viene solo no ve nada más que
// un enlace. Al abrirlo, lo primero es el buscador, no el formulario en blanco:
// el caso que más se repite es el segundo hermano, y ahí lo correcto es
// reutilizar la ficha que se acaba de crear, no volver a teclearla.
// ─────────────────────────────────────────────────────────────────────────────

export type DatosAcompananteNuevo = {
  nombre:     string;
  apellidos:  string;
  telefono:   string;
  correo:     string;
  parentesco: Parentesco;
};

export type EstadoAcompanante =
  | { modo: "ninguno" }
  | { modo: "existente"; acompanante: Acompanante }
  | { modo: "nuevo"; datos: DatosAcompananteNuevo };

export const ACOMPANANTE_VACIO: EstadoAcompanante = { modo: "ninguno" };

const DATOS_EN_BLANCO: DatosAcompananteNuevo = {
  nombre:     "",
  apellidos:  "",
  telefono:   "",
  correo:     "",
  parentesco: "MADRE",
};

/**
 * Traduce el estado del campo a lo que entiende el API. Devuelve `undefined`
 * cuando no hay acompañante que registrar — que es lo normal.
 */
export function aEleccionAcompanante(
  estado: EstadoAcompanante,
): EleccionAcompanante | undefined {
  if (estado.modo === "existente") {
    return { acompananteId: estado.acompanante.id };
  }
  if (estado.modo === "nuevo" && estado.datos.nombre.trim().length > 0) {
    return {
      acompanante: {
        nombre:     estado.datos.nombre.trim(),
        apellidos:  estado.datos.apellidos.trim() || undefined,
        telefono:   estado.datos.telefono.trim() || undefined,
        correo:     estado.datos.correo.trim() || undefined,
        parentesco: estado.datos.parentesco,
      },
    };
  }
  return undefined;
}

/**
 * Un acompañante a medio capturar (con teléfono pero sin nombre) se perdería en
 * silencio al guardar. Esto lo detecta para poder avisar antes.
 */
export function acompananteIncompleto(estado: EstadoAcompanante): boolean {
  if (estado.modo !== "nuevo") return false;
  const { nombre, apellidos, telefono, correo } = estado.datos;
  const hayAlgo = [apellidos, telefono, correo].some((v) => v.trim().length > 0);
  return nombre.trim().length === 0 && hayAlgo;
}

interface CampoAcompananteProps {
  valor: EstadoAcompanante;
  onChange: (estado: EstadoAcompanante) => void;
  /** Aviso a mostrar bajo el campo (por ejemplo, falta el nombre). */
  error?: string | null;
  disabled?: boolean;
}

export function CampoAcompanante({
  valor,
  onChange,
  error,
  disabled = false,
}: CampoAcompananteProps) {
  const claseCampo = [
    "h-11 rounded-xl bg-muted border border-border transition-colors",
    "focus-visible:ring-primary",
  ].join(" ");

  // ── Cerrado ────────────────────────────────────────────────────────────────
  if (valor.modo === "ninguno") {
    return (
      <div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ modo: "nuevo", datos: { ...DATOS_EN_BLANCO } })}
          className="inline-flex items-center gap-2 px-3 rounded-xl text-sm font-medium min-h-[44px] sm:min-h-0 sm:py-2 transition-colors bg-muted border border-border text-foreground hover:bg-secondary/10 disabled:opacity-50"
        >
          <UserPlus size={15} />
          Agregar acompañante
          <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </button>
        <p className="text-xs mt-1.5 text-muted-foreground">
          Si viene con su mamá, su abuela o con un grupo. Si ya registraste a un
          hermano, búscalo y reutiliza el mismo.
        </p>
      </div>
    );
  }

  // ── Uno existente, ya elegido ──────────────────────────────────────────────
  if (valor.modo === "existente") {
    const { acompanante } = valor;
    const acompanados = acompanante._count?.inscripciones ?? 0;
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Acompañante</Label>
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-secondary/10 border border-secondary/30">
          <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-secondary/15">
            <UserCheck size={16} className="text-secondary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              {nombreCompletoAcompanante(acompanante)}
            </p>
            <p className="text-xs mt-0.5 truncate text-muted-foreground">
              {PARENTESCO_LABEL[acompanante.parentesco]}
              {acompanante.telefono ? ` · ${acompanante.telefono}` : ""}
              {acompanados > 0
                ? ` · acompaña a ${acompanados} ${acompanados === 1 ? "niño" : "niños"}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ modo: "nuevo", datos: { ...DATOS_EN_BLANCO } })}
            className="text-xs underline underline-offset-2 shrink-0 mt-0.5 transition-opacity hover:opacity-70 text-muted-foreground disabled:opacity-50"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  // ── Buscar o capturar uno nuevo ────────────────────────────────────────────
  const { datos } = valor;
  const actualizar = (parcial: Partial<DatosAcompananteNuevo>) =>
    onChange({ modo: "nuevo", datos: { ...datos, ...parcial } });

  return (
    <div className="space-y-3 rounded-2xl p-4 bg-muted/40 border border-border">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium text-foreground">
          Acompañante{" "}
          <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(ACOMPANANTE_VACIO)}
          className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-70 text-muted-foreground disabled:opacity-50"
        >
          <X size={13} />
          Quitar
        </button>
      </div>

      {/* Primero buscar: el hermano mayor ya lo capturó hace un minuto. */}
      <BusquedaAcompanante
        onSelect={(a) => onChange({ modo: "existente", acompanante: a })}
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          O captura uno nuevo
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="acomp-nombre" className="text-sm font-medium text-foreground">
            Nombre(s)
          </Label>
          <Input
            id="acomp-nombre"
            type="text"
            placeholder="Ej. Laura"
            value={datos.nombre}
            disabled={disabled}
            onChange={(e) => actualizar({ nombre: e.target.value })}
            className={claseCampo}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="acomp-apellidos" className="text-sm font-medium text-foreground">
            Apellidos
          </Label>
          <Input
            id="acomp-apellidos"
            type="text"
            placeholder="Ej. Pérez Gómez"
            value={datos.apellidos}
            disabled={disabled}
            onChange={(e) => actualizar({ apellidos: e.target.value })}
            className={claseCampo}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="acomp-telefono" className="text-sm font-medium text-foreground">
            Teléfono
          </Label>
          <Input
            id="acomp-telefono"
            type="tel"
            inputMode="tel"
            placeholder="999 123 4567"
            value={datos.telefono}
            disabled={disabled}
            onChange={(e) => actualizar({ telefono: e.target.value })}
            className={claseCampo}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Parentesco</Label>
          <Select
            value={datos.parentesco}
            disabled={disabled}
            onValueChange={(v) => actualizar({ parentesco: v as Parentesco })}
          >
            <SelectTrigger
              className="h-11 w-full rounded-xl bg-muted border border-border focus:ring-primary"
              aria-label="Seleccionar parentesco"
            >
              {/* Sin esta función el disparador muestra el valor crudo
                  («MADRE»), no la etiqueta que lee quien captura. */}
              <SelectValue placeholder="—">
                {(valor: unknown) =>
                  PARENTESCO_LABEL[valor as Parentesco] ?? "—"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PARENTESCOS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PARENTESCO_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acomp-correo" className="text-sm font-medium text-foreground">
          Correo
        </Label>
        <Input
          id="acomp-correo"
          type="email"
          inputMode="email"
          placeholder="correo@ejemplo.com"
          value={datos.correo}
          disabled={disabled}
          onChange={(e) => actualizar({ correo: e.target.value })}
          className={claseCampo}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
