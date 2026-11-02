import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prayaana · AI Travel Planner for Karnataka",
    short_name: "Prayaana",
    description: "AI-powered personalized travel itineraries for Karnataka.",
    start_url: "/discover",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#1c1b2b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
