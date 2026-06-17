import { Scene } from "phaser";
import { authorizeDiscordUser } from "../utils/discordSDK";

export class MainMenu extends Scene {
  constructor() {
    super("MainMenu");
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Black background
    this.cameras.main.setBackgroundColor(0x000000);

    // XP logo area
    const cx = W / 2;
    const cy = H / 2 - 40;

    // Colored flag squares
    const sq = 18, gap = 3;
    const fx = cx - sq - gap / 2, fy = cy - sq - gap / 2;
    this.add.rectangle(fx,        fy,        sq, sq, 0xe03418).setOrigin(0);
    this.add.rectangle(fx + sq + gap, fy,    sq, sq, 0x80c808).setOrigin(0);
    this.add.rectangle(fx,        fy + sq + gap, sq, sq, 0x0060ee).setOrigin(0);
    this.add.rectangle(fx + sq + gap, fy + sq + gap, sq, sq, 0xffd000).setOrigin(0);

    this.add.text(cx + sq + gap + 6, fy + 4, "Windows", {
      font: "italic bold 26px 'Times New Roman', serif",
      color: "#ffffff",
    }).setOrigin(0, 0);

    this.add.text(cx + sq + gap + 6, fy + 32, "XP", {
      font: "italic bold 26px 'Times New Roman', serif",
      color: "#80c0ff",
    }).setOrigin(0, 0);

    // Loading bar
    const barW = 200, barH = 6;
    const barX = cx - barW / 2, barY = cy + 60;
    this.add.rectangle(cx, barY + barH / 2, barW + 2, barH + 2, 0x444444).setOrigin(0.5);
    const bar = this.add.rectangle(barX, barY, 0, barH, 0x3a88dc).setOrigin(0, 0);

    this.add.text(cx, barY + 20, "Please wait...", {
      font: "11px Tahoma, Arial",
      color: "#cccccc",
    }).setOrigin(0.5, 0);

    // Animate loading bar while authorizing
    let progress = 0;
    const grow = this.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        progress = Math.min(progress + 0.012, 0.9);
        bar.width = barW * progress;
      }
    });

    (async () => {
      try {
        await authorizeDiscordUser();
      } catch (e) {
        console.warn("Discord auth skipped:", e);
      }
      grow.remove();
      bar.width = barW;
      this.time.delayedCall(200, () => this.scene.start("WinXPDesktop"));
    })();
  }
}
