import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["card-icon.svg"],
      manifest: {
        name: "PunchReader",
        short_name: "PunchReader",
        description: "Offline mobile reader for 80-column computer punch cards.",
        theme_color: "#11645f",
        background_color: "#f6faf8",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          {
            src: `${base}card-icon.svg`,
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,wasm,jpg}"],
        maximumFileSizeToCacheInBytes: 13 * 1024 * 1024
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 12000
  },
  optimizeDeps: {
    exclude: ["@techstark/opencv-js"]
  }
});
