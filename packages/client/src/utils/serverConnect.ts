import { Client, Room } from 'colyseus.js';

export function getServerEndpoints(): { httpBase: string; wsBase: string } {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (isLocal) {
    return { httpBase: 'http://localhost:3001', wsBase: 'ws://localhost:3001' };
  }

  // In Replit (and any proxied environment), route through the Vite proxy at /.proxy/api
  // which forwards to the local backend on port 3001.
  const externalServer = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (externalServer) {
    return {
      httpBase: externalServer,
      wsBase: externalServer.replace(/^https/, 'wss').replace(/^http/, 'ws'),
    };
  }

  const origin = location.origin;
  const proxyBase = `${origin}/.proxy/api`;
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
