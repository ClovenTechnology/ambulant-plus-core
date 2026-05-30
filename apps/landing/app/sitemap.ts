import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const routes = [
  "/",
  "/platform",
  "/features",
  "/devices",
  "/patients",
  "/patients/getting-started",
  "/centres/ladies-health",
  "/centres/paediatric",
  "/centres/antenatal",
  "/centres/gentlemens-health",
  "/clinicians",
  "/clinicians/onboarding",
  "/clients",
  "/medreach",
  "/medreach/labs",
  "/medreach/phlebotomists",
  "/careport",
  "/careport/pharmacies",
  "/careport/riders",
  "/insightcore",
  "/operations",
  "/partnerships",
  "/bookings",
  "/demos",
  "/resources",
  "/innovation",
  "/research-and-development",
  "/ecosystem",
  "/use-cases",
  "/security",
  "/compliance",
  "/clinical-disclaimer",
  "/privacy",
  "/terms",
  "/faq",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${site.url}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority:
      route === "/"
        ? 1
        : ["/features", "/patients", "/clinicians", "/clients", "/devices"].includes(route)
          ? 0.9
          : route.startsWith("/centres")
            ? 0.82
            : 0.75,
  }));
}