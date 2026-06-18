import { Scene } from "phaser";

export class Boot extends Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    this.load.setPath("/.proxy/assets");
    this.load.image("bliss", "bliss.jpeg");
  }

  create() {
    this.scene.start("SplashScreen");
  }
}
