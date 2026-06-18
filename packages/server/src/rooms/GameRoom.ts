import { Client, Room } from "@colyseus/core";
import { GameState } from "../schemas/GameState";

const CURSOR_COLORS = [
  '#FF4444', '#4488FF', '#44CC88', '#FFAA44',
  '#AA44FF', '#FF44AA', '#44DDFF', '#FFDD44'
];

interface NoteData {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  author: string;
  sessionId: string;
}

export class GameRoom extends Room {
  state = new GameState();
  maxClients = 25;

  private playerColors = new Map<string, string>();
  private colorIndex = 0;
  private notes = new Map<string, NoteData>();

  private getColor(client: Client): string {
    if (!this.playerColors.has(client.sessionId)) {
      this.playerColors.set(
        client.sessionId,
        CURSOR_COLORS[this.colorIndex % CURSOR_COLORS.length]
      );
      this.colorIndex++;
    }
    return this.playerColors.get(client.sessionId)!;
  }

  onCreate(_options: any): void {
    // Cursor sharing
    this.onMessage('cursor', (client: Client, data: { x: number; y: number; name: string }) => {
      this.broadcast('cursor', {
        sessionId: client.sessionId,
        x: data.x,
        y: data.y,
        name: data.name || 'Player',
        color: this.getColor(client),
      }, { except: client });
    });

    // Sticky notes
    this.onMessage('note:add', (client: Client, data: any) => {
      const note: NoteData = {
        id: String(data.id || '').slice(0, 32),
        text: String(data.text || '').slice(0, 200),
        x: Math.max(0, Number(data.x) || 100),
        y: Math.max(0, Number(data.y) || 100),
        color: this.getColor(client),
        author: String(data.author || 'Player').slice(0, 32),
        sessionId: client.sessionId,
      };
      if (!note.id || !note.text) return;
      this.notes.set(note.id, note);
      this.broadcast('note:add', note);
    });

    this.onMessage('note:move', (client: Client, data: any) => {
      const note = this.notes.get(data.id);
      if (!note || note.sessionId !== client.sessionId) return;
      note.x = Math.max(0, Number(data.x) || note.x);
      note.y = Math.max(0, Number(data.y) || note.y);
      this.broadcast('note:move', { id: note.id, x: note.x, y: note.y }, { except: client });
    });

    this.onMessage('note:delete', (client: Client, data: any) => {
      const note = this.notes.get(data.id);
      if (!note || note.sessionId !== client.sessionId) return;
      this.notes.delete(data.id);
      this.broadcast('note:delete', { id: data.id });
    });

    // Legacy
    this.onMessage('move', (_client: Client, _message: any) => { /* no-op */ });
  }

  onJoin(client: Client, _options?: any): void {
    console.log(`[GameRoom] Client joined: ${client.sessionId}`);
    // Send existing sticky notes to the newcomer
    this.notes.forEach(note => client.send('note:add', note));
  }

  onLeave(client: Client, _code?: number): void {
    console.log(`[GameRoom] Client left: ${client.sessionId}`);
    this.playerColors.delete(client.sessionId);
    this.broadcast('playerLeft', { sessionId: client.sessionId });
  }
}
