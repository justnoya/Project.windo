import Phaser from "phaser";
import { DesktopScene } from "./scenes/DesktopScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [DesktopScene],
  input: {
    activePointers: 3,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(config);
