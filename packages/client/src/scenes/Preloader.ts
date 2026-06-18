import { Scene } from "phaser";
import { SoundManager } from "../utils/SoundManager";

export class Preloader extends Scene {
  private overlay!: HTMLDivElement;
  private segTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super("Preloader");
  }

  preload() {
    this.load.image("tws-logo", "/tws-logo.png");
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);

    this.overlay = document.createElement("div");
    this.overlay.id = "preloader-overlay";
    this.overlay.innerHTML = `
      <div class="pre-bg">
        <div class="pre-logo-wrap">
          <img class="pre-logo-img" src="/tws-logo.png" alt="The Waiting Screen" />
        </div>
        <div class="pre-title">The Waiting Screen</div>
        <div class="pre-bar-wrap">
          <div class="pre-segments" id="pre-segments"></div>
        </div>
        <div class="pre-status" id="pre-status">Loading…</div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    const container = document.getElementById("pre-segments");
    const statusEl = document.getElementById("pre-status");
    const TOTAL_SEGS = 12;
    const VISIBLE = 5;

    let offset = 0;
    if (container) {
      for (let i = 0; i < TOTAL_SEGS; i++) {
        const seg = document.createElement("div");
        seg.className = "pre-seg";
        container.appendChild(seg);
      }
      const segs = container.querySelectorAll<HTMLElement>(".pre-seg");

      const updateSegs = () => {
        segs.forEach((s, i) => {
          const pos = (i - offset + TOTAL_SEGS) % TOTAL_SEGS;
          s.style.opacity = pos < VISIBLE ? String(1 - pos * 0.15) : "0";
        });
        offset = (offset + 1) % TOTAL_SEGS;
      };

      this.segTimer = setInterval(updateSegs, 100);
    }

    SoundManager.startLoadingAmbient();

    const statuses = ["Initializing…", "Loading assets…", "Connecting servers…", "Almost there…"];
    let si = 0;
    const statusTimer = setInterval(() => {
      si = (si + 1) % statuses.length;
      if (statusEl) statusEl.textContent = statuses[si];
    }, 800);

    this.time.delayedCall(3500, () => {
      SoundManager.stopLoadingAmbient();
      if (this.segTimer) clearInterval(this.segTimer);
      clearInterval(statusTimer);
      this.overlay.style.transition = "opacity 0.6s";
      this.overlay.style.opacity = "0";
      this.time.delayedCall(600, () => {
        this.cleanup();
        this.scene.start("LoginScreen");
      });
    });
  }

  private cleanup() {
    if (this.segTimer) { clearInterval(this.segTimer); this.segTimer = null; }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }

  shutdown() {
    this.cleanup();
  }
}
