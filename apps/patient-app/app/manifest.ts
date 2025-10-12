// apps/patient-app/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ambulant+ Patient",
    short_name: "Ambulant Plus",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F19",
    theme_color: "#0EA5E9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
