// Parsea asistencia-merida-2026.xlsx -> scripts/data/asistencia-2026.json
// Cada fila de sesión trae TOTALES agregados (no nombres).
import * as XLSX from "xlsx";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const buf = readFileSync("asistencia-merida-2026.xlsx");
const wb = XLSX.read(buf, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
function parseFecha(s) {
  const m = String(s).trim().toLowerCase().match(/(\d{1,2})\s+de\s+([a-zé]+)/);
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mes = MESES[m[2]];
  if (!mes) return null;
  // ISO a mediodía UTC para evitar corrimiento de día
  return `2026-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}T12:00:00.000Z`;
}

const num = (v) => {
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

// Columnas de edad: index 13..28 = edades 2..17
const edadCols = [];
for (let c = 13; c <= 28; c++) edadCols.push({ col: c, edad: c - 11 });

const sesiones = [];
// Filas de datos: 2..13 (12 sesiones)
for (let i = 2; i <= 13; i++) {
  const r = rows[i];
  if (!r || !String(r[0]).trim()) continue;
  const rawTema = String(r[0]).trim();
  const mTema = rawTema.match(/^(\d+)\.\s*(.*)$/);
  const orden = mTema ? parseInt(mTema[1], 10) : i - 1;
  const tema = mTema ? mTema[2].trim() : rawTema;

  const ninas = num(r[3]);
  const ninos = num(r[4]);
  const total = num(r[5]);
  const mamas = num(r[6]);
  const papas = num(r[7]);
  const preescolar = num(r[8]);
  const primaria = num(r[9]);
  const secundaria = num(r[10]);
  const mediaSuperior = num(r[11]);

  const porEdad = {};
  for (const { col, edad } of edadCols) {
    const v = num(r[col]);
    if (v > 0) porEdad[edad] = v;
  }

  const conDatos = total > 0 || ninas > 0 || ninos > 0;
  sesiones.push({
    orden,
    tema,
    fecha: parseFecha(r[2]),
    fechaTexto: String(r[2]).trim(),
    sede: String(r[1]).trim() || "MÉRIDA",
    ninas, ninos, total, mamas, papas,
    preescolar, primaria, secundaria, mediaSuperior,
    porEdad,
    conDatos,
  });
}

mkdirSync("scripts/data", { recursive: true });
writeFileSync("scripts/data/asistencia-2026.json", JSON.stringify(sesiones, null, 2), "utf8");

// ───────── Reporte / cruce con el registro ─────────
const parts = JSON.parse(readFileSync("scripts/data/participantes-2026.json", "utf8"));

console.log(`SESIONES parseadas: ${sesiones.length} (con datos: ${sesiones.filter(s => s.conDatos).length})`);
const conD = sesiones.filter((s) => s.conDatos);
const sumNinas = conD.reduce((a, s) => a + s.ninas, 0);
const sumNinos = conD.reduce((a, s) => a + s.ninos, 0);
const sumTotal = conD.reduce((a, s) => a + s.total, 0);
const sumMamas = conD.reduce((a, s) => a + s.mamas, 0);
const sumPapas = conD.reduce((a, s) => a + s.papas, 0);
const picoTotal = Math.max(...conD.map((s) => s.total));
console.log(`\n== ASISTENCIA (agregado, eventos sumados sobre ${conD.length} sesiones con datos) ==`);
console.log(`  Niñas: ${sumNinas} | Niños: ${sumNinos} | Total eventos: ${sumTotal}`);
console.log(`  Mamás: ${sumMamas} | Papás: ${sumPapas}`);
console.log(`  Pico por sesión: ${picoTotal} | Promedio: ${(sumTotal / conD.length).toFixed(1)}`);

console.log(`\n== REGISTRO (${parts.length} niños únicos) ==`);
const fem = parts.filter((p) => p.genero === "FEMENINO").length;
console.log(`  Niñas: ${fem} | Niños: ${parts.length - fem}`);
const byNivel = {};
for (const p of parts) byNivel[p.nivel] = (byNivel[p.nivel] || 0) + 1;
console.log("  Por nivel:", JSON.stringify(byNivel));
const edades = parts.map((p) => p.edad).filter((e) => e > 0);
console.log(`  Edad: min ${Math.min(...edades)} | max ${Math.max(...edades)} | prom ${(edades.reduce((a, b) => a + b, 0) / edades.length).toFixed(1)}`);
const ciudades = {};
for (const p of parts) ciudades[p.ciudad] = (ciudades[p.ciudad] || 0) + 1;
console.log("  Por ciudad:", JSON.stringify(ciudades));
