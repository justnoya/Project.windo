import { MonitorOptions, monitor } from "@colyseus/monitor";
import { Server } from "@colyseus/core";
import dotenv from "dotenv";
import express, { Application, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketTransport } from "@colyseus/ws-transport";
import path from "path";

import { GameRoom } from "./rooms/GameRoom";

dotenv.config({ path: "../../.env" });
dotenv.config();

const app: Application = express();
const router = express.Router();
const port: number = Number(process.env.PORT) || 3001;

const server = new Server({
  transport: new WebSocketTransport({
    server: createServer(app),
  }),
});

// Game Rooms
server
  .define("game", GameRoom)
  .filterBy(["channelId"]);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

app.use(express.json());
app.use(router);

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../../../client/dist");
  app.use(express.static(clientBuildPath));
}

// Health check
router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Runtime config — client fetches this to discover which Colyseus URL to use.
// Set EXTERNAL_SERVER_URL (non-VITE so it is never baked into the client bundle)
// to point at GoatPanel or any external Colyseus server.
// If unset or unreachable the client falls back to the local proxy.
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

  // Fall back: tell client to use the local proxy (null = use /.proxy/api)
  console.log("[config] Using local Colyseus server");
  res.json({ colyseusUrl: null, usingExternal: false, label: "local" });
});

// If you don't want people accessing your server stats, comment this line.
router.use("/colyseus", monitor(server as Partial<MonitorOptions>));

// Fetch token from developer portal and return to the embedded app
router.post("/api/token", async (req: Request, res: Response) => {
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.VITE_CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.body.code,
    }),
  });

  const { access_token } = (await response.json()) as {
    access_token: string;
  };

  res.send({ access_token });
});

// Using a flat route in dev to match the vite server proxy config
app.use(process.env.NODE_ENV === "production" ? "/.proxy/api" : "/", router);

server.listen(port).then(() => {
  console.log(`App is listening on port ${port} !`);
  const ext = process.env.EXTERNAL_SERVER_URL;
  if (ext) console.log(`External server configured: ${ext}`);
  else console.log("No EXTERNAL_SERVER_URL set — using local Colyseus only");
});
