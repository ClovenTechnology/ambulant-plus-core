import type { MetadataRoute } from "next";
import { absoluteUrl, seoRoutes } from "@/lib/seo";

const blogRoutes = [
  "/blog/iomt-devices-for-remote-patient-monitoring",
  "/blog/digital-stethoscope-remote-consultation",
  "/blog/medical-aid-preventive-care-remote-monitoring",
  "/blog/continuous-vitals-monitoring-chronic-care",
  "/blog/home-phlebotomy-and-lab-workflows",
  "/blog/medicine-delivery-and-prescription-adherence",
  "/blog/remote-care-urban-rural-migration",
  "/blog/live-auscultation-virtual-consultation",
  "/blog/contactless-medicine-cost-savings",
  "/blog/remote-care-saves-time",
  "/blog/contactless-medicine-infection-exposure",
  "/blog/remote-patient-monitoring-chronic-treatment-outcomes",
  "/blog/clinicians-contactless-medicine-safer-practice",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    ...seoRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...blogRoutes.map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
