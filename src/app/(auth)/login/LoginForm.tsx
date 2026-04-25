"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type LoginData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginData) {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire up next-auth signIn
      console.log("login", data);
    } catch {
      setError("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email"
          className="text-sm font-medium"
          style={{ color: "oklch(0.75 0.06 235)" }}>
          Correo electrónico
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="usuario@cinvestav.mx"
          {...register("email")}
          style={{
            background: "oklch(0.14 0.028 248)",
            borderColor: errors.email ? "oklch(0.60 0.21 25)" : "oklch(0.28 0.055 248)",
            color: "oklch(0.96 0.01 80)",
          }}
          className="h-11 transition-colors focus:border-primary"
        />
        {errors.email && (
          <p className="text-xs" style={{ color: "oklch(0.60 0.21 25)" }}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password"
          className="text-sm font-medium"
          style={{ color: "oklch(0.75 0.06 235)" }}>
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
          style={{
            background: "oklch(0.14 0.028 248)",
            borderColor: errors.password ? "oklch(0.60 0.21 25)" : "oklch(0.28 0.055 248)",
            color: "oklch(0.96 0.01 80)",
          }}
          className="h-11 transition-colors focus:border-primary"
        />
        {errors.password && (
          <p className="text-xs" style={{ color: "oklch(0.60 0.21 25)" }}>
            {errors.password.message}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "oklch(0.60 0.21 25 / 0.12)",
            border: "1px solid oklch(0.60 0.21 25 / 0.4)",
            color: "oklch(0.75 0.15 25)",
          }}>
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 font-semibold text-sm btn-gold mt-2"
        style={{
          color: "oklch(0.13 0.028 248)",
          border: "none",
        }}
      >
        {loading ? "Verificando…" : "Entrar al sistema"}
      </Button>
    </form>
  );
}
