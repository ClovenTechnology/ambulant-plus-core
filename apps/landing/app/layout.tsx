import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Ambulant+ | Contactless Medicine Platform",
    template: "%s | Ambulant+",
  },
  description:
    "The world’s first fully Contactless Medicine platform. Connected devices, clinician-led care, diagnostics, fulfilment and intelligence working together.",
  openGraph: {
    title: "Ambulant+ | Contactless Medicine Platform",
    description:
      "The world’s first fully Contactless Medicine platform. Connected devices, clinician-led care, diagnostics, fulfilment and intelligence working together.",
    url: site.url,
    siteName: site.name,
    images: [
      {
        url: "/og/ambulant-og.webp",
        width: 1200,
        height: 630,
        alt: "Ambulant+ Contactless Medicine Platform",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ambulant+ | Contactless Medicine Platform",
    description:
      "Connected devices, clinician-led care, diagnostics, fulfilment and intelligence working together.",
    images: ["/og/ambulant-og.webp"],
  },
  icons: {
    icon: "/brand/ambulant-mark.png",
    apple: "/brand/ambulant-mark.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
