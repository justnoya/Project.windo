import { Scene } from "phaser";
import { authorizeDiscordUser, getUserName, getUserAvatar, setDisplayName, getIsEmbedded } from "../utils/discordSDK";
import { SoundManager } from "../utils/SoundManager";

export class LoginScreen extends Scene {
  private overlay!: HTMLDivElement;

  constructor() {
    super("LoginScreen");
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.overlay = document.createElement("div");
    this.overlay.id = "login-overlay";
    document.body.appendChild(this.overlay);
    this.renderLoading();

    (async () => {
      try {
        await authorizeDiscordUser();
      } catch (e) {
        console.warn("Discord auth skipped:", e);
      }

      const isEmbedded = getIsEmbedded();
      const username = getUserName() || "";
      const avatarUrl = getUserAvatar();

      SoundManager.loginChime();

      if (isEmbedded) {
        this.renderDiscordLogin(username, avatarUrl);
      } else {
        this.renderWebLogin(username);
      }
    })();
  }

  private renderLoading() {
    this.overlay.innerHTML = `
      <div class="login-bg">
        <div class="login-loading-pulse">Loading…</div>
      </div>
    `;
  }

  // Discord mode — avatar + name from Discord, one click to begin
  private renderDiscordLogin(username: string, avatarUrl: string | null) {
    const avatarHtml = avatarUrl
      ? `<img class="login-avatar-img" src="${avatarUrl}" alt="avatar" />`
      : `<div class="login-avatar-placeholder">${(username[0] || "U").toUpperCase()}</div>`;

    this.overlay.innerHTML = `
      <div class="login-bg">
        ${this.topBarHtml("To begin, click your user name")}

        <div class="login-center">
          <div class="login-user-card" id="login-user-card" tabindex="0">
            <div class="login-avatar-wrap">${avatarHtml}</div>
            <div class="login-user-info">
              <div class="login-username">${this.esc(username || "User")}</div>
              <div class="login-subtitle">Click to log on</div>
              <button class="login-begin-btn" id="login-begin-btn">
                <span class="login-btn-arrow">▶</span> Log On
              </button>
            </div>
          </div>
        </div>

        ${this.bottomBarHtml()}
      </div>
    `;

    const begin = () => { SoundManager.loginSuccess(); this.transitionToDesktop(); };
    document.getElementById("login-user-card")?.addEventListener("click", begin);
    document.getElementById("login-begin-btn")?.addEventListener("click", (e) => { e.stopPropagation(); begin(); });
    document.getElementById("login-turnoff")?.addEventListener("click", () => window.close());
  }

  // Web / dev mode — name input, no validation, just begin
  private renderWebLogin(prefillName: string) {
    this.overlay.innerHTML = `
      <div class="login-bg">
        ${this.topBarHtml("Enter your name to begin")}

        <div class="login-center">
          <div class="login-user-card login-web-card">
            <div class="login-avatar-wrap">
              <div class="login-avatar-placeholder" id="login-av-placeholder">?</div>
            </div>
            <div class="login-user-info">
              <label class="login-name-label">Your Name</label>
              <div class="login-name-row">
                <input
                  type="text"
                  id="login-name-input"
                  class="login-name-input"
                  placeholder="Enter your name…"
                  value="${this.esc(prefillName)}"
                  maxlength="32"
                  autocomplete="off"
                  spellcheck="false"
                />
                <button class="login-begin-btn" id="login-begin-btn" title="Begin">
                  <span class="login-btn-arrow">▶</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        ${this.bottomBarHtml()}
      </div>
    `;

    const input = document.getElementById("login-name-input") as HTMLInputElement;
    const placeholder = document.getElementById("login-av-placeholder") as HTMLElement;

    // Live-update the avatar letter as they type
    input?.addEventListener("input", () => {
      const v = input.value.trim();
      placeholder.textContent = v ? v[0].toUpperCase() : "?";
    });
    if (prefillName) placeholder.textContent = prefillName[0].toUpperCase();

    const begin = () => {
      const name = input?.value.trim() || "User";
      setDisplayName(name);
      SoundManager.loginSuccess();
      this.transitionToDesktop();
    };

    document.getElementById("login-begin-btn")?.addEventListener("click", begin);
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") begin(); });
    input?.focus();

    document.getElementById("login-turnoff")?.addEventListener("click", () => window.close());
  }

  private topBarHtml(subtitle: string) {
    return `
      <div class="login-top-bar">
        <div class="login-top-left">
          <span class="login-top-title">Windows <span class="login-top-xp">XP</span></span>
        </div>
        <div class="login-top-divider"></div>
        <div class="login-top-subtitle">${subtitle}</div>
      </div>
    `;
  }

  private bottomBarHtml() {
    return `
      <div class="login-bottom-bar">
        <div class="login-bottom-actions">
          <button class="login-bottom-btn" id="login-turnoff">⏻ Turn Off Computer</button>
        </div>
        <div class="login-bottom-logo">
          <span class="login-bottom-windows">Windows</span>
          <span class="login-bottom-xp">XP</span>
        </div>
      </div>
    `;
  }

  private esc(s: string) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  private transitionToDesktop() {
    this.overlay.style.transition = "opacity 0.5s";
    this.overlay.style.opacity = "0";
    this.time.delayedCall(500, () => {
      this.cleanup();
      this.scene.start("WinXPDesktop");
    });
  }

  private cleanup() {
    if (this.overlay?.parentNode) this.overlay.parentNode.removeChild(this.overlay);
  }

  shutdown() { this.cleanup(); }
}
