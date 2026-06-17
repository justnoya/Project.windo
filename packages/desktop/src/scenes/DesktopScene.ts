import Phaser from "phaser";

interface FolderIcon {
  container: Phaser.GameObjects.Container;
  name: string;
  selected: boolean;
  lastTapTime: number;
}

interface XPWindow {
  container: Phaser.GameObjects.Container;
  name: string;
  winW: number;
  winH: number;
}

export class DesktopScene extends Phaser.Scene {
  private cursor!: Phaser.GameObjects.Graphics;
  private folders: FolderIcon[] = [];
  private openWindows: XPWindow[] = [];
  private taskbarClock!: Phaser.GameObjects.Text;
  private taskbarBtnArea!: Phaser.GameObjects.Container;
  private startMenu!: Phaser.GameObjects.Container;
  private startMenuOpen = false;
  private draggingWindow: XPWindow | null = null;
  private dragWinOffX = 0;
  private dragWinOffY = 0;
  private TASKBAR_H = 40;
  private W = 1280;
  private H = 720;

  constructor() {
    super("DesktopScene");
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.TASKBAR_H = Phaser.Math.Clamp(Math.round(this.H * 0.055), 36, 52);

    this.buildScene();
    this.createCursor();
    this.setupInput();

    this.scale.on("resize", (gs: Phaser.Structs.Size) => {
      this.W = gs.width;
      this.H = gs.height;
      this.TASKBAR_H = Phaser.Math.Clamp(Math.round(this.H * 0.055), 36, 52);
      this.children.removeAll(true);
      this.folders = [];
      this.openWindows = [];
      this.buildScene();
      this.createCursor();
    });

    this.time.addEvent({
      delay: 1000,
      callback: () => { if (this.taskbarClock) this.taskbarClock.setText(this.getClockText()); },
      loop: true,
    });
  }

  private buildScene() {
    this.drawWallpaper();
    this.createFolderIcons();
    this.createTaskbar();
    this.createStartMenu();
  }

  // ─── WALLPAPER ───────────────────────────────────────────────────────────────

  private drawWallpaper() {
    const W = this.W, H = this.H;
    const dh = H - this.TASKBAR_H;
    const g = this.add.graphics();

    // Sky gradient
    const horizonY = dh * 0.62;
    for (let i = 0; i <= horizonY; i++) {
      const t = i / horizonY;
      const r = this.lerp(45, 148, t);
      const gv = this.lerp(120, 210, t);
      const b = this.lerp(200, 248, t);
      g.fillStyle(this.rgb(r, gv, b), 1);
      g.fillRect(0, i, W, 1);
    }

    // Distant pale hills
    const distHillPts: Phaser.Geom.Point[] = [
      new Phaser.Geom.Point(0, dh),
      new Phaser.Geom.Point(0, horizonY * 0.88),
      new Phaser.Geom.Point(W * 0.12, horizonY * 0.74),
      new Phaser.Geom.Point(W * 0.28, horizonY * 0.82),
      new Phaser.Geom.Point(W * 0.42, horizonY * 0.68),
      new Phaser.Geom.Point(W * 0.58, horizonY * 0.76),
      new Phaser.Geom.Point(W * 0.72, horizonY * 0.62),
      new Phaser.Geom.Point(W * 0.85, horizonY * 0.7),
      new Phaser.Geom.Point(W, horizonY * 0.78),
      new Phaser.Geom.Point(W, dh),
    ];
    g.fillStyle(0x7abf8a, 0.55);
    g.fillPoints(distHillPts, true);

    // Green hill fill gradient
    const hillTopY = horizonY * 0.55;
    for (let i = hillTopY; i <= dh; i++) {
      const t = (i - hillTopY) / (dh - hillTopY);
      const r = this.lerp(88, 40, t);
      const gv = this.lerp(178, 110, t);
      const b = this.lerp(60, 25, t);
      g.fillStyle(this.rgb(r, gv, b), 1);
      g.fillRect(0, i, W, 1);
    }

    // Main iconic hill shape (the Bliss rolling hill)
    const hillPts: Phaser.Geom.Point[] = [
      new Phaser.Geom.Point(0, dh),
      new Phaser.Geom.Point(0, horizonY * 0.95),
      new Phaser.Geom.Point(W * 0.08, horizonY * 0.78),
      new Phaser.Geom.Point(W * 0.22, horizonY * 0.65),
      new Phaser.Geom.Point(W * 0.38, horizonY * 0.5),
      new Phaser.Geom.Point(W * 0.52, horizonY * 0.44),
      new Phaser.Geom.Point(W * 0.64, horizonY * 0.42),
      new Phaser.Geom.Point(W * 0.74, horizonY * 0.48),
      new Phaser.Geom.Point(W * 0.84, horizonY * 0.6),
      new Phaser.Geom.Point(W * 0.93, horizonY * 0.75),
      new Phaser.Geom.Point(W, horizonY * 0.9),
      new Phaser.Geom.Point(W, dh),
    ];
    g.fillStyle(0x5cb840, 1);
    g.fillPoints(hillPts, true);

    // Brighter lit top of hill
    const litPts: Phaser.Geom.Point[] = [
      new Phaser.Geom.Point(W * 0.28, dh),
      new Phaser.Geom.Point(W * 0.28, horizonY * 0.61),
      new Phaser.Geom.Point(W * 0.4, horizonY * 0.5),
      new Phaser.Geom.Point(W * 0.56, horizonY * 0.44),
      new Phaser.Geom.Point(W * 0.68, horizonY * 0.44),
      new Phaser.Geom.Point(W * 0.78, horizonY * 0.5),
      new Phaser.Geom.Point(W * 0.88, horizonY * 0.62),
      new Phaser.Geom.Point(W * 0.88, dh),
    ];
    g.fillStyle(0x72d04e, 0.5);
    g.fillPoints(litPts, true);

    // Shadow left slope
    const shadePts: Phaser.Geom.Point[] = [
      new Phaser.Geom.Point(0, dh),
      new Phaser.Geom.Point(0, horizonY * 0.93),
      new Phaser.Geom.Point(W * 0.1, horizonY * 0.76),
      new Phaser.Geom.Point(W * 0.22, horizonY * 0.64),
      new Phaser.Geom.Point(W * 0.3, horizonY * 0.58),
      new Phaser.Geom.Point(W * 0.3, dh),
    ];
    g.fillStyle(0x3d8b25, 0.45);
    g.fillPoints(shadePts, true);

    // Clouds
    this.drawClouds(g);
  }

