import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ainative",
    short_name: "ainative",
    description: "AI agent task management",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/stagent-s-64.png",
        sizes: "64x64",
        type: "image/png",
      },
    ],
  };
}
