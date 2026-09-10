import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/** Zona horaria del programa: las pruebas de fechas deben correr en Mérida. */
const ZONA_PRUEBAS = "America/Merida";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // La app se usa en Mérida (UTC-6). CI corre en UTC, donde el desfase de un día
    // en las fechas de calendario es invisible: fijar la zona hace que las pruebas
    // de fechas sean reproducibles fuera de México.
    env: { TZ: ZONA_PRUEBAS },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
