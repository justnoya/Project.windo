import { Scene } from "phaser";
import { SoundManager } from "../utils/SoundManager";

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

    this.time.delayedCall(400,  () => SoundManager.splashReveal());
    this.time.delayedCall(950,  () => SoundManager.handleReveal());

    this.time.delayedCall(1900, () => {
      this.overlay.classList.add("splash-fadeout");
      this.time.delayedCall(500, () => {
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
