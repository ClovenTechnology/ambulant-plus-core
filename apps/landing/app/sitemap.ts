import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const routes = [
  "",
  "/platform",
  "/innovation",
  "/research-and-development",
  "/patients",
  "/clinicians",
  "/careport",
  "/medreach",
  "/insightcore",
  "/clients",
  "/devices",
  "/use-cases",
  "/operations",
  "/partnerships",
  "/resources",
  "/bookings",
  "/demos",
  "/security",
  "/compliance",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/clinical-disclaimer",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${site.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/platform" ? 0.9 : 0.7,
  }));
}
