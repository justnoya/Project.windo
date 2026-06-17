import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
  },
  resolve: {
    alias: {
      "@assets": "/public/assets",
    },
  },
});
