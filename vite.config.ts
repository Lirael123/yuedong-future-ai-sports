import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

// https://vitejs.dev/config/
const useLocalHttps =
  process.env.CI !== "true" &&
  process.env.NODE_ENV !== "production" &&
  fs.existsSync("./localhost+1-key.pem") &&
  fs.existsSync("./localhost+1.pem");

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      base: "/yuedong-future-ai-sports/",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "Logo1.png", "Logo2.png", "android-chrome-192x192.png", "android-chrome-512x512.png"],
      manifest: {
        name: "跃动未来 · 立定跳远教学系统",
        short_name: "跃动未来",
        description: "AI-assisted standing long jump analysis, tiered practice and progress tracking",
        theme_color: "#064e3b",
        background_color: "#1f2937",
        display: "standalone",
        scope: "/yuedong-future-ai-sports/",
        start_url: "/yuedong-future-ai-sports/",
        orientation: "portrait-primary",
        categories: ["sports", "education", "productivity"],
        icons: [
          {
            src: "/yuedong-future-ai-sports/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/yuedong-future-ai-sports/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/mediapipe-models\//,
            handler: "CacheFirst",
            options: {
              cacheName: "mediapipe-models",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(mp4|webm|mov)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "videos",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              rangeRequests: true
            }
          }
        ]
      }
    })
  ],
  base: process.env.NODE_ENV === "production" ? "/yuedong-future-ai-sports/" : "/",
  server: {
    https: useLocalHttps
      ? {
          key: fs.readFileSync("./localhost+1-key.pem"),
          cert: fs.readFileSync("./localhost+1.pem"),
        }
      : undefined,
    host: "0.0.0.0",
    port: 5173,
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    fs: {
      allow: [".."],
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false, // Disable to avoid MediaPipe source map issues
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: ["@mediapipe/tasks-vision"],
  },
});
