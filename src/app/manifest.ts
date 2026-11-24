import type { MetadataRoute } from "next";

import { SITE } from "@/config/site";
import { copy } from "@/copy/en";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.brand.name,
    short_name: copy.brand.name,
    description: copy.brand.description,
    start_url: "/",
    display: "standalone",
    background_color: SITE.backgroundColor,
    theme_color: SITE.themeColor,
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
