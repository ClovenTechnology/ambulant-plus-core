import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Ambulant+ | Contactless Medicine Infrastructure",
    template: "%s | Ambulant+",
  },
  description:
    "Ambulant+ is the operating layer for contactless medicine, connecting patients, clinicians, devices, home diagnostics, pharmacy fulfilment, care logistics and programme intelligence.",
  openGraph: {
    title: "Ambulant+ Contactless Medicine Infrastructure",
    description:
      "Governed digital health infrastructure for virtual care, connected clinical devices, home diagnostics, pharmacy fulfilment and care operations.",
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
