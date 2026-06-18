import { Scene } from 'phaser';
import { SoundManager } from '../utils/SoundManager';
import { gameState } from '../utils/gameState';
import { getUserName } from '../utils/discordSDK';
import { joinGameRoom } from '../utils/serverConnect';
import { Room } from 'colyseus.js';

interface LobbyPlayer { name: string; color: string; }

export class MultiplayerLobby extends Scene {
  private overlay!: HTMLDivElement;
  private otherPlayers = new Map<string, LobbyPlayer>();
  private myName = '';
  private room: Room | null = null;
  private connecting = false;

  constructor() { super('MultiplayerLobby'); }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.myName = getUserName() || 'Player';
    this.overlay = document.createElement('div');
    this.overlay.id = 'lobby-overlay';
    document.body.appendChild(this.overlay);
    this.renderLobby('Connecting to server…');
    this.connectToServer();
  }

  private get totalPlayers() { return 1 + this.otherPlayers.size; }

  private renderLobby(statusOverride?: string) {
    const others = Array.from(this.otherPlayers.values());
    const total = this.totalPlayers;
    const canStart = total >= 2 && total <= 4;

    const slotData: Array<{ name: string; filled: boolean; isMe: boolean }> = [
      { name: this.myName, filled: true, isMe: true },
      ...Array.from({ length: 3 }, (_, i) => ({
        name: others[i]?.name ?? '',
        filled: !!others[i],
        isMe: false,
      })),
    ];

    const slotsHtml = slotData.map((slot, i) => `
      <div class="lobby-slot ${slot.filled ? 'lobby-slot-filled' : 'lobby-slot-empty'}">
        <div class="lobby-slot-num">${i + 1}</div>
        <div class="lobby-pc-wrap">
          <img src="/pc-slot.png" class="lobby-pc-img" alt="PC slot" width="96" height="96" loading="eager" />
          ${slot.filled ? '<div class="lobby-pc-online"></div>' : ''}
        </div>
        <div class="lobby-slot-name ${slot.isMe ? 'lobby-slot-me' : ''}">
          ${slot.filled ? '@' + slot.name : '· · ·'}
        </div>
      </div>
    `).join('');

    const statusText = statusOverride ?? (
      canStart
        ? `${total} / 4 players connected — Ready to start!`
        : `Waiting for players… (${total} / 4) — Need at least 2`
    );

    this.overlay.innerHTML = `
      <div class="lobby-bg">
        <div class="lobby-scanlines"></div>
        <div class="lobby-content">
          <h1 class="lobby-title">Multiplayer</h1>
          <div class="lobby-status" id="lobby-status">${statusText}</div>
          <div class="lobby-grid" id="lobby-grid">
            ${slotsHtml}
          </div>
          <div class="lobby-actions">
            <button class="lobby-back-btn" id="lobby-back">← Back</button>
            <button
              class="lobby-start-btn${canStart ? '' : ' lobby-start-disabled'}"
              id="lobby-start"
              ${canStart ? '' : 'disabled'}
            >
              ${canStart ? '▶ START GAME' : '⏳ WAITING FOR PLAYERS…'}
            </button>
          </div>
          <div class="lobby-footer">Minimum 2 · Maximum 4 players</div>
        </div>
      </div>
    `;

    document.getElementById('lobby-back')?.addEventListener('click', () => {
      SoundManager.click();
      if (this.room) { try { this.room.leave(); } catch (_) {} }
      gameState.room = null;
      this.cleanup();
      this.scene.start('GameMenu');
    });

    document.getElementById('lobby-start')?.addEventListener('click', () => {
      if (!canStart || !this.room) return;
      SoundManager.loginSuccess?.();
      this.startGame();
    });
  }

  private async connectToServer() {
    if (this.connecting) return;
    this.connecting = true;
    try {
      const room = await joinGameRoom();
      this.room = room;
      gameState.room = room;

      room.onMessage('presence', (d: { sessionId: string; name: string; color: string }) => {
        if (this.otherPlayers.size < 3) {
          this.otherPlayers.set(d.sessionId, { name: d.name, color: d.color });
          this.renderLobby();
        }
      });

      room.onMessage('playerLeft', (d: { sessionId: string }) => {
        this.otherPlayers.delete(d.sessionId);
        this.renderLobby();
      });

      room.send('presence', { name: this.myName });
      this.renderLobby();

    } catch (err) {
      console.warn('[Lobby] Connection failed:', err);
      this.renderLobby('⚠ Could not connect to server. Start anyway or go back.');
    }
    this.connecting = false;
  }

  private startGame() {
    const bg = this.overlay.querySelector('.lobby-bg') as HTMLElement | null;
    if (bg) { bg.style.transition = 'opacity 0.4s'; bg.style.opacity = '0'; }
    this.time.delayedCall(400, () => {
      this.cleanup();
      this.scene.start('WinXPDesktop');
    });
  }

  private cleanup() {
    this.overlay?.parentNode?.removeChild(this.overlay);
  }

  shutdown() { this.cleanup(); }
}
