import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { APP_NAME } from "./src/appInfo";

// Served from https://<user>.github.io/board_game_timer_app/ (see ADR-0001).
const base = "/board_game_timer_app/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: APP_NAME,
        short_name: "BG Timer",
        description: "Times a board game on one phone: who plays slowly, and where the evening goes.",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#1b1b1f",
        theme_color: "#1b1b1f",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
      },
    }),
  ],
});
