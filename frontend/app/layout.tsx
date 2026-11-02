import type { Metadata, Viewport } from "next";
import { Poppins, Unbounded } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "@/components/providers/Providers";

const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", weight: ["500", "600", "700", "800"], display: "swap" });
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Prayaana · AI Travel Planner for Karnataka", template: "%s · Prayaana" },
  description:
    "AI-powered personalized travel planner for Karnataka. Create tailored itineraries across Western Ghats, Hampi, Coorg, Gokarna, and wildlife reserves based on your interests, budget, and time.",
  applicationName: "Prayaana",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f5f1e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${unbounded.variable} ${poppins.variable} h-full`}>
      <body className="min-h-full antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
