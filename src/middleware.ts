import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  const isAuthenticated = !!session;

  // Si no hay sesión, redirigir a /login
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Los archivos de /public se excluyen por extensión: sin esto, el optimizador
  // de next/image pide /cinvestav-marca.png, el middleware lo redirige a /login
  // y la respuesta HTML llega como "not a valid image" (400). El logo del login
  // desaparecería justo para quien todavía no tiene sesión.
  matcher: [
    "/((?!api/auth|login|privacidad|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?)$).*)",
  ],
};
