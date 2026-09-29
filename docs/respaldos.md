# Respaldos de la base de datos

Esto es lo que hay que saber para no perder los datos del programa. Está escrito
para quien llegue nuevo al servicio social y no haya visto nunca el proyecto.

## Por qué existe este documento

El plan de Supabase que usa el proyecto es el **gratuito**, y **no incluye
respaldos de ningún tipo**. Si la base se borra o se corrompe, Supabase no puede
devolverla. No hay botón de deshacer.

Ya pasó una vez: la base de producción se borró entera por accidente. Se pudo
recuperar solo porque los datos originales de 2026 seguían en `scripts/data/`,
que estaba ahí de casualidad y no como plan. Este documento existe para que la
próxima vez no dependa de la casualidad.

## Qué hay dentro de un respaldo

Nombre, apellidos, edad, escuela, grado, teléfono y correo de cada niño
inscrito, más las sesiones, las asistencias y las cuentas de acceso.

**Son datos personales de menores.** De ahí las dos reglas que siguen.

## Las dos reglas

**1. Un respaldo NUNCA se sube a GitHub.** El repositorio de este proyecto es
**público**: cualquiera en internet puede leerlo. La carpeta `respaldos/` está
en `.gitignore` justo por eso, y no hay que sacarla de ahí.

**2. Los respaldos viajan en el USB del proyecto**, que se entrega de una
generación de servicio social a la siguiente, junto con este documento.

## Hacer un respaldo

Con Node instalado y desde la carpeta del proyecto:

```bash
export $(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | xargs)
RESPALDO_CLAVE='...' npm run respaldar
```

Sin `RESPALDO_CLAVE` el respaldo sale **sin cifrar**: vale para el USB, pero
entonces ese archivo no puede subirse a ningún sitio. El script lo avisa.

Imprime a qué base se está conectando, cuántas filas saca de cada tabla, y deja
el archivo en `respaldos/pasaporte-AAAAMMDD-HHMM.json.gz`. Pesa unos pocos KB.

**Míralo antes de darlo por bueno.** Si el número de participantes es cero o
mucho menor de lo que esperas, algo salió mal y ese archivo no sirve.

Luego cópialo al USB.

## El respaldo automático

Además del manual, hay un respaldo **diario y automático** (`.github/workflows/respaldo.yml`).
Corre en GitHub, cifra el volcado y lo guarda en la rama `respaldos` de este
mismo repositorio. Se conservan los 30 más recientes.

Puede vivir en un repositorio público **porque va cifrado**: sin la clave del
proyecto es un archivo ilegible.

Para que funcione hacen falta dos secretos en GitHub
(Settings → Secrets and variables → Actions):

| Secreto | Qué es |
|---|---|
| `DATABASE_URL` | La conexión a la base (ya existe, la usa el keepalive) |
| `RESPALDO_CLAVE` | La clave que cifra los respaldos |

**`RESPALDO_CLAVE` es el punto frágil de todo esto.** Si se pierde, los
respaldos cifrados no se pueden abrir y no hay forma de recuperarlos. Por eso
vive en tres sitios: los secretos de GitHub, el USB del proyecto (`CLAVES.md`)
y el coordinador. Nunca en el repositorio.

El respaldo automático **no sustituye al del USB**: si alguien pierde el acceso
a la cuenta de GitHub, se pierde con ella. El del USB es el que sobrevive a eso.

### Cada cuánto

Como mínimo:

- **Antes de cualquier cambio grande** en la base: una migración, cargar una
  edición nueva, correr un script que borre cosas.
- **Al terminar cada edición**, cuando ya están todas las asistencias.
- **Al entregar el proyecto** a la siguiente generación.

Y si el programa está en curso, una vez por semana no sobra.

## Restaurar un respaldo

Primero el esquema, luego los datos:

```bash
export $(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | xargs)
npx prisma migrate deploy
RESPALDO_CLAVE='...' CONFIRMAR_RESTAURACION=si npm run restaurar -- respaldos/pasaporte-AAAAMMDD-HHMM.json.gz.cifrado
```

Si el archivo está cifrado y no das la clave, el script se detiene y te dice
dónde buscarla. Si la clave es equivocada o el archivo está dañado, también
falla en vez de dejar la base a medias.

El script **borra y reescribe** la base de destino, así que antes de hacer nada
te dice a dónde va a escribir y te avisa en mayúsculas si es producción. Sin la
variable `CONFIRMAR_RESTAURACION=si` se niega a continuar. Eso es a propósito:
es el paso donde se destruye algo si te equivocas de base.

El esquema no va dentro del respaldo porque lo reconstruyen las migraciones.
Por eso el `migrate deploy` va primero.

## Probar que el respaldo sirve

Un respaldo que nunca se ha restaurado es una suposición, no un respaldo.
Para comprobarlo sin tocar producción, restáuralo en la base local de pruebas:

```bash
docker start pasaporte-qa
DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
DIRECT_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://postgres:qa_local_pw@localhost:55445/pasaporte" \
CONFIRMAR_RESTAURACION=si npm run restaurar -- respaldos/<el-archivo>
```

Después compara los conteos con los de producción. Si cuadran, el respaldo sirve.

Hazlo **al menos una vez por generación**, para saber que el procedimiento
funciona antes de necesitarlo de verdad.

## Qué NO cubre esto

- **Las fotos de las sesiones** que estén en Supabase Storage. El respaldo
  guarda la referencia, no el archivo. Si se borra el bucket, las fotos no
  vuelven.
- **Las variables de entorno** de Vercel. Anótalas aparte, en el USB.
- **Las cuentas de Supabase, Vercel y GitHub**. Los accesos se traspasan
  aparte; sin ellos, los respaldos no sirven de nada.

## Lo que hay que entregar a la siguiente generación

1. El USB con los respaldos y este documento.
2. Los accesos a Supabase, Vercel y GitHub.
3. El archivo `.env` (que no está en el repositorio, a propósito).
4. El archivo `CLAVES.md` con la clave de los respaldos y los accesos.
   Hay una plantilla en `docs/CLAVES.ejemplo.md`.
5. La carpeta `scripts/data/` con los datos originales de 2026, que tampoco
   está en el repositorio y que fue lo que salvó el proyecto una vez.
