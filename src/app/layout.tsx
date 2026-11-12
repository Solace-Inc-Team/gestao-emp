import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "@/components/action-form";
import { Confirmador } from "@/components/confirm-dialog";
import { NavProgress } from "@/components/nav-progress";
import { AreaTransition } from "@/components/area-transition";
import { scriptTema } from "@/lib/tema";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Depósito", template: "%s | Depósito" },
  description: "Gestão de pedidos, entregas, estoque de retornáveis e acerto de caixa para distribuidoras de água e gás.",
  applicationName: "Depósito",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o script abaixo põe data-tema no <html> antes do React chegar
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <AreaTransition>{children}</AreaTransition>
        <Toaster />
        <Confirmador />
      </body>
    </html>
  );
}
