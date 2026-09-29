# Claves del proyecto — PLANTILLA

**Este archivo es un ejemplo y está vacío a propósito.**

El de verdad se llama `CLAVES.md`, está en `.gitignore`, y **no se sube nunca al
repositorio**: el de este proyecto es público.

Copia esta plantilla al USB del proyecto como `CLAVES.md`, rellénala, y entrega
una copia al coordinador. Sin esto, los respaldos cifrados son archivos
inservibles.

---

## Clave de los respaldos

```
RESPALDO_CLAVE = ________________________________
```

Es la que cifra y descifra los respaldos de la base. La misma está cargada en
GitHub como secreto (`RESPALDO_CLAVE`), que es lo que usa el respaldo
automático diario.

**Si se pierde, los respaldos cifrados no se pueden abrir. No hay forma de
recuperarlos.** Por eso vive en dos sitios: el USB y el coordinador.

Para usarla:

```bash
RESPALDO_CLAVE='...' CONFIRMAR_RESTAURACION=si npm run restaurar -- <archivo>
```

## Accesos que hay que traspasar

Un respaldo no sirve de nada si no hay dónde restaurarlo.

| Servicio | Para qué | Quién lo tiene |
|---|---|---|
| Supabase | La base de datos y las fotos | |
| Vercel | El despliegue y las variables de entorno | |
| GitHub | El código y el respaldo automático | |
| Correo del proyecto | Recuperar los tres de arriba | |

## Contenido del archivo `.env`

No está en el repositorio, a propósito. Cópialo aquí o guárdalo aparte en el USB.

```
DATABASE_URL = 
DIRECT_URL = 
AUTH_SECRET = 
NEXT_PUBLIC_SUPABASE_URL = 
SUPABASE_SERVICE_ROLE_KEY = 
```

## Cuentas de la aplicación

| Correo | Rol | Quién la usa |
|---|---|---|
| admin@cinvestav.mx | ADMIN | |
| becario@cinvestav.mx | BECARIO | |

---

**Última actualización:** ____________  ·  **Entregado por:** ____________
