import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3002,
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
