import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ambulant+ Clinician",
    short_name: "Ambulant+ MD",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F19",
    theme_color: "#0EA5E9",
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/png" }
    ]
  };
}

