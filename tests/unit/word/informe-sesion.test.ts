import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  generarInformeSesionWord,
  type DatosInformeSesion,
  type FotoInforme,
} from "@/lib/word/informe-sesion";
import { leerZip } from "@/lib/word/zip";
import { dimensionesImagen, ajustarACaja } from "@/lib/word/dimensiones-imagen";

// ─────────────────────────────────────────────────────────────────────────────
// El informe de sesión en Word.
//
// Lo que estas pruebas cuidan, en orden de gravedad si se rompiera:
//
//   1. Que el BANNER INSTITUCIONAL siga dentro. Es lo único que el cliente
//      pidió conservar sí o sí: ECOSUR, Cinvestav, IPN, UMAR, Centro de
//      Geociencias, UNAM, REAC, Renacimiento Maya y SECIHTI. Un informe sin él
//      no sirve para nada.
//   2. Que el archivo sea un .docx que abra. Un ZIP mal cerrado es un
//      «Word no puede abrir este documento» y no hay forma de recuperarlo.
//   3. Que las fotos salgan en el orden de `ImagenClase.orden` y con su pie.
//      El orden lo decide quien arma el reporte; si el documento lo ignora,
//      esa función de la aplicación deja de tener sentido.
//   4. Que un dato que falta no deje un hueco visible: ni «{{OBJETIVO}}» ni
//      «Autor: null».
// ─────────────────────────────────────────────────────────────────────────────

const RUTA_PLANTILLA = path.join(
  process.cwd(),
  "src/lib/word/plantilla-informe-sesion.docx",
);

/**
 * Un PNG con cabecera válida y el tamaño que se le pida.
 *
 * `dimensionesImagen` solo lee la cabecera, y Word no llega a abrir nada en una
 * prueba: no hace falta un PNG de verdad, y meter binarios en el repositorio
 * para esto sería peor.
 */
function pngDe(ancho: number, alto: number, relleno: number): Buffer {
  const cabecera = Buffer.alloc(24);
  cabecera.writeUInt32BE(0x89504e47, 0);
  cabecera.writeUInt32BE(0x0d0a1a0a, 4);
  cabecera.writeUInt32BE(13, 8);
  cabecera.write("IHDR", 12, "ascii");
  cabecera.writeUInt32BE(ancho, 16);
  cabecera.writeUInt32BE(alto, 20);
  return Buffer.concat([cabecera, Buffer.alloc(16, relleno)]);
}

function foto(pie: string | null, relleno: number): FotoInforme {
  return { pie, mimeType: "image/png", datos: pngDe(800, 600, relleno) };
}

const BASE: DatosInformeSesion = {
  numeroSesion: "3",
  fecha: "21 de febrero de 2026",
  titulo: "Los misteriosos gusanos marinos",
  autor: "Mayra Vázquez Luna",
  objetivo: "Descubrir que existen muchos tipos de gusanos marinos.",
  descripcion: "Los gusanos marinos son animales invertebrados.\nViven escondidos.",
  comentarios: "1. La plática despertó el interés.\n2. La integración fue buena.",
  fotos: [],
  anexo: null,
};

async function generar(datos: Partial<DatosInformeSesion> = {}) {
  const buffer = await generarInformeSesionWord({ ...BASE, ...datos });
  const entradas = leerZip(buffer);
  const documento = entradas.find((e) => e.nombre === "word/document.xml");
  return {
    buffer,
    entradas,
    nombres: entradas.map((e) => e.nombre),
    xml: documento!.datos.toString("utf8"),
    medio: (nombre: string) => entradas.find((e) => e.nombre === nombre)?.datos,
  };
}

/** Texto plano del documento, como lo leería alguien al abrirlo en Word. */
function textoVisible(xml: string): string {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("\n");
}