  private drawClouds(g: Phaser.GameObjects.Graphics) {
    const W = this.W, H = this.H;
    const dh = H - this.TASKBAR_H;
    const maxY = dh * 0.62 * 0.5;

    const clouds = [
      { cx: W * 0.15, cy: maxY * 0.55, rx: W * 0.095, ry: maxY * 0.32, alpha: 0.92 },
      { cx: W * 0.18, cy: maxY * 0.3, rx: W * 0.07, ry: maxY * 0.22, alpha: 0.75 },
      { cx: W * 0.09, cy: maxY * 0.7, rx: W * 0.065, ry: maxY * 0.2, alpha: 0.7 },
      { cx: W * 0.52, cy: maxY * 0.65, rx: W * 0.11, ry: maxY * 0.3, alpha: 0.88 },
      { cx: W * 0.57, cy: maxY * 0.4, rx: W * 0.08, ry: maxY * 0.25, alpha: 0.72 },
      { cx: W * 0.47, cy: maxY * 0.78, rx: W * 0.075, ry: maxY * 0.22, alpha: 0.68 },
      { cx: W * 0.82, cy: maxY * 0.45, rx: W * 0.09, ry: maxY * 0.28, alpha: 0.85 },
      { cx: W * 0.76, cy: maxY * 0.7, rx: W * 0.07, ry: maxY * 0.22, alpha: 0.7 },
      { cx: W * 0.9, cy: maxY * 0.62, rx: W * 0.065, ry: maxY * 0.2, alpha: 0.65 },
    ];

    clouds.forEach(c => {
      // Soft shadow
      g.fillStyle(0xc8d8e8, c.alpha * 0.3);
      g.fillEllipse(c.cx + 4, c.cy + 5, c.rx * 2, c.ry * 2);
      // Main cloud
      g.fillStyle(0xfafcff, c.alpha);
      g.fillEllipse(c.cx, c.cy, c.rx * 2, c.ry * 2);
      // Bright center
      g.fillStyle(0xffffff, c.alpha * 0.6);
      g.fillEllipse(c.cx - c.rx * 0.15, c.cy - c.ry * 0.12, c.rx * 1.3, c.ry * 1.1);
    });
  }

  // ─── FOLDER ICONS ────────────────────────────────────────────────────────────

