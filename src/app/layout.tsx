import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const barlowCond = Barlow_Condensed({ variable: "--font-barlow-cond", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Depósito", template: "%s | Depósito" },
  description: "Gestão de pedidos, entregas, estoque de retornáveis e acerto de caixa para distribuidoras de água e gás.",
  applicationName: "Depósito",
};

export const viewport: Viewport = { themeColor: "#13233f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCond.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
