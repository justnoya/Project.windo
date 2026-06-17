import { Scene } from "phaser";

export class Preloader extends Scene {
  constructor() {
    super("Preloader");
  }

  init() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Show bliss image behind loading bar
    if (this.textures.exists("bliss")) {
      const bg = this.add.image(W / 2, H / 2, "bliss");
      const s = Math.max(W / bg.width, H / bg.height);
      bg.setScale(s).setScrollFactor(0);
    }

    // XP-style progress bar
    this.add.rectangle(W / 2, H * 0.85, 302, 14).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(W / 2 - 148, H * 0.85, 4, 10, 0x3a88dc).setOrigin(0, 0.5);

    this.load.on("progress", (p: number) => {
      bar.width = 4 + 292 * p;
    });
  }

  preload() {
    // No additional assets to preload — icons are inline SVG, bliss loaded in Boot
  }

  create() {
    this.scene.start("MainMenu");
  }
}
