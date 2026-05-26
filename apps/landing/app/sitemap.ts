import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const routes = [
  "",
  "/patients",
  "/clinicians",
  "/careport",
  "/medreach",
  "/clients",
  "/devices",
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
    priority: route === "" ? 1 : 0.7,
  }));
}
