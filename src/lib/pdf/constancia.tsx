import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  DISENO_CONSTANCIA,
  NOTA_PROVISIONAL,
  marcaProvisional,
  type DisenoConstancia,
} from "@/lib/pdf/diseno-constancia";

// ─────────────────────────────────────────────────────────────────────────────
// Generador de la constancia.
//
// Este archivo pinta; NO decide cómo se ve. El fondo, las firmas, los textos y
// los colores salen todos de `diseno-constancia.ts`, que es lo único que hay
// que tocar cuando el cliente entregue el arte definitivo.
//
// Ojo con el texto del cuerpo: desde el cambio de política la constancia la
// recibe todo inscrito, así que NO puede afirmar que el niño "cumplió los
// requisitos de asistencia" — no es cierto para todos. Dice que participó, que
// sí lo es.
// ─────────────────────────────────────────────────────────────────────────────

export type DatosConstancia = {
  nombre: string;
  apellidos: string;
  escuela: string;
  grado: string;
  edicion: { nombre: string; anio: number };
  asistencias: number;
  totalSesiones: number;
  fechaEmision: string;
};

function hojaDeEstilos(d: DisenoConstancia) {
  return StyleSheet.create({
    page: {
      padding: d.margen,
      fontFamily: "Helvetica",
      backgroundColor: "#FFFFFF",
    },
    fondo: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    },
    contenido: { flexGrow: 1 },
    titulo: {
      fontSize: 20,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      marginBottom: 8,
      color: d.colores.titulo,
    },
    subtitulo: {
      fontSize: 11,
      textAlign: "center",
      color: d.colores.tenue,
      marginBottom: 36,
    },
    cuerpo: {
      fontSize: 11,
      lineHeight: 1.8,
      color: d.colores.texto,
      marginBottom: 16,
      textAlign: "center",
    },
    nombre: {
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      color: d.colores.titulo,
      marginBottom: 12,
    },
    separador: {
      borderBottom: `0.5pt solid ${d.colores.linea}`,
      marginVertical: 20,
    },
    row: { flexDirection: "row", marginBottom: 6 },
    label: { fontSize: 10, color: d.colores.tenue, width: 130 },
    value: {
      fontSize: 10,
      fontFamily: "Helvetica-Bold",
      color: d.colores.texto,
      flex: 1,
    },
    firmas: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: 36,
    },
    firma: { alignItems: "center", width: 180 },
    firmaImagen: { height: 40, objectFit: "contain", marginBottom: 4 },
    firmaEspacio: { height: 40 },
    firmaLinea: {
      borderTop: `0.8pt solid ${d.colores.texto}`,
      width: "100%",
      marginBottom: 4,
    },
    firmaNombre: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: d.colores.texto,
      textAlign: "center",
    },
    firmaCargo: {
      fontSize: 8,
      color: d.colores.tenue,
      textAlign: "center",
      marginTop: 2,
    },
    marcaBanda: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingVertical: 5,
      backgroundColor: d.colores.marca,
    },
    marcaTexto: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: "#FFFFFF",
      textAlign: "center",
      letterSpacing: 1.2,
    },
    marcaAgua: {
      position: "absolute",
      top: 330,
      left: 0,
      right: 0,
      fontSize: 34,
      fontFamily: "Helvetica-Bold",
      color: d.colores.marca,
      opacity: 0.12,
      textAlign: "center",
      letterSpacing: 2,
    },
    pie: {
      position: "absolute",
      bottom: 40,
      left: d.margen,
      right: d.margen,
      fontSize: 8,
      textAlign: "center",
      color: d.colores.tenue,
    },
    pieProvisional: {
      fontSize: 7,
      textAlign: "center",
      color: d.colores.marca,
      marginTop: 3,
    },
  });
}

const datosTabla = (d: DatosConstancia): [string, string][] => [
  ["Participante", `${d.nombre} ${d.apellidos}`],
  ["Escuela", d.escuela],
  ["Grado", d.grado],
  ["Edición", `${d.edicion.nombre} ${d.edicion.anio}`],
  ["Asistencias", `${d.asistencias} de ${d.totalSesiones} sesiones`],
  ["Fecha de emisión", d.fechaEmision],
];

function ConstanciaDoc({
  d,
  diseno,
}: {
  d: DatosConstancia;
  diseno: DisenoConstancia;
}) {
  const styles = hojaDeEstilos(diseno);
  const marca = marcaProvisional(diseno);
  const nombreCompleto = `${d.nombre} ${d.apellidos}`;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Arte de fondo — ausente mientras el cliente no lo entregue */}
        {diseno.fondo && (
          // El `Image` de @react-pdf pinta dentro de un PDF, no en el DOM: no
          // tiene `alt` ni lo admite. La regla de accesibilidad web no aplica.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={diseno.fondo} style={styles.fondo} fixed />
        )}

        {marca && <Text style={styles.marcaAgua}>{marca}</Text>}

        <View style={styles.contenido}>
          <Text style={styles.titulo}>{diseno.textos.titulo}</Text>
          <Text style={styles.subtitulo}>{diseno.textos.subtitulo}</Text>

          <Text style={styles.nombre}>{nombreCompleto}</Text>

          <Text style={styles.cuerpo}>
            {diseno.textos.cuerpo({
              nombreCompleto,
              grado: d.grado,
              escuela: d.escuela,
              edicion: `${d.edicion.nombre} (${d.edicion.anio})`,
            })}
          </Text>

          {diseno.mostrarTablaDatos && (
            <>
              <View style={styles.separador} />
              {datosTabla(d).map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.label}>{label}:</Text>
                  <Text style={styles.value}>{value}</Text>
                </View>
              ))}
            </>
          )}

          {diseno.firmas.length > 0 && (
            <View style={styles.firmas}>
              {diseno.firmas.map((firma) => (
                <View key={`${firma.nombre}-${firma.cargo}`} style={styles.firma}>
                  {firma.imagen ? (
                    // Igual que el fondo: es una imagen de PDF, no del DOM.
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={firma.imagen} style={styles.firmaImagen} />
                  ) : (
                    <View style={styles.firmaEspacio} />
                  )}
                  <View style={styles.firmaLinea} />
                  <Text style={styles.firmaNombre}>{firma.nombre}</Text>
                  <Text style={styles.firmaCargo}>{firma.cargo}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.pie}>
          <Text>{diseno.textos.pie}</Text>
          {marca && <Text style={styles.pieProvisional}>{NOTA_PROVISIONAL}</Text>}
        </View>

        {marca && (
          <View style={styles.marcaBanda} fixed>
            <Text style={styles.marcaTexto}>{marca}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/**
 * Arma el PDF. `diseno` existe para poder probar el arte definitivo sin tocar
 * el generador; en producción siempre se usa el de `diseno-constancia.ts`.
 */
export async function generarPDFConstancia(
  datos: DatosConstancia,
  diseno: DisenoConstancia = DISENO_CONSTANCIA,
): Promise<Buffer> {
  const ab = await renderToBuffer(<ConstanciaDoc d={datos} diseno={diseno} />);
  return Buffer.from(ab);
}
