import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("node_modules/d3") ? "d3" : undefined)
      }
    }
  }
});


