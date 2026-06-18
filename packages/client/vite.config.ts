import { defineConfig } from "vite";

export default ({ mode }: { mode: string }) => {
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;

  const proxyConfig = {
    "/.proxy/assets": {
      target: "http://localhost:5000",
      changeOrigin: true,
      ws: true,
      rewrite: (path: string) => path.replace(/^\/.proxy\/assets/, "/assets"),
    },
    "/.proxy/api": {
      target: "http://localhost:3001",
      changeOrigin: true,
      secure: false,
      ws: true,
      rewrite: (path: string) => path.replace(/^\/.proxy\/api/, ""),
    },
  };

  return defineConfig({
    envDir: "../../",
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            phaser: ["phaser"],
          },
        },
      },
    },
    optimizeDeps: {
      include: ["phaser"],
    },
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
      proxy: proxyConfig,
      hmr: replitDomain
        ? { host: replitDomain, clientPort: 443, protocol: "wss" }
        : { clientPort: 443 },
    },
    preview: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
      proxy: proxyConfig,
    },
  });
};
