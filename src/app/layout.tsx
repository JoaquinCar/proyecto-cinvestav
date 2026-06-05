import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Pasaporte Científico · CINVESTAV Mérida",
    template: "%s · Pasaporte Científico",
  },
  description:
    "Plataforma de gestión del programa Pasaporte Científico — CINVESTAV Unidad Mérida",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fredoka.variable} ${nunito.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
