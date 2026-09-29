import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Aviso de Privacidad · Pasaporte Científico",
  description: "Aviso de privacidad del programa Pasaporte Científico, CINVESTAV Unidad Mérida.",
};

// NOTA: plantilla base conforme a la LFPDPPP (México). Debe ser revisada y
// completada por la institución (responsable, datos de contacto del área de
// datos personales) antes de considerarse el aviso oficial.
export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm mb-6 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Volver
        </Link>

        <h1 className="font-display text-3xl font-semibold text-foreground mb-2">
          Aviso de Privacidad
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Programa Pasaporte Científico · CINVESTAV Unidad Mérida
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="font-semibold mb-1">1. Responsable</h2>
            <p className="text-muted-foreground">
              El Centro de Investigación y de Estudios Avanzados del IPN (CINVESTAV),
              Unidad Mérida, es responsable del tratamiento de los datos personales
              recabados a través de este sistema.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">2. Datos que se recaban</h2>
            <p className="text-muted-foreground">
              Datos de las y los participantes (menores de edad): nombre, edad,
              escuela, grado escolar y género; y datos de contacto del padre, madre o
              tutor: correo electrónico y teléfono. Se registran asistencias a las
              sesiones del programa.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">3. Finalidad</h2>
            <p className="text-muted-foreground">
              Los datos se utilizan únicamente para administrar la participación en el
              programa, controlar la asistencia, generar reportes estadísticos internos
              y, en su caso, contactar al tutor. No se usan con fines comerciales ni se
              comparten con terceros ajenos al programa.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">4. Datos de menores y consentimiento</h2>
            <p className="text-muted-foreground">
              Al tratarse de datos de menores de edad, su registro requiere el
              consentimiento del padre, madre o tutor, quien ejerce los derechos
              correspondientes en su representación.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">5. Transferencias y ubicación de los datos</h2>
            <p className="text-muted-foreground">
              La información se aloja en servicios de cómputo en la nube (Vercel y
              Supabase) cuyos servidores pueden ubicarse en Estados Unidos. El acceso
              está restringido al personal autorizado del programa mediante
              autenticación.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">6. Derechos ARCO</h2>
            <p className="text-muted-foreground">
              El titular (o su tutor) puede solicitar el acceso, rectificación,
              cancelación u oposición (ARCO) respecto de sus datos, así como revocar el
              consentimiento, contactando a la coordinación del programa.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">7. Contacto</h2>
            <p className="text-muted-foreground">
              Para ejercer sus derechos o resolver dudas sobre este aviso, contacte a la
              coordinación del Pasaporte Científico, CINVESTAV Unidad Mérida.
            </p>
          </section>

          <p className="text-xs text-muted-foreground/70 pt-4 border-t border-border">
            Documento base pendiente de revisión y validación institucional. Última
            actualización: 2026.
          </p>
        </div>
      </div>
    </main>
  );
}
