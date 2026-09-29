import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

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

const styles = StyleSheet.create({
  page: { padding: 60, fontFamily: "Helvetica", backgroundColor: "#FFFFFF" },
  titulo: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#1a1a2e",
  },
  subtitulo: { fontSize: 11, textAlign: "center", color: "#666", marginBottom: 36 },
  cuerpo: { fontSize: 11, lineHeight: 1.8, color: "#333", marginBottom: 16 },
  bold: { fontFamily: "Helvetica-Bold" },
  separador: { borderBottom: "0.5pt solid #ccc", marginVertical: 20 },
  row: { flexDirection: "row", marginBottom: 6 },
  label: { fontSize: 10, color: "#888", width: 130 },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#333", flex: 1 },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
    fontSize: 8,
    textAlign: "center",
    color: "#bbb",
  },
});

const datosTabla = (d: DatosConstancia): [string, string][] => [
  ["Participante", `${d.nombre} ${d.apellidos}`],
  ["Escuela", d.escuela],
  ["Grado", d.grado],
  ["Edición", `${d.edicion.nombre} ${d.edicion.anio}`],
  ["Asistencias", `${d.asistencias} de ${d.totalSesiones} sesiones`],
  ["Fecha de emisión", d.fechaEmision],
];

function ConstanciaDoc({ d }: { d: DatosConstancia }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.titulo}>Constancia de Participación</Text>
        <Text style={styles.subtitulo}>
          Programa Pasaporte Científico · CINVESTAV Unidad Mérida
        </Text>

        <Text style={styles.cuerpo}>
          Se hace constar que{" "}
          <Text style={styles.bold}>
            {d.nombre} {d.apellidos}
          </Text>
          , alumno(a) de <Text style={styles.bold}>{d.grado}</Text> de la
          escuela <Text style={styles.bold}>{d.escuela}</Text>, participó en la
          edición{" "}
          <Text style={styles.bold}>
            {d.edicion.nombre} ({d.edicion.anio})
          </Text>{" "}
          del programa Pasaporte Científico, cumpliendo satisfactoriamente con
          los requisitos de asistencia establecidos.
        </Text>

        <View style={styles.separador} />

        {datosTabla(d).map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}:</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          CINVESTAV Unidad Mérida · Pasaporte Científico · Documento generado
          electrónicamente
        </Text>
      </Page>
    </Document>
  );
}

export async function generarPDFConstancia(
  datos: DatosConstancia,
): Promise<Buffer> {
  const ab = await renderToBuffer(<ConstanciaDoc d={datos} />);
  return Buffer.from(ab);
}
