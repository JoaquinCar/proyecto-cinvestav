"use client";

import { useState, useEffect } from "react";
import { X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormRegistro } from "@/components/participantes/FormRegistro";

// ── Hook: detectar si estamos en móvil ───────────────────────────────────────

function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

// ── Drawer nativo para móvil ──────────────────────────────────────────────────

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        style={{ animation: "fade-in 150ms ease both" }}
      />

      {/* Panel deslizante desde abajo */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar participante"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl max-h-[92dvh]"
        style={{
          background: "oklch(0.16 0.030 248)",
          border: "1px solid oklch(0.28 0.055 248)",
          borderBottom: "none",
          animation: "slide-up 250ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Handle + header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 pt-3 pb-4"
          style={{ borderBottom: "1px solid oklch(0.22 0.038 248)" }}
        >
          {/* Handle bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full"
            style={{ background: "oklch(0.35 0.04 248)" }} />

          <h2
            className="font-display text-xl font-medium mt-2"
            style={{ color: "oklch(0.96 0.01 80)" }}
          >
            Registrar participante
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-full w-8 h-8 flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: "oklch(0.62 0.06 235)" }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DrawerRegistroProps {
  edicionId: string;
  /** Si se provee, el componente actúa como "controlled" */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trigger personalizado. Si no se provee, se renderiza el FAB por defecto */
  trigger?: React.ReactNode;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DrawerRegistro({
  edicionId,
  open: openProp,
  onOpenChange,
  trigger,
}: DrawerRegistroProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isMobile = useIsMobile();

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  function setOpen(val: boolean) {
    if (!isControlled) setInternalOpen(val);
    onOpenChange?.(val);
  }

  function handleSuccess() {
    setOpen(false);
  }

  // ── Trigger por defecto: FAB en móvil / botón en desktop ─────────────────

  const defaultTrigger = (
    <Button
      type="button"
      onClick={() => setOpen(true)}
      className="btn-gold fixed bottom-6 right-5 z-30 sm:static sm:bottom-auto sm:right-auto rounded-full sm:rounded-lg h-14 w-14 sm:h-9 sm:w-auto sm:px-4 shadow-lg sm:shadow-none flex items-center justify-center gap-2"
      style={{
        color: "oklch(0.13 0.028 248)",
        border: "none",
        boxShadow: "0 4px 24px oklch(0.72 0.165 72 / 0.35)",
      }}
      aria-label="Registrar participante"
    >
      <UserPlus size={20} className="sm:size-4" strokeWidth={2} />
      <span className="hidden sm:inline text-sm font-semibold">Registrar participante</span>
    </Button>
  );

  const triggerElement = trigger ?? defaultTrigger;

  return (
    <>
      {/* Trigger solo si no hay open controlado externamente */}
      {!isControlled && triggerElement}

      {/* Móvil: Bottom Sheet */}
      {isMobile && (
        <BottomSheet open={open} onClose={() => setOpen(false)}>
          <FormRegistro edicionId={edicionId} onSuccess={handleSuccess} />
          {/* Espacio extra para que el botón submit no quede tapado por el safe-area */}
          <div className="h-6" />
        </BottomSheet>
      )}

      {/* Desktop: Dialog centrado */}
      {!isMobile && (
        <Dialog open={open} onOpenChange={setOpen}>
          {/* Aquí NO ponemos trigger dentro de Dialog cuando es controlado */}
          <DialogContent
            className="sm:max-w-lg"
            style={{
              background: "oklch(0.16 0.030 248)",
              border: "1px solid oklch(0.28 0.055 248)",
            }}
          >
            <DialogHeader>
              <DialogTitle
                className="font-display text-xl font-medium"
                style={{ color: "oklch(0.96 0.01 80)" }}
              >
                Registrar participante
              </DialogTitle>
            </DialogHeader>
            <div className="pt-1">
              <FormRegistro edicionId={edicionId} onSuccess={handleSuccess} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ── Botón FAB standalone (para uso en Server Components que quieran solo el FAB) ──

export function FABRegistro({
  edicionId,
}: {
  edicionId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gold fixed bottom-6 right-5 z-30 rounded-full h-14 w-14 flex items-center justify-center shadow-lg sm:hidden"
        style={{
          color: "oklch(0.13 0.028 248)",
          border: "none",
          boxShadow: "0 4px 24px oklch(0.72 0.165 72 / 0.35)",
        }}
        aria-label="Registrar participante"
      >
        <UserPlus size={22} strokeWidth={2} />
      </Button>

      <DrawerRegistro
        edicionId={edicionId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
