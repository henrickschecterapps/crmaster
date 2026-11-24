import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaManager } from "@/components/PwaManager";

const montserrat = localFont({
  src: "./fonts/montserrat-latin.woff2",
  variable: "--font-montserrat",
  weight: "300 900",
  style: "normal",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-mono",
  weight: "400 700",
  style: "normal",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0C0C0C" },
    { media: "(prefers-color-scheme: light)", color: "#F6F5F3" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title:
    "ÚLTIMO QUADRO | CRM Comercial · Fotografia Autoral & Produção Audiovisual BH",
  description:
    "A história termina. A imagem fica. CRM comercial, prospecção BH & Nova Lima, agenda 4K e portal do cliente da Último Quadro.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Último Quadro",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      data-skin="obsidian"
      data-density="comfortable"
      className={`${montserrat.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased selection:bg-[var(--accent)] selection:text-[#F5F5F5]">
        <ThemeProvider>
          {children}
          <PwaManager />
        </ThemeProvider>
      </body>
    </html>
  );
}