describe("informe de sesión en Word", () => {
  it("produce un paquete que se puede abrir y trae las partes de un .docx", async () => {
    const { buffer, nombres } = await generar();

    // Firma de cabecera local: los dos primeros bytes de cualquier ZIP.
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    expect(nombres).toContain("[Content_Types].xml");
    expect(nombres).toContain("word/document.xml");
    expect(nombres).toContain("word/_rels/document.xml.rels");
    expect(nombres).toContain("word/styles.xml");
  });

  it("conserva el banner institucional intacto", async () => {
    const plantilla = leerZip(await readFile(RUTA_PLANTILLA));
    const bannerOriginal = plantilla.find(
      (e) => e.nombre === "word/media/image1.png",
    )!.datos;

    const { medio, xml } = await generar({ fotos: [foto("Una foto", 1)] });

    const banner = medio("word/media/image1.png");
    expect(banner).toBeDefined();
    expect(banner!.equals(bannerOriginal)).toBe(true);

    // Y sigue REFERENCIADO: un archivo huérfano en word/media no se ve.
    expect(xml).toContain('r:embed="rId5"');
  });

  it("no deja ningún marcador de plantilla en el documento", async () => {
    const { xml } = await generar({
      fotos: [foto("Portada", 1), foto("Segunda", 2)],
      anexo: {
        ninos: [
          { apellidos: "Canul", nombre: "Ana", edad: 9, escuela: "Primaria A", grado: "4º" },
        ],
        staff: [{ nombre: "Rocío Canul", rol: "Becario o becaria", institucion: "CINVESTAV" }],
      },
    });

    expect(xml).not.toContain("{{");
    expect(xml).not.toContain("BLOQUE:");
  });

  it("imprime las fotos en el orden recibido, cada una con su pie", async () => {
    const { xml, medio, entradas } = await generar({
      fotos: [
        foto("Portada de la sesión", 1),
        foto("Iniciando la tercera sesión", 2),
        foto("Niños armando el rompecabezas", 3),
        foto("Descubriendo las formas", 4),
      ],
    });

    const texto = textoVisible(xml);
    const posicion = (pie: string) => texto.indexOf(pie);

    expect(posicion("Iniciando la tercera sesión")).toBeGreaterThan(-1);
    expect(posicion("Iniciando la tercera sesión")).toBeLessThan(
      posicion("Niños armando el rompecabezas"),
    );
    expect(posicion("Niños armando el rompecabezas")).toBeLessThan(
      posicion("Descubriendo las formas"),
    );

    // La primera foto es la PORTADA: no va en la galería y no lleva pie.
    expect(texto).not.toContain("Portada de la sesión");

    // Cada foto entró como un archivo propio y con SUS bytes, no con los de otra.
    expect(medio("word/media/informe-0.png")!.equals(pngDe(800, 600, 1))).toBe(true);
    expect(medio("word/media/informe-1.png")!.equals(pngDe(800, 600, 2))).toBe(true);
    expect(medio("word/media/informe-3.png")!.equals(pngDe(800, 600, 4))).toBe(true);

    // Y cada una tiene su relación declarada, o Word las pinta como un hueco.
    const rels = entradas
      .find((e) => e.nombre === "word/_rels/document.xml.rels")!
      .datos.toString("utf8");
    for (let i = 0; i < 4; i += 1) {
      expect(rels).toContain(`Id="rIdInforme${i}"`);
      expect(rels).toContain(`Target="media/informe-${i}.png"`);
      expect(xml).toContain(`r:embed="rIdInforme${i}"`);
    }
  });

  it("empareja las fotos de dos en dos y completa la fila impar", async () => {
    // Tres fotos: una de portada y dos en la galería → una sola fila completa.
    const dos = await generar({
      fotos: [foto(null, 1), foto("A", 2), foto("B", 3)],
    });
    expect((dos.xml.match(/rIdInforme/g) ?? []).length).toBe(3);

    // Cuatro: portada y tres en la galería → dos filas, la segunda a medias.
    const tres = await generar({
      fotos: [foto(null, 1), foto("A", 2), foto("B", 3), foto("C", 4)],
    });
    const filas = tres.xml
      .slice(tres.xml.indexOf("Fotos de la sesión"))
      .match(/<w:tr>/g);
    expect(filas?.length).toBe(2);
  });

  it("una sesión sin fotos sale igual, sin sección de fotos y con el banner", async () => {
    const { xml, medio, nombres } = await generar({ fotos: [] });

    expect(textoVisible(xml)).not.toContain("Fotos de la sesión");
    expect(nombres.filter((n) => n.startsWith("word/media/"))).toEqual([
      "word/media/image1.png",
    ]);
    expect(medio("word/media/image1.png")).toBeDefined();

    // El resto del informe sigue completo.
    expect(textoVisible(xml)).toContain("Los misteriosos gusanos marinos");
    expect(textoVisible(xml)).toContain("Desarrollo de actividad");
  });

  it("un evento sin investigador no imprime «Autor» ni «null»", async () => {
    const { xml } = await generar({
      titulo: "Clausura del Pasaporte",
      autor: null,
      objetivo: null,
      comentarios: null,
    });

    const texto = textoVisible(xml);
    expect(texto).not.toContain("Autor:");
    expect(texto).not.toContain("null");
    expect(texto).not.toContain("undefined");
    expect(texto).toContain("Clausura del Pasaporte");
  });

  it("sin objetivo ni comentarios, esos encabezados desaparecen", async () => {
    const { xml } = await generar({ objetivo: null, comentarios: null });
    const texto = textoVisible(xml);

    expect(texto).not.toContain("Objetivo:");
    expect(texto).not.toContain("Comentarios");
    // El desarrollo sí estaba, así que sigue.
    expect(texto).toContain("Desarrollo de actividad");
  });

  it("parte los textos largos en párrafos y no en una sola línea", async () => {
    const { xml } = await generar({
      comentarios: "1. Primero.\n\n2. Segundo.\n3. Tercero.",
    });
    const texto = textoVisible(xml);

    expect(texto).toContain("1. Primero.");
    expect(texto).toContain("2. Segundo.");
    expect(texto).toContain("3. Tercero.");
    // Las líneas en blanco no se convierten en párrafos vacíos.
    expect(xml).not.toContain("<w:t xml:space=\"preserve\"></w:t>");
  });

  it("escapa el texto que escribe una persona", async () => {
    const { xml } = await generar({
      titulo: 'Niños & niñas <de> "primaria"',
      fotos: [foto(null, 1), foto("Rocas & minerales", 2)],
    });

    expect(xml).toContain("Niños &amp; niñas &lt;de&gt;");
    expect(xml).toContain("Rocas &amp; minerales");
    // Y el paquete sigue siendo legible: si el XML se hubiera roto, `leerZip`
    // habría devuelto algo, pero esto comprueba que no quedó un `&` suelto.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/);
  });

  it("anexa quiénes participaron, sin un solo teléfono ni correo", async () => {
    const { xml } = await generar({
      anexo: {
        ninos: [
          { apellidos: "Canul Pech", nombre: "Ana", edad: 9, escuela: "Primaria A", grado: "4º" },
          { apellidos: "Dzul", nombre: "Luis", edad: 10, escuela: "Primaria B", grado: "5º" },
        ],
        staff: [
          { nombre: "Rocío Canul", rol: "Becario o becaria", institucion: "CINVESTAV Mérida" },
        ],
      },
    });

    const texto = textoVisible(xml);
    expect(texto).toContain("Anexo: quiénes participaron en la sesión");
    expect(texto).toContain("Niñas y niños que asistieron (2)");
    expect(texto).toContain("Canul Pech");
    expect(texto).toContain("Staff de la sesión (1)");
    expect(texto).toContain("Rocío Canul");
    expect(texto).toContain("CINVESTAV Mérida");
    expect(texto).not.toContain("Teléfono");
    expect(texto).not.toContain("Correo");
  });

  it("no imprime una página de anexo vacía", async () => {
    const vacio = await generar({ anexo: { ninos: [], staff: [] } });
    expect(textoVisible(vacio.xml)).not.toContain("Anexo");

    const sinAnexo = await generar({ anexo: null });
    expect(textoVisible(sinAnexo.xml)).not.toContain("Anexo");
  });
});

