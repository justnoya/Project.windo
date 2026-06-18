import { Client, Room } from 'colyseus.js';

interface ServerConfig {
  colyseusUrl: string | null;
  usingExternal: boolean;
  label: string;
}

// Cached after first resolution
let resolvedEndpoints: { httpBase: string; wsBase: string; label: string } | null = null;

function getLocalProxyBase(): string {
  return `${location.protocol}//${location.host}/.proxy/api`;
}

/** Resolve the right Colyseus endpoints.
 *  1. On localhost → direct to port 3001.
 *  2. Otherwise → ask the local server's /api/config which URL to use.
 *     The server checks EXTERNAL_SERVER_URL (GoatPanel etc.) and returns it
 *     if reachable, otherwise signals "use local proxy".
 */
export async function resolveEndpoints(): Promise<{ httpBase: string; wsBase: string; label: string }> {
  if (resolvedEndpoints) return resolvedEndpoints;

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (isLocal) {
    resolvedEndpoints = { httpBase: 'http://localhost:3001', wsBase: 'ws://localhost:3001', label: 'local' };
    return resolvedEndpoints;
  }

  const proxyBase = getLocalProxyBase();

  try {
    const res = await fetch(`${proxyBase}/config`, { signal: AbortSignal.timeout(5000) });
    const cfg = (await res.json()) as ServerConfig;

    if (cfg.colyseusUrl) {
      const url = cfg.colyseusUrl;
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

/** Quick health check using the resolved endpoints. Returns { ok, label }. */
export async function checkServerHealth(): Promise<{ ok: boolean; label: string }> {
  // Force fresh resolution each time health is checked (clears cache)
  resolvedEndpoints = null;
  try {
    const ep = await resolveEndpoints();
    const res = await fetch(`${ep.httpBase}/health`, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { ok?: boolean };
    return { ok: res.ok && data.ok === true, label: ep.label };
  } catch {
    const proxyBase = getLocalProxyBase();
    return { ok: false, label: proxyBase };
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
