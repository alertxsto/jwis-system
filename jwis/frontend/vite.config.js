import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";

// Build-stamp the service worker cache: public/sw.js contains __BUILD_ID__;
// replacing it with the build timestamp means every deploy ships a new
// CACHE_NAME and `activate` evicts the old one, so no user is pinned to a
// previous bundle.
function buildStampServiceWorker() {
  return {
    name: "build-stamp-sw",
    closeBundle() {
      const path = "dist/sw.js";
      const stamp = Date.now().toString(36);
      writeFileSync(path, readFileSync(path, "utf8").replaceAll("__BUILD_ID__", stamp));
    },
  };
}

export default defineConfig({
  plugins: [react(), buildStampServiceWorker()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
});
