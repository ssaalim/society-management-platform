import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers/providers";

export const metadata: Metadata = {
  title: "Housive Management SaaS Platform",
  description: "Production-grade multi-tenant society management platform for India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen bg-[#030712] text-slate-100 selection:bg-slate-50 selection:text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