  private createFolderIcons() {
    const W = this.W, H = this.H;
    const sz = Phaser.Math.Clamp(Math.round(Math.min(W, H) * 0.07), 44, 72);
    const padX = Math.round(W * 0.022);
    const padY = Math.round(H * 0.032);
    const spacingY = sz + Math.round(H * 0.085);

    const folderNames = [
      "My Documents",
      "My Pictures",
      "My Music",
      "My Computer",
      "My Projects",
      "Recycle Bin",
    ];

    folderNames.forEach((name, i) => {
      const col = Math.floor(i / 4);
      const row = i % 4;
      const fx = padX + col * (sz + Math.round(W * 0.09)) + sz * 0.5;
      const fy = padY + row * spacingY + sz * 0.5;

      const container = this.add.container(fx, fy);

      const iconGfx = this.add.graphics();
      this.drawFolderIcon(iconGfx, sz, name === "Recycle Bin");
      container.add(iconGfx);

      const fs = Math.max(10, Math.round(sz * 0.25));
      const label = this.add.text(0, sz * 0.58, name, {
        fontFamily: "Tahoma, Arial, sans-serif",
        fontSize: `${fs}px`,
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2.5,
        align: "center",
        wordWrap: { width: sz * 2.5 },
      });
      label.setOrigin(0.5, 0);
      container.add(label);

      // Hit zone
      const hitH = sz * 0.85 + label.height + 6;
      const hitZone = this.add.graphics();
      hitZone.fillStyle(0xffffff, 0.001);
      hitZone.fillRect(-sz * 0.58, -sz * 0.08, sz * 1.16, hitH);
      hitZone.setInteractive(
        new Phaser.Geom.Rectangle(-sz * 0.58, -sz * 0.08, sz * 1.16, hitH),
        Phaser.Geom.Rectangle.Contains
      );
      container.add(hitZone);

      const folderObj: FolderIcon = { container, name, selected: false, lastTapTime: 0 };
      this.folders.push(folderObj);

      hitZone.on("pointerdown", () => this.onFolderDown(folderObj, sz));
    });
  }

  private drawFolderIcon(g: Phaser.GameObjects.Graphics, sz: number, isRecycleBin = false) {
    const ox = -sz * 0.5;
    const oy = -sz * 0.42;
    const w = sz;
    const h = sz * 0.78;

    if (isRecycleBin) {
      // Bin body
      g.fillStyle(0xd8d0c4, 1);
      g.fillRoundedRect(ox + w * 0.1, oy + h * 0.22, w * 0.8, h * 0.75, 3);
      g.fillStyle(0xb8b0a4, 1);
      g.fillRect(ox + w * 0.05, oy + h * 0.18, w * 0.9, h * 0.1);
      g.fillStyle(0xa8a09a, 1);
      g.fillRect(ox + w * 0.3, oy + h * 0.1, w * 0.4, h * 0.12);
      // Recycle arrows (simplified green)
      g.fillStyle(0x3a8c18, 1);
      const mx = ox + w * 0.5, ay = oy + h * 0.55;
      g.fillTriangle(mx, ay - h * 0.14, mx - h * 0.1, ay + h * 0.06, mx + h * 0.1, ay + h * 0.06);
      g.fillStyle(0x288a10, 1);
      g.fillTriangle(mx, ay + h * 0.22, mx - h * 0.1, ay + h * 0.02, mx + h * 0.1, ay + h * 0.02);
      g.lineStyle(1, 0x909090, 0.8);
      g.strokeRoundedRect(ox + w * 0.1, oy + h * 0.22, w * 0.8, h * 0.75, 3);
      return;
    }

    // Folder tab
    g.fillStyle(0xdd9800, 1);
    g.fillRoundedRect(ox, oy, w * 0.4, h * 0.16, 3);

    // Body gradient (multi-strip for depth)
    const strips = [0xffd700, 0xf8c800, 0xf0be00, 0xe6b400, 0xdaaa00, 0xce9e00];
    const bY = oy + h * 0.14;
    const bH = h * 0.86;
    strips.forEach((col, idx) => {
      const sy = bY + (idx / strips.length) * bH;
      const sh = bH / strips.length + 1;
      g.fillStyle(col, 1);
      if (idx === 0) g.fillRoundedRect(ox, sy, w, sh + 1, { tl: 0, tr: 4, bl: 0, br: 0 });
      else if (idx === strips.length - 1) g.fillRoundedRect(ox, sy, w, sh, { tl: 0, tr: 0, bl: 4, br: 4 });
      else g.fillRect(ox, sy, w, sh + 1);
    });

    // Highlight (top shine)
    g.fillStyle(0xfff8c0, 0.65);
    g.fillRoundedRect(ox + 2, bY + 2, w - 4, bH * 0.2, 2);

    // Border
    g.lineStyle(1, 0xb88800, 1);
    g.strokeRoundedRect(ox, bY, w, bH, { tl: 0, tr: 4, bl: 4, br: 4 });
    g.lineStyle(0.5, 0xdd9800, 0.6);
    g.strokeRoundedRect(ox, oy, w * 0.4, h * 0.16, 3);
  }

  private onFolderDown(folder: FolderIcon, sz: number) {
    const now = Date.now();
    const dblTap = now - folder.lastTapTime < 450;
    folder.lastTapTime = now;

    this.folders.forEach(f => {
      if (f !== folder && f.selected) {
        f.selected = false;
        this.applySelection(f, false, sz);
      }
    });

    if (dblTap) {
      folder.selected = false;
      this.applySelection(folder, false, sz);
      this.openWindow(folder.name);
    } else {
      folder.selected = !folder.selected;
      this.applySelection(folder, folder.selected, sz);
    }
  }

