import { Client, Room } from "@colyseus/core";
import { GameState } from "../schemas/GameState";

const CURSOR_COLORS = [
  '#FF4444', '#4488FF', '#44CC88', '#FFAA44',
  '#AA44FF', '#FF44AA', '#44DDFF', '#FFDD44'
];

export class GameRoom extends Room {
  state = new GameState();
  maxClients = 25;

  private playerColors = new Map<string, string>();
  private colorIndex = 0;

  onCreate(_options: any): void {
    // Cursor sharing: broadcast to all other players
    this.onMessage('cursor', (client: Client, data: { x: number; y: number; name: string }) => {
      if (!this.playerColors.has(client.sessionId)) {
        this.playerColors.set(client.sessionId, CURSOR_COLORS[this.colorIndex % CURSOR_COLORS.length]);
        this.colorIndex++;
      }
      this.broadcast('cursor', {
        sessionId: client.sessionId,
        x: data.x,
        y: data.y,
        name: data.name || 'Player',
        color: this.playerColors.get(client.sessionId),
      }, { except: client });
    });

    // Legacy move handler (kept for compatibility)
    this.onMessage('move', (_client: Client, _message: any) => {
      // no-op — desktop doesn't use draggables
    });
  }

  onJoin(client: Client, _options?: any): void {
    console.log(`[GameRoom] Client joined: ${client.sessionId}`);
  }

  onLeave(client: Client, _code?: number): void {
    console.log(`[GameRoom] Client left: ${client.sessionId}`);
    this.playerColors.delete(client.sessionId);
    this.broadcast('playerLeft', { sessionId: client.sessionId });
  }
}
