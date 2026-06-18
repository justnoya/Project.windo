import { Client, Room } from 'colyseus.js';

const PRODUCTION_SERVER = import.meta.env.VITE_SERVER_URL || 'http://goatpanel.duckdns.org:3002';

export function getServerEndpoints(): { httpBase: string; wsBase: string } {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (isLocal) {
    return { httpBase: 'http://localhost:3001', wsBase: 'ws://localhost:3001' };
  }

  return {
    httpBase: PRODUCTION_SERVER,
    wsBase: PRODUCTION_SERVER.replace(/^https/, 'wss').replace(/^http/, 'ws'),
  };
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
