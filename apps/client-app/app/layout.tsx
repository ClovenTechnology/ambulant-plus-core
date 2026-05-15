import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Ambulant+ Client Console",
  description: "Client Coverage and Settlement Console for Ambulant+",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, Arial, sans-serif",
          background: "#0b1020",
          color: "#e8ecf3",
        }}
      >
        {children}
      </body>
    </html>
  );
}