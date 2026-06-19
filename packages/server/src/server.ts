import { MonitorOptions, monitor } from "@colyseus/monitor";
import { Server } from "@colyseus/core";
import dotenv from "dotenv";
import express, { Application, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketTransport } from "@colyseus/ws-transport";

import { GameRoom } from "./rooms/GameRoom";

// Load .env from monorepo root, then fall back to package-local .env
dotenv.config({ path: "../../.env" });
dotenv.config();

const PORT   = Number(process.env.PORT)   || 3001;
const IS_PROD = process.env.NODE_ENV === "production";
const START_TIME = Date.now();

// ── CORS ────────────────────────────────────────────────────────────────────
// In production, set CORS_ORIGIN to your Vercel domain (comma-separated list).
// e.g.  CORS_ORIGIN=https://your-app.vercel.app,https://discord.com
// If unset, wildcard is used (fine for development / Discord Activity proxy).
const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
  : null; // null = allow all

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin ?? "*";
  const allow  = !ALLOWED_ORIGINS || ALLOWED_ORIGINS.includes(origin) ? origin : "";

  if (allow) {
    res.setHeader("Access-Control-Allow-Origin",  allow);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (allow !== "*") res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
}

// ── Express + Colyseus setup ─────────────────────────────────────────────────
const app: Application = express();
const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", GameRoom).filterBy(["channelId"]);

app.use(corsMiddleware);
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
const router = express.Router();

// Health check — used by Pterodactyl monitoring, /config probe, GameMenu ping
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    env: IS_PROD ? "production" : "development",
  });
});

// Runtime config — tells the client which Colyseus URL to use.
// Vercel deployment should set VITE_SERVER_URL instead (baked at build time,
// zero round-trips). This endpoint is the fallback for Replit / staging.
router.get("/config", async (_req: Request, res: Response) => {
  const external = process.env.EXTERNAL_SERVER_URL?.replace(/\/$/, "");

  if (external) {
    try {
      const probe = await fetch(`${external}/health`, {
        signal: AbortSignal.timeout(3500),
      });
      if (probe.ok) {
        const data = (await probe.json()) as { ok?: boolean };
        if (data.ok) {
          console.log(`[config] External server reachable: ${external}`);
          res.json({ colyseusUrl: external, usingExternal: true, label: external });
          return;
        }
      }
    } catch (err) {
      console.warn(`[config] External server unreachable (${external}):`, (err as Error).message);
    }
  }

  console.log("[config] Using local Colyseus server");
  res.json({ colyseusUrl: null, usingExternal: false, label: "local" });
});

// Discord OAuth token exchange (used by Discord Activity SDK)
router.post("/api/token", async (req: Request, res: Response) => {
  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.VITE_CLIENT_ID     ?? "",
        client_secret: process.env.CLIENT_SECRET      ?? "",
        grant_type:    "authorization_code",
        code:          String(req.body?.code ?? ""),
      }),
    });
    const { access_token } = (await response.json()) as { access_token: string };
    res.json({ access_token });
  } catch (err) {
    console.error("[token] Exchange failed:", err);
    res.status(500).json({ error: "token_exchange_failed" });
  }
});

// Colyseus admin monitor (password-protect in production if needed)
router.use("/colyseus", monitor(gameServer as Partial<MonitorOptions>));

// Mount router — in production Vercel routes this under /.proxy/api
app.use(IS_PROD ? "/.proxy/api" : "/", router);

// ── Start ────────────────────────────────────────────────────────────────────
gameServer.listen(PORT).then(() => {
  console.log(`[server] Listening on port ${PORT} (${IS_PROD ? "production" : "development"})`);
  const ext = process.env.EXTERNAL_SERVER_URL;
  if (ext) console.log(`[server] External Colyseus URL configured: ${ext}`);
  if (process.env.CORS_ORIGIN) console.log(`[server] CORS restricted to: ${process.env.CORS_ORIGIN}`);
});

// ── Graceful shutdown (critical for Pterodactyl / PM2 / Docker) ─────────────
// Pterodactyl sends SIGTERM to stop the server. Without this handler the
// process is killed immediately and WebSocket clients get disconnected hard.
// With it we get up to 10 s to finish in-flight messages before exit.
function shutdown(signal: string) {
  console.log(`[server] ${signal} received — shutting down gracefully…`);
  gameServer.gracefullyShutdown(true);
  // Safety net: force-exit after 10 s if graceful shutdown stalls
  setTimeout(() => { console.error("[server] Forced exit after timeout"); process.exit(1); }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
