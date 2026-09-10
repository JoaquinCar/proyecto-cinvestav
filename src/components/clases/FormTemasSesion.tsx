"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const LARGO_MAXIMO_TEMAS = 500;
const LARGO_MAXIMO_NOTAS = 1000;

interface FormTemasSesionProps {
  sesionId: string;
  /** Fecha ya formateada, se muestra en el encabezado del modal. */
  fechaSesion: string;
  /** Fecha de la sesión como "AAAA-MM-DD", para poder corregirla. */
  fechaISO: string;
  temas: string | null;
  notas: string | null;
}

/**
 * Edita fecha, temas y notas de una sesión desde la página de la clase.
 * Antes esto enlazaba a `/sesiones/[id]/temas`, una ruta que nunca existió.
 */
export function FormTemasSesion({
  sesionId,
  fechaSesion,
  fechaISO,
  temas,
  notas,
}: FormTemasSesionProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [valorFecha, setValorFecha] = useState(fechaISO);
  const [valorTemas, setValorTemas] = useState(temas ?? "");
  const [valorNotas, setValorNotas] = useState(notas ?? "");

  function abrir(nuevoEstado: boolean) {
    if (nuevoEstado) {
      setValorFecha(fechaISO);
      setValorTemas(temas ?? "");
      setValorNotas(notas ?? "");
    }
    setAbierto(nuevoEstado);
  }

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch(`/api/sesiones/${sesionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // La fecha solo viaja si cambió: el servidor valida que siga dentro
          // del rango de la edición.
          ...(valorFecha && valorFecha !== fechaISO && { fecha: valorFecha }),
          temas: valorTemas.trim() || null,
          notas: valorNotas.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Error al guardar la sesión");
      }

      toast.success("Sesión actualizada");
      setAbierto(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar la sesión",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground"
            aria-label={`Editar la sesión del ${fechaSesion}`}
          >
            <Pencil size={11} strokeWidth={2} aria-hidden />
            Editar
          </button>
        }
      />

      <DialogContent className="sm:max-w-[30rem] bg-card border border-border text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-secondary/10">
              <FileText
                size={17}
                strokeWidth={1.8}
                className="text-secondary-foreground"
                aria-hidden
              />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-foreground">
                Editar sesión
              </DialogTitle>
              <p className="text-xs mt-0.5 text-muted-foreground">{fechaSesion}</p>
            </div>
          </div>
          <div className="h-px bg-border mt-3" />
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="sesion-fecha-editar" className="text-sm font-medium text-foreground">
              Fecha de la sesión
            </Label>
            <Input
              id="sesion-fecha-editar"
              type="date"
              value={valorFecha}
              onChange={(e) => setValorFecha(e.target.value)}
              className="h-11 transition-colors bg-surface-alt border-border focus:border-primary focus:ring-primary"
              aria-describedby="sesion-fecha-editar-hint"
            />
            <p id="sesion-fecha-editar-hint" className="text-xs text-muted-foreground">
              Corrige aquí un dedazo en la fecha; debe caer dentro de la edición.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sesion-temas-editar" className="text-sm font-medium text-foreground">
              Temas tratados
            </Label>
            <Textarea
              id="sesion-temas-editar"
              value={valorTemas}
              onChange={(e) => setValorTemas(e.target.value)}
              maxLength={LARGO_MAXIMO_TEMAS}
              rows={3}
              placeholder="Ej: Introducción al sistema solar, planetas rocosos…"
              className="resize-none transition-colors bg-surface-alt border-border focus:border-primary focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground text-right tabular">
              {valorTemas.length} / {LARGO_MAXIMO_TEMAS}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sesion-notas-editar" className="text-sm font-medium text-foreground">
              Notas internas
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="sesion-notas-editar"
              value={valorNotas}
              onChange={(e) => setValorNotas(e.target.value)}
              maxLength={LARGO_MAXIMO_NOTAS}
              rows={2}
              placeholder="Observaciones, incidencias, material utilizado…"
              className="resize-none transition-colors bg-surface-alt border-border focus:border-primary focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all disabled:opacity-50 min-h-[44px]"
            aria-busy={guardando}
          >
            {guardando ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
