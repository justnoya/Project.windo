import { Scene } from "phaser";

export class Boot extends Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    this.load.image("bliss", "/assets/bliss.jpeg");
  }

  create() {
    this.scene.start("SplashScreen");
  }
}
