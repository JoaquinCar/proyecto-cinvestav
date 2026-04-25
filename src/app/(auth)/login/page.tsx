import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Acceso",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center dot-grid px-4">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.165 72), transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, oklch(0.52 0.17 152), transparent 70%)" }} />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{ background: "oklch(0.18 0.032 248)", border: "1px solid oklch(0.28 0.055 248)" }}>
            {/* Atom icon */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="oklch(0.72 0.165 72)" strokeWidth="1.5" fill="none" />
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="oklch(0.72 0.165 72)" strokeWidth="1.5" fill="none"
                transform="rotate(60 16 16)" />
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="oklch(0.72 0.165 72)" strokeWidth="1.5" fill="none"
                transform="rotate(120 16 16)" />
              <circle cx="16" cy="16" r="2.5" fill="oklch(0.72 0.165 72)" />
            </svg>
          </div>

          <h1 className="font-display text-4xl font-light mb-1"
            style={{ color: "oklch(0.96 0.01 80)" }}>
            Pasaporte{" "}
            <em style={{ color: "oklch(0.72 0.165 72)", fontStyle: "italic" }}>
              Científico
            </em>
          </h1>
          <p className="text-sm mt-2" style={{ color: "oklch(0.62 0.06 235)" }}>
            CINVESTAV Unidad Mérida
          </p>
        </div>

        {/* Gold rule */}
        <div className="gold-rule mb-8" />

        {/* Login card */}
        <div className="rounded-xl p-8"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
            boxShadow: "0 25px 50px oklch(0.08 0.02 248 / 0.8)",
          }}>
          <LoginForm />
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "oklch(0.45 0.04 248)" }}>
          Acceso restringido al personal autorizado
        </p>
      </div>
    </main>
  );
}
