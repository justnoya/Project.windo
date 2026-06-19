import { Client, Room } from 'colyseus.js';

interface ServerConfig {
  colyseusUrl: string | null;
  usingExternal: boolean;
  label: string;
}

// Cached after first resolution — survives the lifetime of the page.
let resolvedEndpoints: { httpBase: string; wsBase: string; label: string } | null = null;

function getLocalProxyBase(): string {
  return `${location.protocol}//${location.host}/.proxy/api`;
}

/**
 * Resolve Colyseus endpoints. Priority order:
 *
 *  1. VITE_SERVER_URL baked in at Vercel build time (fastest — zero round-trips).
 *     Set this in Vercel → Settings → Environment Variables:
 *       VITE_SERVER_URL = https://goatpanel.duckdns.org:3002
 *
 *  2. localhost → direct to port 3001 (local dev).
 *
 *  3. Otherwise → ask the local Replit/Vercel server's /config endpoint, which
 *     probes EXTERNAL_SERVER_URL (server-side env) and returns whichever is reachable.
 */
export async function resolveEndpoints(): Promise<{ httpBase: string; wsBase: string; label: string }> {
  if (resolvedEndpoints) return resolvedEndpoints;

  // ── Priority 1: Vercel build-time env var ──────────────────────────────────
  const baked = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '');
  if (baked) {
    resolvedEndpoints = {
      httpBase: baked,
      wsBase: baked.replace(/^https/, 'wss').replace(/^http/, 'ws'),
      label: baked,
    };
    console.log(`[serverConnect] Using baked VITE_SERVER_URL: ${baked}`);
    return resolvedEndpoints;
  }

  // ── Priority 2: Local development ─────────────────────────────────────────
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isLocal) {
    resolvedEndpoints = { httpBase: 'http://localhost:3001', wsBase: 'ws://localhost:3001', label: 'local' };
    return resolvedEndpoints;
  }

  // ── Priority 3: Ask server's /config endpoint (dev/staging fallback) ───────
  const proxyBase = getLocalProxyBase();
  try {
    const res = await fetch(`${proxyBase}/config`, { signal: AbortSignal.timeout(5000) });
    const cfg = (await res.json()) as ServerConfig;

    if (cfg.colyseusUrl) {
      const url = cfg.colyseusUrl.replace(/\/$/, '');
      resolvedEndpoints = {
        httpBase: url,
        wsBase: url.replace(/^https/, 'wss').replace(/^http/, 'ws'),
        label: cfg.label ?? url,
      };
    } else {
      resolvedEndpoints = {
        httpBase: proxyBase,
        wsBase: proxyBase.replace(/^https/, 'wss').replace(/^http/, 'ws'),
        label: 'local (proxy)',
      };
    }
  } catch {
    resolvedEndpoints = {
      httpBase: proxyBase,
      wsBase: proxyBase.replace(/^https/, 'wss').replace(/^http/, 'ws'),
      label: 'local (proxy)',
    };
  }

  console.log(`[serverConnect] Using Colyseus at: ${resolvedEndpoints.httpBase}`);
  return resolvedEndpoints;
}

/** Health-check against the resolved endpoint. Clears cache so it re-probes. */
export async function checkServerHealth(): Promise<{ ok: boolean; label: string }> {
  resolvedEndpoints = null;
  try {
    const ep = await resolveEndpoints();
    const res = await fetch(`${ep.httpBase}/health`, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { ok?: boolean };
    return { ok: res.ok && data.ok === true, label: ep.label };
  } catch {
    return { ok: false, label: 'unreachable' };
  }
}

export async function joinGameRoom(): Promise<Room> {
  const { httpBase, wsBase } = await resolveEndpoints();

  const resp = await fetch(`${httpBase}/matchmake/joinOrCreate/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await resp.json() as {
    name?: string; sessionId: string; roomId: string; processId: string;
  };
  if (!resp.ok || !data.roomId) throw new Error(`Matchmake error: ${JSON.stringify(data)}`);

  const client = new Client(wsBase);
  const room: Room = await (client as any).consumeSeatReservation({
    sessionId: data.sessionId,
    room: { name: data.name ?? 'game', roomId: data.roomId, processId: data.processId },
  });
  return room;
}
