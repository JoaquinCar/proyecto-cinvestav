// Homologa grado y escuela de los participantes (reduce variantes que significan lo mismo).
// Reejecutable: aplica las mismas reglas y actualiza la BD.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ORDINAL_WORDS = {
  primero: 1, primer: 1, segundo: 2, tercero: 3, tercer: 3,
  cuarto: 4, quinto: 5, sexto: 6,
  "1ero": 1, "2do": 2, "3ero": 3, "3er": 3, "4to": 4, "5to": 5, "6to": 6,
};

function ordinal(s) {
  const t = s.toLowerCase();
  for (const [w, n] of Object.entries(ORDINAL_WORDS)) if (t.includes(w)) return n;
  const m = t.match(/(\d)\s*[°ºªo.]/) || t.match(/^\s*(\d)\b/) || t.match(/(\d)/);
  return m ? parseInt(m[1], 10) : null;
}

function nivelDe(texto, edad) {
  const s = texto.toLowerCase();
  if (/preescolar|kinder|preesc/.test(s)) return "Preescolar";
  if (/semestre|prepa|cecyte|bachill|media superior/.test(s)) return "Bachillerato";
  if (/secundaria|sec\.|esc\. sec|\baño\b/.test(s)) return "Secundaria";
  if (/primaria|grado|°|º/.test(s)) return edad >= 12 ? "Secundaria" : "Primaria";
  if (edad < 6) return "Preescolar";
  if (edad <= 11) return "Primaria";
  if (edad <= 14) return "Secundaria";
  return "Bachillerato";
}

function normGrado(grado, escuela, edad) {
  if (/no va a escuela|no asiste/i.test(grado)) return "Sin escuela";
  const niv = nivelDe(`${grado} ${escuela}`, edad);
  if (niv === "Preescolar" || niv === "Bachillerato") return niv; // colapsar
  const ord = ordinal(grado);
  if (ord && ord >= 1 && ord <= 6 && (niv === "Primaria" || niv === "Secundaria")) {
    return `${ord}° ${niv}`;
  }
  return niv;
}

const ESCUELA_ALIAS = {
  "emma godoy": "Primaria Emma Godoy",
  "primaria emma godoy": "Primaria Emma Godoy",
  "sor juana": "Sor Juana Inés de la Cruz",
  "sor juana inez de la cruz": "Sor Juana Inés de la Cruz",
  "primaria sor juana inez de la cruz": "Sor Juana Inés de la Cruz",
  "preescolar chak pepen": "Preescolar Chak Pepen",
};

function normEscuela(e) {
  const key = e.trim().toLowerCase().replace(/\s+/g, " ");
  return ESCUELA_ALIAS[key] ?? e.trim();
}

const ps = await prisma.participante.findMany();
let cambios = 0;
for (const p of ps) {
  const g = normGrado(p.grado, p.escuela, p.edad);
  const e = normEscuela(p.escuela);
  if (g !== p.grado || e !== p.escuela) {
    await prisma.participante.update({ where: { id: p.id }, data: { grado: g, escuela: e } });
    cambios++;
  }
}
console.log(`Participantes actualizados: ${cambios}/${ps.length}`);

const after = await prisma.participante.findMany({ select: { grado: true, escuela: true } });
const tally = (arr, k) => {
  const m = {};
  for (const x of arr) m[x[k]] = (m[x[k]] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};
console.log(`\nGRADOS (${new Set(after.map((x) => x.grado)).size}):`);
for (const [k, v] of tally(after, "grado")) console.log(`  ${v}× ${k}`);
console.log(`\nESCUELAS (${new Set(after.map((x) => x.escuela)).size}):`);
for (const [k, v] of tally(after, "escuela")) console.log(`  ${v}× ${k}`);

await prisma.$disconnect();
