import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const routes = [
  "",
  "/platform",
  "/features",
  "/innovation",
  "/research-and-development",
  "/patients",
  "/patients/getting-started",
  "/clinicians",
  "/clinicians/onboarding",
  "/careport",
  "/careport/pharmacies",
  "/careport/riders",
  "/medreach",
  "/medreach/labs",
  "/medreach/phlebotomists",
  "/insightcore",
  "/clients",
  "/devices",
  "/use-cases",
  "/operations",
  "/partnerships",
  "/resources",
  "/bookings",
  "/demos",
  "/ecosystem",
  "/security",
  "/compliance",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/clinical-disclaimer",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${site.url}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/features" ? 0.9 : 0.7,
  }));
}
