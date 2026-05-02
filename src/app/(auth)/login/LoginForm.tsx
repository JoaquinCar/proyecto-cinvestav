"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Schemas ──────────────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const magicLinkSchema = z.object({
  email: z.string().email("Correo inválido"),
});

type CredentialsData = z.infer<typeof credentialsSchema>;
type MagicLinkData = z.infer<typeof magicLinkSchema>;

// ── Shared input style helpers ────────────────────────────────────────────────

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    background: "oklch(0.14 0.028 248)",
    borderColor: hasError ? "oklch(0.60 0.21 25)" : "oklch(0.28 0.055 248)",
    color: "oklch(0.96 0.01 80)",
  };
}

const errorBannerStyle: React.CSSProperties = {
  background: "oklch(0.60 0.21 25 / 0.12)",
  border: "1px solid oklch(0.60 0.21 25 / 0.4)",
  color: "oklch(0.75 0.15 25)",
};

const btnGoldTextStyle: React.CSSProperties = {
  color: "oklch(0.13 0.028 248)",
  border: "none",
};

// ── Subform: Contraseña ───────────────────────────────────────────────────────

function PasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialsData>({ resolver: zodResolver(credentialsSchema) });

  async function onSubmit(data: CredentialsData) {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.ok) {
        window.location.href = "/";
      } else {
        setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      }
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Email */}
      <div className="space-y-2">
        <Label
          htmlFor="cred-email"
          className="text-sm font-medium"
          style={{ color: "oklch(0.75 0.06 235)" }}
        >
          Correo electrónico
        </Label>
        <Input
          id="cred-email"
          type="email"
          autoComplete="email"
          placeholder="usuario@cinvestav.mx"
          {...register("email")}
          style={inputStyle(!!errors.email)}
          className="h-11 transition-colors focus:border-primary"
        />
        {errors.email && (
          <p className="text-xs" style={{ color: "oklch(0.60 0.21 25)" }}>
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label
          htmlFor="cred-password"
          className="text-sm font-medium"
          style={{ color: "oklch(0.75 0.06 235)" }}
        >
          Contraseña
        </Label>
        <Input
          id="cred-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
          style={inputStyle(!!errors.password)}
          className="h-11 transition-colors focus:border-primary"
        />
        {errors.password && (
          <p className="text-xs" style={{ color: "oklch(0.60 0.21 25)" }}>
            {errors.password.message}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={errorBannerStyle}>
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 font-semibold text-sm btn-gold mt-2"
        style={btnGoldTextStyle}
      >
        {loading ? "Verificando…" : "Entrar al sistema"}
      </Button>
    </form>
  );
}

// ── Subform: Link Mágico ──────────────────────────────────────────────────────

function MagicLinkForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkData>({ resolver: zodResolver(magicLinkSchema) });

  async function onSubmit(data: MagicLinkData) {
    setLoading(true);
    setError(null);
    setSentTo(null);
    try {
      const result = await signIn("resend", {
        email: data.email,
        redirect: false,
      });
      if (result?.ok || result?.error == null) {
        setSentTo(data.email);
      } else {
        setError(
          "No pudimos enviar el enlace. Verifica el correo e intenta de nuevo."
        );
      }
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (sentTo) {
    return (
      <div
        className="rounded-xl px-5 py-6 flex flex-col items-center gap-3 text-center"
        style={{
          background: "oklch(0.52 0.17 152 / 0.10)",
          border: "1px solid oklch(0.52 0.17 152 / 0.35)",
        }}
      >
        {/* Emerald check circle */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: "oklch(0.52 0.17 152 / 0.18)" }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="oklch(0.52 0.17 152)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <p
          className="text-sm font-medium"
          style={{ color: "oklch(0.80 0.10 152)" }}
        >
          Revisa tu correo — enviamos un link a
        </p>
        <p
          className="text-sm font-semibold break-all"
          style={{ color: "oklch(0.52 0.17 152)" }}
        >
          {sentTo}
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: "oklch(0.62 0.06 235)" }}
        >
          El enlace expira en 10 minutos. Revisa también tu carpeta de spam.
        </p>
      </div>
    );
  }

  // ── Input state ────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label
          htmlFor="magic-email"
          className="text-sm font-medium"
          style={{ color: "oklch(0.75 0.06 235)" }}
        >
          Correo electrónico
        </Label>
        <Input
          id="magic-email"
          type="email"
          autoComplete="email"
          placeholder="usuario@cinvestav.mx"
          {...register("email")}
          style={inputStyle(!!errors.email)}
          className="h-11 transition-colors focus:border-primary"
        />
        {errors.email && (
          <p className="text-xs" style={{ color: "oklch(0.60 0.21 25)" }}>
            {errors.email.message}
          </p>
        )}
      </div>

      <p
        className="text-xs leading-relaxed"
        style={{ color: "oklch(0.62 0.06 235)" }}
      >
        Te enviaremos un enlace de acceso directo a tu correo, sin necesidad de
        recordar una contraseña.
      </p>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={errorBannerStyle}>
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 font-semibold text-sm btn-gold mt-2"
        style={btnGoldTextStyle}
      >
        {loading ? "Enviando enlace…" : "Enviar link mágico"}
      </Button>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LoginForm() {
  return (
    <>
      {/*
        Scoped styles for the Meridian Science tab bar.
        Base-UI marks the active trigger with `data-active` (no value),
        so we target [data-slot="tabs-trigger"][data-active].
      */}
      <style>{`
        [data-slot="tabs-trigger"] {
          color: oklch(0.62 0.06 235);
          background: transparent;
        }
        [data-slot="tabs-trigger"][data-active] {
          background: oklch(0.22 0.04 248) !important;
          color: oklch(0.72 0.165 72) !important;
          box-shadow: none !important;
        }
        [data-slot="tabs-trigger"]:hover:not([data-active]) {
          color: oklch(0.80 0.06 235);
        }
      `}</style>

      <Tabs defaultValue="password" className="w-full">
        {/* Tab bar */}
        <TabsList
          className="w-full mb-6 p-1 rounded-lg h-auto"
          style={{
            background: "oklch(0.16 0.030 248)",
            border: "1px solid oklch(0.28 0.055 248)",
          }}
        >
          <TabsTrigger
            value="password"
            className="flex-1 py-2 text-sm font-medium rounded-md transition-all duration-150"
          >
            Contraseña
          </TabsTrigger>
          <TabsTrigger
            value="magic"
            className="flex-1 py-2 text-sm font-medium rounded-md transition-all duration-150"
          >
            Link mágico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="mt-0">
          <PasswordForm />
        </TabsContent>

        <TabsContent value="magic" className="mt-0">
          <MagicLinkForm />
        </TabsContent>
      </Tabs>
    </>
  );
}
