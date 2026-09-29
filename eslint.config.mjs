import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Los agentes trabajan en git worktrees bajo .claude/worktrees/, que son
    // copias completas del proyecto. Sin esto, lint las recorre y devuelve
    // decenas de miles de avisos ajenos que esconden los reales.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
