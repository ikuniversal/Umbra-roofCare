import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Umbra RoofCare",
  description:
    "Umbra RoofCare — subscription-first residential roofing CRM for HoldCo and OpCo operations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(fraunces.variable, inter.variable, plexMono.variable)}
    >
      <body className="min-h-screen bg-brand-bg font-sans text-brand-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