describe("tamaño de las imágenes", () => {
  it("lee las dimensiones de un PNG", () => {
    expect(dimensionesImagen(pngDe(1280, 960, 0))).toEqual({ ancho: 1280, alto: 960 });
  });

  it("lee las dimensiones de un JPEG por su marca SOF0", () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, // SOI
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 de relleno
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, // SOF0: 300 x 400
    ]);
    expect(dimensionesImagen(jpeg)).toEqual({ ancho: 400, alto: 300 });
  });

  it("no lanza con un archivo que no es una imagen", () => {
    expect(dimensionesImagen(Buffer.from("esto no es una foto"))).toBeNull();
  });

  it("conserva la proporción al meter la foto en su caja", () => {
    // Una foto apaisada toca el ancho de la caja y deja alto libre.
    const apaisada = ajustarACaja({ ancho: 4000, alto: 2000 }, 3000000, 3000000);
    expect(apaisada.cx).toBe(3000000);
    expect(apaisada.cy).toBe(1500000);

    // Una vertical, al revés.
    const vertical = ajustarACaja({ ancho: 1000, alto: 2000 }, 3000000, 3000000);
    expect(vertical.cy).toBe(3000000);
    expect(vertical.cx).toBe(1500000);
  });

  it("sin dimensiones legibles usa la caja entera en vez de no poner la foto", () => {
    expect(ajustarACaja(null, 100, 200)).toEqual({ cx: 100, cy: 200 });
  });
});
