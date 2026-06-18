import { Scene } from "phaser";

export class SplashScreen extends Scene {
  private overlay!: HTMLDivElement;

  constructor() {
    super("SplashScreen");
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);

    this.overlay = document.createElement("div");
    this.overlay.id = "splash-overlay";
    this.overlay.innerHTML = `
      <div class="splash-inner">
        <div class="splash-scanlines"></div>
        <div class="splash-content">
          <div class="splash-made-by">MADE BY THE DIRECTOR</div>
          <div class="splash-handle">@just.tiwari</div>
          <div class="splash-cursor">▮</div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.time.delayedCall(3200, () => {
      this.overlay.classList.add("splash-fadeout");
      this.time.delayedCall(700, () => {
        this.cleanup();
        this.scene.start("Preloader");
      });
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
