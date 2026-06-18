import { Scene } from "phaser";
import { authorizeDiscordUser, getUserName, getUserId, getIsEmbedded } from "../utils/discordSDK";

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
      if (!isEmbedded) {
        this.time.delayedCall(600, () => {
          this.transitionToDesktop();
        });
        return;
      }

      const username = getUserName() || "User";
      const userId = getUserId() || "";
      this.renderLoginScreen(username, userId);
    })();
  }

  private renderLoading() {
    this.overlay.innerHTML = `
      <div class="login-bg">
        <div class="login-loading-pulse">Loading…</div>
      </div>
    `;
  }

  private renderLoginScreen(username: string, userId: string) {
    this.overlay.innerHTML = `
      <div class="login-bg">
        <div class="login-top-bar">
          <div class="login-top-left">
            <span class="login-top-title">Windows <span class="login-top-xp">XP</span></span>
          </div>
          <div class="login-top-divider"></div>
          <div class="login-top-subtitle">To begin, click your user name</div>
        </div>

        <div class="login-center">
          <div class="login-user-card" id="login-user-card">
            <div class="login-avatar">
              <span class="login-avatar-icon">👤</span>
            </div>
            <div class="login-user-info">
              <div class="login-username">${username}</div>
              <div class="login-password-row" id="login-password-row" style="display:none;">
                <input
                  type="password"
                  id="login-password-input"
                  class="login-password-input"
                  placeholder="Type your user ID"
                  autocomplete="off"
                  maxlength="64"
                />
                <button class="login-arrow-btn" id="login-arrow-btn" title="Log On">▶</button>
                <div class="login-hint">Password hint: your Discord User ID</div>
              </div>
              <div class="login-error" id="login-error" style="display:none;">Incorrect password. Try again.</div>
            </div>
          </div>
        </div>

        <div class="login-bottom-bar">
          <div class="login-bottom-actions">
            <button class="login-bottom-btn" id="login-turnoff">⏻ Turn Off Computer</button>
          </div>
          <div class="login-bottom-logo">
            <span class="login-bottom-windows">Windows</span>
            <span class="login-bottom-xp">XP</span>
          </div>
        </div>
      </div>
    `;

    const card = document.getElementById("login-user-card");
    const passwordRow = document.getElementById("login-password-row") as HTMLElement;
    const input = document.getElementById("login-password-input") as HTMLInputElement;
    const arrowBtn = document.getElementById("login-arrow-btn");
    const errorEl = document.getElementById("login-error") as HTMLElement;
    const turnOff = document.getElementById("login-turnoff");

    let expanded = false;

    card?.addEventListener("click", (e) => {
      if (!expanded) {
        expanded = true;
        passwordRow.style.display = "flex";
        input?.focus();
      }
    });

    const tryLogin = () => {
      const entered = input?.value.trim() || "";
      if (entered === userId || entered === "") {
        errorEl.style.display = "none";
        this.transitionToDesktop();
      } else {
        errorEl.style.display = "block";
        input.value = "";
        input.classList.add("login-shake");
        setTimeout(() => input.classList.remove("login-shake"), 500);
      }
    };

    arrowBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      tryLogin();
    });

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryLogin();
      errorEl.style.display = "none";
    });

    turnOff?.addEventListener("click", () => {
      window.close();
    });
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
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }

  shutdown() {
    this.cleanup();
  }
}
