import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Dancing_Script, Nunito, Playfair_Display } from "next/font/google";

import { SITE } from "@/config/site";
import { copy } from "@/copy/en";
import { publicEnv } from "@/lib/env.public";

import "./globals.css";

const ui = Nunito({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const script = Dancing_Script({
  variable: "--font-dancing",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Second display face for the "serif_modern" typography option. Not preloaded:
// the browser only fetches it when an invite actually uses it.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  applicationName: copy.brand.name,
  title: { default: `${copy.brand.name} · ${copy.brand.tagline}`, template: `%s · ${copy.brand.name}` },
  description: copy.brand.description,
  appleWebApp: { capable: true, title: copy.brand.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: SITE.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${cormorant.variable} ${playfair.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
