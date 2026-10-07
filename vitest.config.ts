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
    // Los agentes trabajan en git worktrees bajo .claude/worktrees/, que son
    // copias completas del proyecto. Sin excluirlas, vitest barre las pruebas
    // de cada copia: los conteos se multiplican y, peor, las pruebas contra
    // base real corren varias veces a la vez contra la MISMA base y chocan
    // entre sí por los años únicos de Edicion, dando fallos que no existen.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.claude/worktrees/**",
    ],
    // Un fichero de pruebas a la vez. Las de tests/integration/db/ comparten UNA
    // sola base de datos y cada una siembra y borra sus propias ediciones; en
    // paralelo se pisan entre sí y chocan por el año único de Edicion, dando
    // fallos que no existen en el código. Pasó en cuanto hubo ocho ficheros.
    // La suite entera tarda ~7 s en serie frente a ~2 s en paralelo: no vale la
    // pena perseguir fallos fantasma por ahorrar cinco segundos.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
