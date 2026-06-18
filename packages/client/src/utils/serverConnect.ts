import { Client, Room } from 'colyseus.js';

export async function checkServerHealth(): Promise<boolean> {
  try {
    const { httpBase } = getServerEndpoints();
    const res = await fetch(`${httpBase}/health`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json() as { ok?: boolean };
    return res.ok && data.ok === true;
  } catch {
    return false;
  }
}

export function getServerEndpoints(): { httpBase: string; wsBase: string } {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (isLocal) {
    return { httpBase: 'http://localhost:3001', wsBase: 'ws://localhost:3001' };
  }

  // Always route through the Vite proxy (/.proxy/api → localhost:3001)
  // when not running directly on localhost.
  const proxyBase = `${location.protocol}//${location.host}/.proxy/api`;
  const wsProxyBase = proxyBase.replace(/^https/, 'wss').replace(/^http/, 'ws');
  return { httpBase: proxyBase, wsBase: wsProxyBase };
}

export async function joinGameRoom(): Promise<Room> {
  const { httpBase, wsBase } = getServerEndpoints();

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
