"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Defer to next tick so it doesn't run synchronously within the effect
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {mounted ? (
        isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />
      ) : (
        <span className="w-[18px] h-[18px]" />
      )}
    </button>
  );
}
