import { defineConfig } from "vite";

export default ({ mode }: { mode: string }) => {
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;

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
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
      proxy: {
        "/.proxy/assets": {
          target: "http://localhost:5000",
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/.proxy\/assets/, "/assets"),
        },
        "/.proxy/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/.proxy\/api/, ""),
        },
      },
      hmr: replitDomain
        ? { host: replitDomain, clientPort: 443, protocol: "wss" }
        : { clientPort: 443 },
    },
  });
};
