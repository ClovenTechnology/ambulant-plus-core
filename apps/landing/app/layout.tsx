import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { site } from "@/lib/site";
import {
  absoluteUrl,
  coreKeywords,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

const defaultTitle = "Ambulant+ | Contactless Medicine Platform in South Africa";
const defaultDescription =
  "Ambulant+ is a Contactless Medicine platform connecting patients, clinicians, connected devices, home diagnostics, pharmacy fulfilment and preventive-care intelligence in one governed ecosystem.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: defaultTitle,
    template: "%s | Ambulant+",
  },
  description: defaultDescription,
  keywords: coreKeywords,
  applicationName: site.name,
  authors: [{ name: site.parentCompany }],
  creator: site.parentCompany,
  publisher: site.parentCompany,
  category: "Digital Health",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: site.url,
    siteName: site.name,
    images: [
      {
        url: absoluteUrl("/og/ambulant-og.webp"),
        width: 1200,
        height: 630,
        alt: "Ambulant+ Contactless Medicine platform",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [absoluteUrl("/og/ambulant-og.webp")],
  },
  icons: {
    icon: "/brand/ambulant-mark.png",
    apple: "/brand/ambulant-mark.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <JsonLd
          data={[
            organizationJsonLd(),
            websiteJsonLd(),
            softwareApplicationJsonLd(),
          ]}
        />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}