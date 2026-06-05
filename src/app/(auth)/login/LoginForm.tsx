"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ── Schema ─────────────────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type CredentialsData = z.infer<typeof credentialsSchema>;

// ── Login Form ──────────────────────────────────────────────────────────────────

export default function LoginForm() {
  const router = useRouter();
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
        router.push("/");
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
          className="text-sm font-medium text-muted-foreground"
        >
          Correo electrónico
        </Label>
        <Input
          id="cred-email"
          type="email"
          autoComplete="email"
          placeholder="usuario@cinvestav.mx"
          {...register("email")}
          className={`h-11 rounded-lg bg-surface-alt border-border transition-colors focus:ring-primary ${
            errors.email ? "border-destructive focus:ring-destructive" : ""
          }`}
        />
        {errors.email && (
          <p className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label
          htmlFor="cred-password"
          className="text-sm font-medium text-muted-foreground"
        >
          Contraseña
        </Label>
        <Input
          id="cred-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
          className={`h-11 rounded-lg bg-surface-alt border-border transition-colors focus:ring-primary ${
            errors.password ? "border-destructive focus:ring-destructive" : ""
          }`}
        />
        {errors.password && (
          <p className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm bg-destructive/10 border border-destructive/40 text-destructive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-xl font-semibold text-sm btn-primary mt-2"
      >
        {loading ? "Verificando…" : "Entrar al sistema"}
      </Button>
    </form>
  );
}
