import { Scene } from 'phaser';
import { SoundManager } from '../utils/SoundManager';
import { gameState } from '../utils/gameState';
import { checkServerHealth } from '../utils/serverConnect';

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

  private renderMenu(statusHtml = '') {
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
          ${statusHtml ? `<div class="gm-conn-status" id="gm-conn-status">${statusHtml}</div>` : ''}
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
      this.startConnectivityCheck();
    });

    document.getElementById('gm-conn-retry')?.addEventListener('click', () => {
      SoundManager.click();
      this.startConnectivityCheck();
    });

    document.querySelectorAll('.gm-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => SoundManager.hover?.());
    });
  }

  private setStatus(html: string) {
    const existing = document.getElementById('gm-conn-status');
    if (existing) {
      existing.innerHTML = html;
    } else {
      const el = document.createElement('div');
      el.id = 'gm-conn-status';
      el.className = 'gm-conn-status';
      el.innerHTML = html;
      this.overlay.querySelector('.gm-footer')?.insertAdjacentElement('beforebegin', el);
    }
    document.getElementById('gm-conn-retry')?.addEventListener('click', () => {
      SoundManager.click();
      this.startConnectivityCheck();
    });
  }

  private setMultiBtn(disabled: boolean) {
    const btn = document.getElementById('gm-multi') as HTMLButtonElement | null;
    if (btn) btn.disabled = disabled;
  }

  private async startConnectivityCheck() {
    this.setMultiBtn(true);
    this.setStatus(`<span class="gm-conn-checking">⟳ Checking server connection…</span>`);

    const ok = await checkServerHealth();

    if (ok) {
      this.setStatus(`<span class="gm-conn-ok">✔ Server reachable — connecting…</span>`);
      this.time.delayedCall(600, () => {
        gameState.mode = 'multi';
        this.transition('MultiplayerLobby');
      });
    } else {
      this.setMultiBtn(false);
      this.setStatus(
        `<span class="gm-conn-err">✖ Could not reach server.</span>` +
        `<button class="gm-conn-retry-btn" id="gm-conn-retry">Retry</button>`
      );
    }
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
