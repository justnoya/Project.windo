import { Scene } from 'phaser';
import { SoundManager } from '../utils/SoundManager';
import { gameState } from '../utils/gameState';

export class GameMenu extends Scene {
  private overlay!: HTMLDivElement;

  constructor() { super('GameMenu'); }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.overlay = document.createElement('div');
    this.overlay.id = 'gamemenu-overlay';
    document.body.appendChild(this.overlay);
    this.renderMenu();
  }

  private renderMenu() {
    this.overlay.innerHTML = `
      <div class="gm-bg">
        <div class="gm-scanlines"></div>
        <div class="gm-content">
          <div class="gm-logo-wrap">
            <img src="/miscord-icon.png" class="gm-logo-icon" alt="logo" width="64" height="64" loading="eager" />
          </div>
          <div class="gm-title-block">
            <div class="gm-title">WINDOWS <span class="gm-title-xp">XP</span></div>
            <div class="gm-subtitle">— SELECT MODE —</div>
          </div>
          <div class="gm-menu" id="gm-menu">
            <button class="gm-btn" id="gm-single" data-index="0">
              <span class="gm-btn-arrow">▶</span>
              <span class="gm-btn-label">SINGLE PLAYER</span>
              <span class="gm-btn-desc">Play alone · Offline mode</span>
            </button>
            <button class="gm-btn" id="gm-multi" data-index="1">
              <span class="gm-btn-arrow">▶</span>
              <span class="gm-btn-label">MULTIPLAYER</span>
              <span class="gm-btn-desc">2–4 players · Online with friends</span>
            </button>
          </div>
          <div class="gm-footer">Click to select · Play with friends in Discord Activity</div>
        </div>
      </div>
    `;

    document.getElementById('gm-single')?.addEventListener('click', () => {
      SoundManager.click();
      gameState.mode = 'single';
      this.transition('WinXPDesktop');
    });

    document.getElementById('gm-multi')?.addEventListener('click', () => {
      SoundManager.click();
      gameState.mode = 'multi';
      this.transition('MultiplayerLobby');
    });

    document.querySelectorAll('.gm-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => SoundManager.hover?.());
    });
  }

  private transition(scene: string) {
    const bg = this.overlay.querySelector('.gm-bg') as HTMLElement | null;
    if (bg) { bg.style.transition = 'opacity 0.4s'; bg.style.opacity = '0'; }
    this.time.delayedCall(400, () => {
      this.cleanup();
      this.scene.start(scene);
    });
  }

  private cleanup() {
    this.overlay?.parentNode?.removeChild(this.overlay);
  }

  shutdown() { this.cleanup(); }
}
