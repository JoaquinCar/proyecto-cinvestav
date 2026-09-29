import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La plantilla del informe en Word es un .docx que se lee con `fs` en tiempo
  // de ejecución (ver src/lib/word/informe-sesion.ts). Next solo empaqueta los
  // archivos que detecta en el código, y un binario abierto por ruta no lo
  // detecta: sin esto la exportación funciona en local y falla en Vercel con un
  // ENOENT.
  outputFileTracingIncludes: {
    "/api/word/informe-sesion/[claseId]": [
      "./src/lib/word/plantilla-informe-sesion.docx",
    ],
  },
};

export default nextConfig;
