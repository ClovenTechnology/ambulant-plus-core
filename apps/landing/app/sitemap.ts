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
  "/blog/contactless-medicine-pandemic-resilience",
  "/blog/remote-patient-monitoring-chronic-treatment-outcomes",
  "/blog/clinicians-contactless-medicine-safer-practice",
  "/blog/telemedicine-alone-not-enough-chronic-care",
  "/blog/remote-monitoring-hypertension-beyond-blood-pressure",
  "/blog/reducing-avoidable-claims-through-early-intervention",
  "/blog/medication-adherence-hidden-cost-driver",
  "/blog/corporate-wellness-clinical-prevention",
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
