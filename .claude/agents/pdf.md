# Agente: PDF
## Rol
Implementar la generación de documentos PDF: constancias individuales para participantes y reportes por clase. Usa `@react-pdf/renderer` para el renderizado y Supabase Storage para almacenamiento.

## Responsabilidades
- Constancia automática al cumplir mínimo de asistencias (Módulo 5)
- Reporte PDF por clase con lista de asistencia y gráficas (Módulo 7)
- Reporte general exportable (parte del Módulo 6)

## Dependencias
```json
{
  "@react-pdf/renderer": "^3.4.0",
  "recharts": "^2.12.0"
}
```

## Estructura

```
src/
├── lib/
│   └── pdf/
│       ├── constancia.tsx      ← Template de constancia
│       ├── reporte-clase.tsx   ← Template de reporte por clase
│       └── utils.ts            ← Helpers de PDF
└── app/api/
    ├── pdf/constancia/[inscripcionId]/route.ts
    └── pdf/reporte-clase/[claseId]/route.ts
```

## Template de Constancia

```tsx
// src/lib/pdf/constancia.tsx
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#003087",
    paddingBottom: 15,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#003087",
    textAlign: "center",
    marginBottom: 10,
  },
  nombre: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1a1a1a",
    marginVertical: 20,
  },
  cuerpo: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 1.6,
    color: "#333",
    marginHorizontal: 30,
  },
  firma: {
    marginTop: 60,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  lineaFirma: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    width: 180,
    textAlign: "center",
    paddingTop: 5,
    fontSize: 10,
    color: "#666",
  },
});

interface ConstanciaProps {
  participante: {
    nombre: string;
    apellidos: string;
    escuela: string;
    grado: string;
  };
  edicion: {
    nombre: string;
    anio: number;
    fechaInicio: Date;
    fechaFin: Date;
  };
  asistencias: number;
  clases: string[];
}

export function ConstanciaPDF({ participante, edicion, asistencias, clases }: ConstanciaProps) {
  const fechaFormato = (d: Date) =>
    d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          {/* Logo CINVESTAV aquí */}
          <Text style={{ fontSize: 10, color: "#666" }}>
            CINVESTAV Unidad Mérida
          </Text>
        </View>

        <Text style={styles.titulo}>CONSTANCIA DE PARTICIPACIÓN</Text>
        <Text style={{ textAlign: "center", fontSize: 11, color: "#666", marginBottom: 15 }}>
          Programa {edicion.nombre}
        </Text>

        <Text style={{ textAlign: "center", fontSize: 12, color: "#333" }}>
          Se otorga la presente constancia a:
        </Text>

        <Text style={styles.nombre}>
          {participante.nombre} {participante.apellidos}
        </Text>

        <Text style={styles.cuerpo}>
          Alumno/a de {participante.grado} grado de la escuela {participante.escuela},{"\n"}
          por haber participado satisfactoriamente en el {edicion.nombre},{"\n"}
          asistiendo a {asistencias} sesiones del{" "}
          {fechaFormato(edicion.fechaInicio)} al {fechaFormato(edicion.fechaFin)}.
        </Text>

        {clases.length > 0 && (
          <Text style={{ textAlign: "center", fontSize: 10, color: "#666", marginTop: 15 }}>
            Clases: {clases.join(" · ")}
          </Text>
        )}

        <View style={styles.firma}>
          <View>
            <View style={styles.lineaFirma}>
              <Text>Coordinación del Programa</Text>
              <Text style={{ color: "#003087", fontWeight: "bold" }}>CINVESTAV Mérida</Text>
            </View>
          </View>
          <View>
            <View style={styles.lineaFirma}>
              <Text>Fecha de Expedición</Text>
              <Text>{fechaFormato(new Date())}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
```

## API Route para Generar y Guardar Constancia

```typescript
// src/app/api/pdf/constancia/[inscripcionId]/route.ts
import { renderToBuffer } from "@react-pdf/renderer";
import { supabase } from "@/lib/supabase";
import { prisma } from "@/server/db";
import { ConstanciaPDF } from "@/lib/pdf/constancia";
import { verificarConstancia } from "@/server/queries/participantes";

export async function POST(req: Request, { params }: { params: { inscripcionId: string } }) {
  const elegibilidad = await verificarConstancia(params.inscripcionId);

  if (!elegibilidad?.elegible) {
    return Response.json({ error: "No cumple requisitos" }, { status: 400 });
  }

  // Obtener datos completos...
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: params.inscripcionId },
    include: {
      participante: true,
      edicion: true,
      asistencias: {
        where: { presente: true },
        include: { sesion: { include: { clase: true } } },
      },
    },
  });

  const clases = [...new Set(
    inscripcion!.asistencias.map(a => a.sesion.clase.nombre)
  )];

  // Renderizar PDF
  const buffer = await renderToBuffer(
    <ConstanciaPDF
      participante={inscripcion!.participante}
      edicion={inscripcion!.edicion}
      asistencias={elegibilidad.asistio}
      clases={clases}
    />
  );

  // Subir a Supabase Storage
  const fileName = `constancias/${inscripcion!.edicion.anio}/${params.inscripcionId}.pdf`;
  await supabase.storage.from("documentos").upload(fileName, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { data: { publicUrl } } = supabase.storage
    .from("documentos")
    .getPublicUrl(fileName);

  // Guardar URL en DB
  await prisma.inscripcion.update({
    where: { id: params.inscripcionId },
    data: { constanciaUrl: publicUrl, constanciaGenerada: true },
  });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="constancia-${params.inscripcionId}.pdf"`,
    },
  });
}
```

## Reglas del Agente PDF
1. Los PDFs se generan server-side (API Route), nunca en el cliente.
2. Siempre subir a Supabase Storage y guardar la URL pública en DB.
3. Verificar elegibilidad antes de generar — nunca generar constancias sin cumplir requisitos.
4. Usar `renderToBuffer` (Node.js) no `renderToStream` para consistencia.
5. Los templates de PDF usan los colores corporativos de CINVESTAV.