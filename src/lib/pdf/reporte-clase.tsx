import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type DatosReporteClase = {
  clase: { nombre: string; investigador: string };
  edicion: { nombre: string; anio: number };
  sesiones: { fecha: string; temas: string | null; asistentes: number; total: number }[];
  participantes: { nombre: string; apellidos: string; escuela: string; asistenciasEnClase: number }[];
  totalParticipantes: number;
  promedioAsistencia: number;
};

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", backgroundColor: "#FFFFFF" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1a1a2e", marginBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#333", marginBottom: 6, marginTop: 14 },
  sub: { fontSize: 9, color: "#777", marginBottom: 20 },
  summaryRow: { flexDirection: "row", gap: 20, marginBottom: 4 },
  summaryItem: { fontSize: 10, color: "#555" },
  summaryBold: { fontFamily: "Helvetica-Bold", color: "#1a1a2e" },
  header: { flexDirection: "row", borderBottom: "1pt solid #bbb", paddingBottom: 3, marginBottom: 2 },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #eee", paddingVertical: 3 },
  cellSm: { fontSize: 8, color: "#333", width: 80 },
  cellMd: { fontSize: 8, color: "#333", width: 48 },
  cellFlex: { fontSize: 8, color: "#333", flex: 1 },
  cellBold: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#1a1a2e" },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 7, textAlign: "center", color: "#bbb" },
});

function ReporteDoc({ d }: { d: DatosReporteClase }) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>{d.clase.nombre}</Text>
        <Text style={s.sub}>
          Investigador: {d.clase.investigador} · {d.edicion.nombre} {d.edicion.anio}
        </Text>

        <View style={s.summaryRow}>
          {[
            ["Participantes", String(d.totalParticipantes)],
            ["Sesiones", String(d.sesiones.length)],
            ["Asistencia prom.", `${d.promedioAsistencia}%`],
          ].map(([label, val]) => (
            <Text key={label} style={s.summaryItem}>
              {label}: <Text style={s.summaryBold}>{val}</Text>
            </Text>
          ))}
        </View>

        <Text style={s.h2}>Sesiones</Text>
        <View style={s.header}>
          <Text style={[s.cellBold, { width: 80 }]}>Fecha</Text>
          <Text style={[s.cellBold, { width: 60 }]}>Asistentes</Text>
          <Text style={[s.cellBold, { flex: 1 }]}>Temas</Text>
        </View>
        {d.sesiones.map((ses, i) => (
          <View key={i} style={s.row}>
            <Text style={s.cellSm}>{ses.fecha}</Text>
            <Text style={[s.cellMd, { width: 60 }]}>{ses.asistentes}/{ses.total}</Text>
            <Text style={s.cellFlex}>{ses.temas ?? "—"}</Text>
          </View>
        ))}

        <Text style={s.h2}>Participantes</Text>
        <View style={s.header}>
          <Text style={[s.cellBold, { flex: 2 }]}>Nombre</Text>
          <Text style={[s.cellBold, { flex: 2 }]}>Escuela</Text>
          <Text style={[s.cellBold, { width: 60 }]}>Asistencias</Text>
        </View>
        {d.participantes.map((p, i) => (
          <View key={i} style={s.row}>
            <Text style={[s.cellFlex, { flex: 2 }]}>{p.apellidos}, {p.nombre}</Text>
            <Text style={[s.cellFlex, { flex: 2 }]}>{p.escuela}</Text>
            <Text style={[s.cellMd, { width: 60 }]}>{p.asistenciasEnClase}</Text>
          </View>
        ))}

        <Text style={s.footer}>
          CINVESTAV Unidad Mérida · Pasaporte Científico · Generado electrónicamente
        </Text>
      </Page>
    </Document>
  );
}

export async function generarPDFReporteClase(datos: DatosReporteClase): Promise<Buffer> {
  const ab = await renderToBuffer(<ReporteDoc d={datos} />);
  return Buffer.from(ab);
}