  private applySelection(folder: FolderIcon, sel: boolean, sz: number) {
    const existing = folder.container.getByName("selbox") as Phaser.GameObjects.Graphics | null;
    if (sel && !existing) {
      const box = this.add.graphics();
      box.setName("selbox");
      box.fillStyle(0x2468cc, 0.3);
      box.fillRoundedRect(-sz * 0.58, -sz * 0.08, sz * 1.16, sz * 1.1, 4);
      box.lineStyle(1, 0x66aaff, 0.7);
      box.strokeRoundedRect(-sz * 0.58, -sz * 0.08, sz * 1.16, sz * 1.1, 4);
      folder.container.addAt(box, 0);
    } else if (!sel && existing) {
      existing.destroy();
    }
  }

  // ─── WINDOWS ─────────────────────────────────────────────────────────────────

  private openWindow(name: string) {
    const W = this.W, H = this.H;
    const ww = Phaser.Math.Clamp(Math.round(W * 0.52), 320, 500);
    const wh = Phaser.Math.Clamp(Math.round(H * 0.52), 240, 360);
    const offset = this.openWindows.length * 22;
    const wx = Math.round(W / 2 - ww / 2 + offset);
    const wy = Math.round(H / 2 - wh / 2 + offset);

    const container = this.add.container(wx, wy);
    const g = this.add.graphics();
    this.drawXPWindow(g, ww, wh, name);
    container.add(g);

    // "Empty folder" text
    const et = this.add.text(ww / 2, 28 + (wh - 28) / 2, "This folder is empty", {
      fontFamily: "Tahoma, Arial, sans-serif",
      fontSize: "12px",
      color: "#666666",
    });
    et.setOrigin(0.5, 0.5);
    container.add(et);

    const winObj: XPWindow = { container, name, winW: ww, winH: wh };
    this.openWindows.push(winObj);
    this.refreshTaskbarButtons();

    // Title bar drag
    const titleDrag = this.add.graphics();
    titleDrag.fillStyle(0xffffff, 0.001);
    titleDrag.fillRect(0, 0, ww - 70, 27);
    titleDrag.setInteractive(new Phaser.Geom.Rectangle(0, 0, ww - 70, 27), Phaser.Geom.Rectangle.Contains);
    container.add(titleDrag);
    titleDrag.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      this.draggingWindow = winObj;
      this.dragWinOffX = ptr.x - container.x;
      this.dragWinOffY = ptr.y - container.y;
      this.children.bringToTop(container);
    });

    // Close hit
    const closeHit = this.add.graphics();
    closeHit.fillStyle(0xffffff, 0.001);
    closeHit.fillRect(ww - 24, 6, 18, 16);
    closeHit.setInteractive(new Phaser.Geom.Rectangle(ww - 24, 6, 18, 16), Phaser.Geom.Rectangle.Contains);
    container.add(closeHit);
    closeHit.on("pointerdown", () => {
      container.destroy();
      this.openWindows = this.openWindows.filter(w => w !== winObj);
      if (this.draggingWindow === winObj) this.draggingWindow = null;
      this.refreshTaskbarButtons();
    });
  }

  private drawXPWindow(g: Phaser.GameObjects.Graphics, ww: number, wh: number, title: string) {
    // Shadow
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(5, 5, ww, wh, 6);

    // Body
    g.fillStyle(0xece9d8, 1);
    g.fillRoundedRect(0, 0, ww, wh, 6);

    // Title bar gradient
    const th = 27;
    for (let y = 0; y < th; y++) {
      const t = y / th;
      const r = Math.round(this.lerp(80, 16, t));
      const gv = Math.round(this.lerp(145, 55, t));
      const b = Math.round(this.lerp(215, 110, t));
      g.fillStyle(this.rgb(r, gv, b), 1);
      if (y === 0) g.fillRoundedRect(0, 0, ww, 2, { tl: 6, tr: 6, bl: 0, br: 0 });
      else g.fillRect(0, y, ww, 1);
    }

    // Title shine
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(2, 1, ww - 4, th / 2, { tl: 5, tr: 5, bl: 0, br: 0 });

    // Folder icon in title
    g.fillStyle(0xffd700, 1);
    g.fillRect(7, 8, 13, 9);
    g.fillStyle(0xe8a000, 1);
    g.fillRect(7, 8, 5, 3);

    // Close button
    g.fillStyle(0xcc2020, 1);
    g.fillRoundedRect(ww - 24, 6, 18, 16, 3);
    g.lineStyle(1.5, 0xff9090, 0.7);
    g.lineBetween(ww - 21, 9, ww - 9, 19);
    g.lineBetween(ww - 9, 9, ww - 21, 19);

    // Max / Min buttons
    for (let bx = ww - 44; bx >= ww - 64; bx -= 20) {
      g.fillStyle(0x5588bb, 1);
      g.fillRoundedRect(bx, 6, 18, 16, 3);
    }
    g.lineStyle(1.5, 0xaaccee, 1);
    g.strokeRect(ww - 41, 9, 12, 10);
    g.lineBetween(ww - 60, 15, ww - 48, 15);

    // Menu bar
    g.fillStyle(0xece9d8, 1);
    g.fillRect(0, th, ww, 22);
    g.lineStyle(0.5, 0xc0b8a8, 1);
    g.lineBetween(0, th + 22, ww, th + 22);

    // Address bar
    g.fillStyle(0xffffff, 1);
    g.fillRect(4, th + 26, ww - 8, 20);
    g.lineStyle(1, 0x8888a0, 1);
    g.strokeRect(4, th + 26, ww - 8, 20);

    // Content area
    g.fillStyle(0xffffff, 1);
    g.fillRect(4, th + 50, ww - 8, wh - th - 74);
    g.lineStyle(1, 0xa0a0b0, 0.8);
    g.strokeRect(4, th + 50, ww - 8, wh - th - 74);

    // Status bar
    g.fillStyle(0xdbd5c8, 1);
    g.fillRoundedRect(0, wh - 22, ww, 22, { tl: 0, tr: 0, bl: 6, br: 6 });
    g.lineStyle(0.5, 0xb0a898, 1);
    g.lineBetween(0, wh - 22, ww, wh - 22);

    // Outer window border
    g.lineStyle(1, 0x0a2060, 1);
    g.strokeRoundedRect(0, 0, ww, wh, 6);
  }

  // ─── TASKBAR ─────────────────────────────────────────────────────────────────

  private createTaskbar() {
    const W = this.W, H = this.H;
    const tbH = this.TASKBAR_H;
    const tbY = H - tbH;

    const g = this.add.graphics();

    // Main gradient
    for (let i = 0; i < tbH; i++) {
      const t = i / tbH;
      let r: number, gv: number, b: number;
      if (t < 0.5) {
        r = Math.round(this.lerp(58, 22, t * 2));
        gv = Math.round(this.lerp(148, 82, t * 2));
        b = Math.round(this.lerp(228, 170, t * 2));
      } else {
        r = Math.round(this.lerp(22, 10, (t - 0.5) * 2));
        gv = Math.round(this.lerp(82, 48, (t - 0.5) * 2));
        b = Math.round(this.lerp(170, 136, (t - 0.5) * 2));
      }
      g.fillStyle(this.rgb(r, gv, b), 1);
      g.fillRect(0, tbY + i, W, 1);
    }
    // Top shine
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(0, tbY, W, 1);
    g.fillStyle(0xaaddff, 0.35);
    g.fillRect(0, tbY + 1, W, 1);

    // Start button
    this.createStartButton(g, tbY, tbH);

    // System tray
    this.taskbarBtnArea = this.add.container(0, 0);
    this.createSysTray(g, tbY, tbH, W);
  }

  private createStartButton(g: Phaser.GameObjects.Graphics, tbY: number, tbH: number) {
    const btnH = tbH - 4;
    const btnW = Math.round(tbH * 1.85);
    const bx = 2, by = tbY + 2;

    for (let i = 0; i < btnH; i++) {
      const t = i / btnH;
      let r: number, gv: number, b: number;
      if (t < 0.5) {
        r = Math.round(this.lerp(128, 72, t * 2));
        gv = Math.round(this.lerp(208, 170, t * 2));
        b = Math.round(this.lerp(56, 18, t * 2));
      } else {
        r = Math.round(this.lerp(72, 36, (t - 0.5) * 2));
        gv = Math.round(this.lerp(170, 120, (t - 0.5) * 2));
        b = Math.round(this.lerp(18, 6, (t - 0.5) * 2));
      }
      g.fillStyle(this.rgb(r, gv, b), 1);
      if (i === 0) g.fillRoundedRect(bx, by, btnW, 2, { tl: 12, tr: 0, bl: 12, br: 0 });
      else g.fillRect(bx, by + i, btnW, 1);
    }
    g.fillStyle(0x1a6608, 1);
    g.fillRect(bx + btnW - 3, by, 3, btnH);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(bx + 2, by + 2, btnW - 5, btnH * 0.44, { tl: 10, tr: 0, bl: 0, br: 0 });
    g.lineStyle(1, 0x184c08, 0.8);
    g.strokeRoundedRect(bx, by, btnW, btnH, { tl: 12, tr: 0, bl: 12, br: 0 });

    // XP 4-color flag
    const iconX = bx + 8, iconY = by + Math.round(btnH / 2) - 6;
    const sq = 5;
    g.fillStyle(0xff4422, 1); g.fillRect(iconX, iconY, sq, sq);
    g.fillStyle(0x44bb11, 1); g.fillRect(iconX + sq + 1, iconY, sq, sq);
    g.fillStyle(0x2244ff, 1); g.fillRect(iconX, iconY + sq + 1, sq, sq);
    g.fillStyle(0xffcc00, 1); g.fillRect(iconX + sq + 1, iconY + sq + 1, sq, sq);

    const startTxt = this.add.text(
      bx + iconX - bx + sq * 2 + 10,
      by + btnH / 2,
      "start",
      {
        fontFamily: "Franklin Gothic Medium, Tahoma, sans-serif",
        fontSize: `${Math.round(btnH * 0.44)}px`,
        fontStyle: "italic bold",
        color: "#ffffff",
        shadow: { offsetX: 1, offsetY: 1, color: "#003300", blur: 3, fill: true },
        letterSpacing: 0.5,
      }
    );
    startTxt.setOrigin(0, 0.5);

    const hitZone = this.add.graphics();
    hitZone.fillStyle(0xffffff, 0.001);
    hitZone.fillRect(bx, by, btnW, btnH);
    hitZone.setInteractive(new Phaser.Geom.Rectangle(bx, by, btnW, btnH), Phaser.Geom.Rectangle.Contains);
    hitZone.on("pointerdown", () => this.toggleStartMenu());
  }

  private createSysTray(g: Phaser.GameObjects.Graphics, tbY: number, tbH: number, W: number) {
    const trayW = Math.round(tbH * 2.5);
    const tx = W - trayW - 2;
    const by = tbY + 2;
    const th = tbH - 4;

    // Tray bg
    for (let i = 0; i < th; i++) {
      const t = i / th;
      const r = Math.round(this.lerp(14, 8, t));
      const gv = Math.round(this.lerp(56, 34, t));
      const b = Math.round(this.lerp(140, 100, t));
      g.fillStyle(this.rgb(r, gv, b), 0.85);
      g.fillRect(tx, by + i, trayW, 1);
    }
    g.lineStyle(0.5, 0x3366bb, 0.5);
    g.strokeRoundedRect(tx, by, trayW, th, 3);

    this.taskbarClock = this.add.text(tx + trayW / 2, tbY + tbH / 2, this.getClockText(), {
      fontFamily: "Tahoma, Arial, sans-serif",
      fontSize: `${Math.round(tbH * 0.31)}px`,
      color: "#ffffff",
    });
    this.taskbarClock.setOrigin(0.5, 0.5);
  }

  private refreshTaskbarButtons() {
    if (this.taskbarBtnArea) {
      this.taskbarBtnArea.removeAll(true);
    } else {
      this.taskbarBtnArea = this.add.container(0, 0);
    }

    const tbH = this.TASKBAR_H;
    const tbY = this.H - tbH;
    const startBtnW = Math.round(tbH * 1.85) + 4;
    const clockW = Math.round(tbH * 2.5) + 4;
    const available = this.W - startBtnW - clockW - 8;
    const btnW = Phaser.Math.Clamp(Math.round(available / Math.max(1, this.openWindows.length)), 80, 155);

    this.openWindows.forEach((win, idx) => {
      const bx = startBtnW + idx * (btnW + 2);
      const by = tbY + 2;
      const bh = tbH - 4;

      const g = this.add.graphics();
      for (let i = 0; i < bh; i++) {
        const t = i / bh;
        const r = Math.round(this.lerp(56, 28, t));
        const gv = Math.round(this.lerp(110, 70, t));
        const b = Math.round(this.lerp(190, 140, t));
        g.fillStyle(this.rgb(r, gv, b), 1);
        g.fillRect(bx, by + i, btnW, 1);
      }
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(bx, by, btnW, bh / 2);
      g.lineStyle(0.5, 0x5588cc, 0.7);
      g.strokeRoundedRect(bx, by, btnW, bh, 2);

      // Folder mini-icon
      g.fillStyle(0xffd700, 1);
      g.fillRect(bx + 5, by + 5, 16, 11);
      g.fillStyle(0xe8a000, 1);
      g.fillRect(bx + 5, by + 5, 7, 3);

      const labelMaxW = btnW - 26;
      const label = this.add.text(bx + 25, by + bh / 2, win.name, {
        fontFamily: "Tahoma, Arial, sans-serif",
        fontSize: `${Math.round(bh * 0.34)}px`,
        color: "#ffffff",
        fixedWidth: labelMaxW,
      });
      label.setOrigin(0, 0.5);

      const hitZone = this.add.graphics();
      hitZone.fillStyle(0xffffff, 0.001);
      hitZone.fillRect(bx, by, btnW, bh);
      hitZone.setInteractive(new Phaser.Geom.Rectangle(bx, by, btnW, bh), Phaser.Geom.Rectangle.Contains);
      hitZone.on("pointerdown", () => this.children.bringToTop(win.container));

      this.taskbarBtnArea.add([g, label, hitZone]);
    });
  }

  // ─── START MENU ──────────────────────────────────────────────────────────────

  private createStartMenu() {
    const W = this.W, H = this.H;
    const tbH = this.TASKBAR_H;
    const mw = Phaser.Math.Clamp(Math.round(W * 0.3), 240, 290);
    const mh = Phaser.Math.Clamp(Math.round(H * 0.58), 300, 420);
    const mx = 2, my = H - tbH - mh - 2;

    this.startMenu = this.add.container(mx, my);
    this.startMenu.setVisible(false);

    const g = this.add.graphics();
    this.drawStartMenu(g, mw, mh);
    this.startMenu.add(g);

    // Menu item texts & icons
    const bannerH = Math.round(mh * 0.165);
    const panelY = bannerH + 4;
    const leftW = Math.round(mw * 0.55);

    // Username
    const uname = this.add.text(72, bannerH / 2, "User", {
      fontFamily: "Tahoma, Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "13px",
      color: "#ffffff",
    });
    uname.setOrigin(0, 0.5);
    this.startMenu.add(uname);

    const items = ["My Documents", "My Pictures", "My Music", "My Computer", "Control Panel"];
    items.forEach((item, i) => {
      const iy = panelY + 8 + i * 34;
      const itemG = this.add.graphics();
      itemG.fillStyle(0xffd700, 1); itemG.fillRect(6, iy + 5, 20, 14);
      itemG.fillStyle(0xe8a000, 1); itemG.fillRect(6, iy + 5, 8, 4);
      this.startMenu.add(itemG);

      const itemTxt = this.add.text(32, iy + 12, item, {
        fontFamily: "Tahoma, Arial, sans-serif",
        fontSize: "12px",
        color: "#111111",
      });
      itemTxt.setOrigin(0, 0.5);
      this.startMenu.add(itemTxt);

      const hhit = this.add.graphics();
      hhit.fillStyle(0xffffff, 0.001);
      hhit.fillRect(0, iy, leftW, 30);
      hhit.setInteractive(new Phaser.Geom.Rectangle(0, iy, leftW, 30), Phaser.Geom.Rectangle.Contains);
      hhit.on("pointerover", () => { hhit.clear(); hhit.fillStyle(0x2060c8, 0.18); hhit.fillRect(0, iy, leftW, 30); });
      hhit.on("pointerout", () => { hhit.clear(); hhit.fillStyle(0xffffff, 0.001); hhit.fillRect(0, iy, leftW, 30); });
      this.startMenu.add(hhit);
    });

    const logoff = this.add.text(52, mh - 20, "Log Off", {
      fontFamily: "Tahoma, Arial, sans-serif", fontSize: "11px", color: "#ffffff"
    });
    logoff.setOrigin(0.5, 0.5);
    this.startMenu.add(logoff);
    const turnoff = this.add.text(mw - 52, mh - 20, "Turn Off", {
      fontFamily: "Tahoma, Arial, sans-serif", fontSize: "11px", color: "#ffffff"
    });
    turnoff.setOrigin(0.5, 0.5);
    this.startMenu.add(turnoff);
  }

  private drawStartMenu(g: Phaser.GameObjects.Graphics, mw: number, mh: number) {
    const bannerH = Math.round(mh * 0.165);
    const leftW = Math.round(mw * 0.55);
    const panelH = mh - bannerH - 38;
    const panelY = bannerH + 4;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(4, 4, mw, mh, 7);

    // Body
    g.fillStyle(0xece9d8, 1);
    g.fillRoundedRect(0, 0, mw, mh, 7);

    // Banner
    for (let i = 0; i < bannerH; i++) {
      const t = i / bannerH;
      const r = Math.round(this.lerp(22, 18, t));
      const gv = Math.round(this.lerp(82, 60, t));
      const b = Math.round(this.lerp(175, 155, t));
      g.fillStyle(this.rgb(r, gv, b), 1);
      if (i === 0) g.fillRoundedRect(0, 0, mw, 2, { tl: 7, tr: 7, bl: 0, br: 0 });
      else g.fillRect(0, i, mw, 1);
    }

    // Avatar circle
    g.fillStyle(0x3a6ec0, 1);
    g.fillCircle(38, bannerH / 2, 22);
    g.lineStyle(2, 0xaaccff, 0.8);
    g.strokeCircle(38, bannerH / 2, 22);
    g.fillStyle(0xffee88, 1);
    g.fillCircle(38, bannerH / 2, 17);
    g.fillStyle(0x443300, 1);
    g.fillCircle(34, bannerH / 2 - 3, 2);
    g.fillCircle(42, bannerH / 2 - 3, 2);
    g.lineStyle(2, 0x443300, 1);
    g.beginPath();
    g.arc(38, bannerH / 2 + 1, 8, 0.25, Math.PI - 0.25);
    g.strokePath();

    // Left panel (white)
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, panelY, leftW, panelH);

    // Right panel (light blue gradient)
    for (let i = 0; i < panelH; i++) {
      const t = i / panelH;
      const r = Math.round(this.lerp(185, 145, t));
      const gv = Math.round(this.lerp(210, 180, t));
      const b = Math.round(this.lerp(252, 235, t));
      g.fillStyle(this.rgb(r, gv, b), 1);
      g.fillRect(leftW, panelY + i, mw - leftW, 1);
    }

    // Bottom bar
    for (let i = 0; i < 36; i++) {
      const t = i / 36;
      const r = Math.round(this.lerp(14, 10, t));
      const gv = Math.round(this.lerp(60, 44, t));
      const b = Math.round(this.lerp(155, 130, t));
      g.fillStyle(this.rgb(r, gv, b), 1);
      g.fillRect(0, mh - 36 + i, mw, 1);
    }
    g.fillRoundedRect(0, mh - 36, mw, 36, { tl: 0, tr: 0, bl: 7, br: 7 });

    // Log off / Turn off buttons
    g.fillStyle(0x1844a8, 1);
    g.fillRoundedRect(6, mh - 30, 92, 22, 11);
    g.lineStyle(1, 0x6688cc, 0.8);
    g.strokeRoundedRect(6, mh - 30, 92, 22, 11);

    g.fillStyle(0x1844a8, 1);
    g.fillRoundedRect(mw - 98, mh - 30, 92, 22, 11);
    g.lineStyle(1, 0x6688cc, 0.8);
    g.strokeRoundedRect(mw - 98, mh - 30, 92, 22, 11);

    // Dividers
    g.lineStyle(0.5, 0x0a2060, 0.4);
    g.lineBetween(0, bannerH, mw, bannerH);
    g.lineStyle(0.5, 0x8090aa, 0.4);
    g.lineBetween(leftW, panelY, leftW, panelY + panelH);

    // Outer border
    g.lineStyle(1, 0x0a2060, 1);
    g.strokeRoundedRect(0, 0, mw, mh, 7);
  }

  private toggleStartMenu() {
    this.startMenuOpen = !this.startMenuOpen;
    this.startMenu.setVisible(this.startMenuOpen);
    if (this.startMenuOpen) this.children.bringToTop(this.startMenu);
  }

  // ─── CURSOR ──────────────────────────────────────────────────────────────────

  private createCursor() {
    this.cursor = this.add.graphics();
    this.drawArrowCursor();
    this.cursor.setDepth(9999);
    this.input.setDefaultCursor("none");
    document.body.style.cursor = "none";
  }

  private drawArrowCursor() {
    const g = this.cursor;
    g.clear();

    // Classic Windows arrow - pointing top-left
    const pts = [
      new Phaser.Geom.Point(1, 1),
      new Phaser.Geom.Point(1, 19),
      new Phaser.Geom.Point(4, 14),
      new Phaser.Geom.Point(8, 21),
      new Phaser.Geom.Point(10, 20),
      new Phaser.Geom.Point(7, 13),
      new Phaser.Geom.Point(12, 13),
    ];

    // Black outline (draw offset copies)
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
    g.fillStyle(0x000000, 1);
    offsets.forEach(([dx, dy]) => {
      g.fillPoints(pts.map(p => new Phaser.Geom.Point(p.x + dx, p.y + dy)), true);
    });

    // White fill
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts, true);
  }

  // ─── INPUT ───────────────────────────────────────────────────────────────────

  private setupInput() {
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      this.cursor.x = ptr.x;
      this.cursor.y = ptr.y;
      this.cursor.setDepth(9999);

      if (this.draggingWindow && ptr.isDown) {
        const nx = ptr.x - this.dragWinOffX;
        const ny = Phaser.Math.Clamp(
          ptr.y - this.dragWinOffY,
          0,
          this.H - this.TASKBAR_H - (this.draggingWindow.winH || 200)
        );
        this.draggingWindow.container.x = nx;
        this.draggingWindow.container.y = ny;
      }
    });

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      this.cursor.x = ptr.x;
      this.cursor.y = ptr.y;
      this.cursor.setDepth(9999);

      // Close start menu on outside click
      if (this.startMenuOpen) {
        const sm = this.startMenu;
        const smBounds = sm.getBounds();
        if (!smBounds.contains(ptr.x, ptr.y) && !(ptr.y > this.H - this.TASKBAR_H && ptr.x < Math.round(this.TASKBAR_H * 1.85) + 4)) {
          this.toggleStartMenu();
        }
      }
    });

    this.input.on("pointerup", () => {
      this.draggingWindow = null;
    });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private rgb(r: number, g: number, b: number): number {
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  private getClockText(): string {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  update() {
    this.cursor.setDepth(9999);
  }
}
