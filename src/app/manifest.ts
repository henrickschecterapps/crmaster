import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ÚLTIMO QUADRO · CRM Comercial & Estúdio 4K",
    short_name: "Último Quadro",
    description:
      "CRM Comercial, Prospecção BH & Nova Lima, Agenda de Produção e Portal do Cliente da ÚLTIMO QUADRO.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0C0C0C",
    theme_color: "#0C0C0C",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Kanban & Pipeline",
        short_name: "Kanban",
        url: "/?tab=kanban",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Agenda do Estúdio",
        short_name: "Agenda",
        url: "/?tab=agenda",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Captação Overture BH",
        short_name: "Captar BH",
        url: "/?tab=capture",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
