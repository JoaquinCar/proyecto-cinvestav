import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Acceso",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center bg-background dot-grid px-4">
      {/* Ambient glow — neutral, token-based tints */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-10 bg-[radial-gradient(circle,var(--color-secondary),transparent_70%)]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.08] bg-[radial-gradient(circle,var(--color-success),transparent_70%)]" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 bg-muted border border-border">
            {/* Atom icon */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden className="text-primary">
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="currentColor" strokeWidth="1.5" fill="none"
                transform="rotate(60 16 16)" />
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="currentColor" strokeWidth="1.5" fill="none"
                transform="rotate(120 16 16)" />
              <circle cx="16" cy="16" r="2.5" fill="currentColor" />
            </svg>
          </div>

          <h1 className="font-display text-4xl font-light mb-1 text-foreground">
            Pasaporte{" "}
            <em className="text-primary not-italic font-semibold">
              Científico
            </em>
          </h1>
          <p className="text-sm mt-2 text-muted-foreground">
            CINVESTAV Unidad Mérida
          </p>
        </div>

        {/* Divider rule */}
        <div className="h-px bg-border mb-8" />

        {/* Login card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm mb-6 bg-destructive/10 border border-destructive/40 text-destructive">
              Credenciales incorrectas. Verifica tu correo y contraseña.
            </div>
          )}
          <LoginForm />
        </div>

        <p className="text-center text-xs mt-6 text-muted-foreground">
          Acceso restringido al personal autorizado
        </p>
        <p className="text-center text-xs mt-2">
          <Link href="/privacidad" className="text-muted-foreground underline hover:text-foreground transition-colors">
            Aviso de privacidad
          </Link>
        </p>
      </div>
    </main>
  );
}
