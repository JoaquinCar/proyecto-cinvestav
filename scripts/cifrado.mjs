/**
 * Cifrado de los respaldos.
 *
 * Usa solo `node:crypto`, sin gpg ni openssl: los scripts tienen que funcionar
 * en la máquina de quien llegue nuevo sin pedirle que instale nada.
 *
 * AES-256-GCM con clave derivada por scrypt. GCM además autentica: si el
 * archivo viene corrupto o la clave es otra, falla al descifrar en vez de
 * devolver basura que parezca un respaldo.
 */
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

const MAGIA = Buffer.from("PASAPORTE1");   // marca de formato, 10 bytes
const SAL = 16, IV = 12, TAG = 16;
const COSTE = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function cifrar(buffer, clave) {
  const sal = randomBytes(SAL);
  const iv = randomBytes(IV);
  const k = scryptSync(clave, sal, 32, COSTE);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const datos = Buffer.concat([c.update(buffer), c.final()]);
  return Buffer.concat([MAGIA, sal, iv, c.getAuthTag(), datos]);
}

export function estaCifrado(buffer) {
  return buffer.length > MAGIA.length && buffer.subarray(0, MAGIA.length).equals(MAGIA);
}

export function descifrar(buffer, clave) {
  if (!estaCifrado(buffer)) throw new Error("El archivo no está cifrado con este formato.");
  let o = MAGIA.length;
  const sal = buffer.subarray(o, (o += SAL));
  const iv = buffer.subarray(o, (o += IV));
  const tag = buffer.subarray(o, (o += TAG));
  const d = createDecipheriv("aes-256-gcm", scryptSync(clave, sal, 32, COSTE), iv);
  d.setAuthTag(tag);
  try {
    return Buffer.concat([d.update(buffer.subarray(o)), d.final()]);
  } catch {
    throw new Error("No se pudo descifrar: la clave es incorrecta o el archivo está dañado.");
  }
}
