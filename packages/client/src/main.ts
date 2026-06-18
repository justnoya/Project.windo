import './winxp.css';
import { ScaleFlow } from "./utils/ScaleFlow";
import { initiateDiscordSDK } from "./utils/discordSDK";

import { Boot } from "./scenes/Boot";
import { SplashScreen } from "./scenes/SplashScreen";
import { Preloader } from "./scenes/Preloader";
import { LoginScreen } from "./scenes/LoginScreen";
import { WinXPDesktop } from "./scenes/WinXPDesktop";

(async () => {
  initiateDiscordSDK();

  new ScaleFlow({
    type: Phaser.AUTO,
    parent: "gameParent",
    width: 1280,
    height: 720,
    backgroundColor: "#000000",
    roundPixels: false,
    pixelArt: false,
    scene: [Boot, SplashScreen, Preloader, LoginScreen, WinXPDesktop],
  });
})();
