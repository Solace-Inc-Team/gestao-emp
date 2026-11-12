import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Depósito: entregas e caixa",
    short_name: "Depósito",
    start_url: "/entregador",
    display: "standalone",
    background_color: "#f4f3ee",
    theme_color: "#1745d0",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
