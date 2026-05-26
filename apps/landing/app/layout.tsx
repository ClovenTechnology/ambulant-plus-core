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
    "Ambulant+ is a connected-care platform for contactless medicine, patient access, clinician workflows, pharmacy fulfilment and programme intelligence.",
  openGraph: {
    title: "Ambulant+ Contactless Medicine",
    description:
      "Connected-care infrastructure for patients, clinicians, pharmacies, delivery partners and healthcare programmes.",
    url: site.url,
    siteName: "Ambulant+",
    type: "website",
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
