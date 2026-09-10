/**
 * Lectura del resultado de `signIn(..., { redirect: false })`.
 *
 * OJO con `ok`: en next-auth 5.0.0-beta.31 el endpoint de credenciales responde
 * HTTP 200 incluso cuando la contraseña es incorrecta — el fallo viaja dentro del
 * JSON, como `{"url": ".../login?error=CredentialsSignin"}`. Como `signIn` arma su
 * `ok` a partir de `res.ok`, un login fallido regresa `ok: true`. Confiar en `ok`
 * manda al usuario al dashboard, el middleware lo rebota al login y no se muestra
 * ningún mensaje. El único campo confiable es `error`.
 */

export type ResultadoSignIn =
  | {
      ok?: boolean;
      error?: string;
      code?: string;
      status?: number;
      url?: string | null;
    }
  | undefined;

export type LecturaLogin = { entro: true } | { entro: false; mensaje: string };

const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos.";
const MENSAJE_GENERICO = "No se pudo iniciar sesión. Intenta de nuevo en un momento.";

export function interpretarLogin(resultado: ResultadoSignIn): LecturaLogin {
  // Sin respuesta no hay sesión: nunca asumir éxito.
  if (!resultado) return { entro: false, mensaje: MENSAJE_GENERICO };

  if (resultado.error) {
    return {
      entro: false,
      mensaje:
        resultado.error === "CredentialsSignin"
          ? MENSAJE_CREDENCIALES
          : MENSAJE_GENERICO,
    };
  }

  return { entro: true };
}
