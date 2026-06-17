import { Scene } from "phaser";
import { Room, Client } from "colyseus.js";
import { getUserName } from "../utils/discordSDK";
import { VirtualFileSystem } from "../fileSystem";
import { FileExplorer } from "../FileExplorer";
import * as Icons from "../XPIcons";

interface WinState {
  el: HTMLElement;
  titlebar: HTMLElement;
  minimized: boolean;
  maximized: boolean;
  prev?: { left: string; top: string; width: string; height: string };
}

const CURSOR_COLORS = ['#FF4444','#4488FF','#44CC88','#FFAA44','#AA44FF','#FF44AA','#44DDFF','#FFDD44'];

export class WinXPDesktop extends Scene {
  private bg!: Phaser.GameObjects.Image;
  private overlay!: HTMLDivElement;
  private fs!: VirtualFileSystem;
  private room: Room | null = null;
  private wins = new Map<string, WinState>();
  private explorers = new Map<string, FileExplorer>();
  private tbBtns = new Map<string, HTMLElement>();
  private pCursors = new Map<string, HTMLElement>();
  private zTop = 100;
  private clockTick: ReturnType<typeof setInterval> | null = null;
  private lastCurSend = 0;
  private userName = 'User';

  constructor() { super('WinXPDesktop'); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // ── Phaser background ───────────────────────────────────────────────────────
    if (this.textures.exists('bliss')) {
      this.bg = this.add.image(W / 2, H / 2, 'bliss').setDisplaySize(W, H);
    } else {
      this.cameras.main.setBackgroundColor(0x3C8820);
    }

    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      if (this.bg) { this.bg.setPosition(gs.width / 2, gs.height / 2).setDisplaySize(gs.width, gs.height); }
    }, this);

    // ── DOM overlay ─────────────────────────────────────────────────────────────
    this.overlay = document.createElement('div');
    this.overlay.className = 'xp-overlay';
    document.getElementById('gameParent')!.appendChild(this.overlay);

    // ── Virtual FS ──────────────────────────────────────────────────────────────
    this.fs = new VirtualFileSystem();
    this.userName = getUserName() || 'User';

    // ── Build UI ────────────────────────────────────────────────────────────────
    this.buildDesktopIcons();
    this.buildTaskbar();
    this.buildStartMenu();
    this.wireGlobalEvents();

    // ── Multiplayer ─────────────────────────────────────────────────────────────
    this.connectServer();

    // ── Cleanup ─────────────────────────────────────────────────────────────────
    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DESKTOP ICONS
  // ════════════════════════════════════════════════════════════════════════════
  private buildDesktopIcons() {
    const area = this.div('xp-desktop-icons');
    this.overlay.appendChild(area);
    area.appendChild(this.makeDesktopIcon('My Computer', Icons.mycomputer, () => this.openExplorer('root')));
  }

  private makeDesktopIcon(label: string, svg: string, onOpen: () => void): HTMLElement {
    const d = this.div('xp-icon');
    d.innerHTML = `<svg viewBox="0 0 48 48">${svg}</svg><span class="xp-icon-label">${label}</span>`;
    let lastTap = 0;
    d.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const now = Date.now();
      this.overlay.querySelectorAll('.xp-icon').forEach(el => el.classList.remove('selected'));
      d.classList.add('selected');
      if (now - lastTap < 420) onOpen();
      lastTap = now;
    });
    return d;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TASKBAR
  // ════════════════════════════════════════════════════════════════════════════
  private buildTaskbar() {
    const tb = this.div('xp-taskbar');
    this.overlay.appendChild(tb);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.className = 'xp-start-btn';
    startBtn.innerHTML = `<svg viewBox="0 0 22 22">${Icons.xpFlag}</svg>start`;
    startBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleStartMenu(); });
    tb.appendChild(startBtn);

    // Programs area
    const progs = this.div('xp-programs');
    progs.id = 'xp-programs';
    tb.appendChild(progs);

    // Tray + clock
    const tray = this.div('xp-tray');
    const clk = this.div('xp-clock');
    clk.id = 'xp-clock';
    tray.appendChild(clk);
    tb.appendChild(tray);

    this.updateClock();
    this.clockTick = setInterval(() => this.updateClock(), 10_000);
  }

  private updateClock() {
    const el = document.getElementById('xp-clock');
    if (!el) return;
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    el.textContent = `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // START MENU
  // ════════════════════════════════════════════════════════════════════════════
  private buildStartMenu() {
    const initial = (this.userName[0] || 'U').toUpperCase();
    const sm = this.div('xp-start-menu');
    sm.id = 'xp-start-menu';
    sm.innerHTML = `
      <div class="xp-sm-header">
        <div class="xp-sm-avatar">${initial}</div>
        <div class="xp-sm-username">${this.escHtml(this.userName)}</div>
      </div>
      <div class="xp-sm-body">
        <div class="xp-sm-left">
          <div class="xp-sm-item" id="sm-comp">
            <svg viewBox="0 0 48 48">${Icons.mycomputer}</svg>
            <div><b>My Computer</b><span class="xp-sm-sub">Browse all files &amp; folders</span></div>
          </div>
          <div class="xp-sm-sep"></div>
          <div class="xp-sm-item" id="sm-docs">
            <svg viewBox="0 0 48 48">${Icons.folderOpen}</svg>
            <div>My Documents</div>
          </div>
          <div class="xp-sm-item" id="sm-pics">
            <svg viewBox="0 0 48 48">${Icons.folderOpen}</svg>
            <div>My Pictures</div>
          </div>
          <div class="xp-sm-item" id="sm-music">
            <svg viewBox="0 0 48 48">${Icons.folderOpen}</svg>
            <div>My Music</div>
          </div>
        </div>
        <div class="xp-sm-right">
          <div class="xp-sm-item" id="smr-comp">My Computer</div>
          <div class="xp-sm-item" id="smr-docs">My Documents</div>
          <div class="xp-sm-sep"></div>
          <div class="xp-sm-item xp-disabled">Control Panel</div>
        </div>
      </div>
      <div class="xp-sm-footer">
        <button class="xp-sm-footer-btn" id="sm-off">⏻ Turn Off Computer</button>
      </div>
    `;
    this.overlay.appendChild(sm);

    const nav = (id: string) => { this.closeStartMenu(); this.openExplorer(id); };
    sm.querySelector('#sm-comp')!.addEventListener('click', () => nav('root'));
    sm.querySelector('#smr-comp')!.addEventListener('click', () => nav('root'));
    sm.querySelector('#sm-docs')!.addEventListener('click', () => nav('mydocs'));
    sm.querySelector('#smr-docs')!.addEventListener('click', () => nav('mydocs'));
    sm.querySelector('#sm-pics')!.addEventListener('click', () => nav('mypics'));
    sm.querySelector('#sm-music')!.addEventListener('click', () => nav('mymusic'));
    sm.querySelector('#sm-off')!.addEventListener('click', () => {
      this.closeStartMenu();
      this.showTurnOffDialog();
    });
  }

  private toggleStartMenu() {
    const sm = document.getElementById('xp-start-menu');
    sm?.classList.toggle('open');
  }

  private closeStartMenu() {
    document.getElementById('xp-start-menu')?.classList.remove('open');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FILE EXPLORER WINDOW
  // ════════════════════════════════════════════════════════════════════════════
  openExplorer(startId: string) {
    const winId = 'exp-' + startId;

    // Focus existing window
    if (this.wins.has(winId)) {
      const ws = this.wins.get(winId)!;
      if (ws.minimized) this.restoreWin(winId);
      else this.bringFront(winId);
      return;
    }

    const node = this.fs.getNode(startId);
    const title = node?.name ?? 'My Computer';
    const win = this.buildWindow(winId, title);
    this.overlay.appendChild(win);
    this.positionWin(win);
    this.wins.set(winId, { el: win, titlebar: win.querySelector<HTMLElement>('.xp-titlebar')!, minimized: false, maximized: false });
    this.makeDraggable(winId);
    this.bringFront(winId);

    // Attach FileExplorer
    const explorer = new FileExplorer(
      this.fs,
      win.querySelector<HTMLElement>('#cnt-' + winId)!,
      win.querySelector<HTMLInputElement>('.xp-addr')!,
      win.querySelector<HTMLElement>('#sts-' + winId)!,
      win.querySelector<HTMLButtonElement>('#back-' + winId)!,
      win.querySelector<HTMLButtonElement>('#fwd-' + winId)!,
      win.querySelector<HTMLButtonElement>('#up-' + winId)!,
      win.querySelector<HTMLElement>('.xp-win-title')!,
      startId
    );
    this.explorers.set(winId, explorer);

    // Sidebar links
    const sb = (id: string) => explorer.navigate(id);
    win.querySelector('#sb-comp')!.addEventListener('click', () => sb('root'));
    win.querySelector('#sb-docs')!.addEventListener('click', () => sb('mydocs'));
    win.querySelector('#sb-pics')!.addEventListener('click', () => sb('mypics'));
    win.querySelector('#sb-dsk')!.addEventListener('click', () => sb('desktop_'));

    // New folder button
    win.querySelector('#new-' + winId)!.addEventListener('click', () => explorer.newFolder());

    // Taskbar button
    const tbBtn = this.makeTbBtn(winId, title, Icons.mycomputer);
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.tbBtns.set(winId, tbBtn);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WINDOW BUILDER
  // ════════════════════════════════════════════════════════════════════════════
  private buildWindow(winId: string, title: string): HTMLElement {
    const win = this.div('xp-window');
    win.id = 'win-' + winId;
    win.style.zIndex = String(++this.zTop);
    win.innerHTML = `
      <div class="xp-titlebar">
        <svg class="xp-win-icon" viewBox="0 0 48 48">${Icons.mycomputer}</svg>
        <span class="xp-win-title">${this.escHtml(title)}</span>
        <div class="xp-win-btns">
          <button class="xp-wbtn" id="min-${winId}" title="Minimize">─</button>
          <button class="xp-wbtn" id="max-${winId}" title="Maximize">☐</button>
          <button class="xp-wbtn xp-close" id="cls-${winId}" title="Close">✕</button>
        </div>
      </div>
      <div class="xp-menubar">
        <span class="xp-mitem">File</span>
        <span class="xp-mitem">Edit</span>
        <span class="xp-mitem">View</span>
        <span class="xp-mitem">Favorites</span>
        <span class="xp-mitem">Tools</span>
        <span class="xp-mitem">Help</span>
      </div>
      <div class="xp-toolbar">
        <button class="xp-nav" id="back-${winId}" disabled title="Back">
          <svg viewBox="0 0 16 16">${Icons.arrowBack}</svg>&nbsp;Back
        </button>
        <button class="xp-nav" id="fwd-${winId}" disabled title="Forward">
          <svg viewBox="0 0 16 16">${Icons.arrowFwd}</svg>
        </button>
        <button class="xp-nav" id="up-${winId}" title="Up">
          <svg viewBox="0 0 16 16">${Icons.arrowUp}</svg>&nbsp;Up
        </button>
        <span class="xp-toolbar-sep"></span>
        <button class="xp-nav" id="new-${winId}" title="New Folder">
          <svg viewBox="0 0 16 16">${Icons.newFolderIcon}</svg>&nbsp;New Folder
        </button>
      </div>
      <div class="xp-addrrow">
        <label>Address</label>
        <input class="xp-addr" type="text" readonly value="My Computer" />
      </div>
      <div class="xp-wbody">
        <div class="xp-sidebar">
          <div class="xp-sb-sec">
            <div class="xp-sb-title">Other Places</div>
            <div class="xp-sb-link" id="sb-comp">
              <svg viewBox="0 0 48 48">${Icons.mycomputer}</svg> My Computer
            </div>
            <div class="xp-sb-link" id="sb-docs">
              <svg viewBox="0 0 48 48">${Icons.folderOpen}</svg> My Documents
            </div>
            <div class="xp-sb-link" id="sb-pics">
              <svg viewBox="0 0 48 48">${Icons.folderOpen}</svg> My Pictures
            </div>
            <div class="xp-sb-link" id="sb-dsk">
              <svg viewBox="0 0 48 48">${Icons.folderOpen}</svg> Desktop
            </div>
          </div>
        </div>
        <div class="xp-content" id="cnt-${winId}"></div>
      </div>
      <div class="xp-statusbar">
        <span class="xp-sb-part" id="sts-${winId}">0 objects</span>
      </div>
    `;

    win.querySelector('#min-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.minimizeWin(winId); });
    win.querySelector('#max-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.toggleMax(winId); });
    win.querySelector('#cls-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.closeWin(winId); });
    win.addEventListener('pointerdown', () => this.bringFront(winId));
    return win;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WINDOW MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════
  private positionWin(win: HTMLElement) {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      win.style.cssText += 'left:0;top:0;width:100%;height:calc(100% - var(--xp-taskbar-h));';
      return;
    }
    const W = this.overlay.clientWidth, H = this.overlay.clientHeight;
    const ww = Math.min(820, W - 30), wh = Math.min(560, H - 80);
    const off = this.wins.size * 24;
    win.style.left = Math.min(70 + off, W - ww - 10) + 'px';
    win.style.top  = Math.min(20 + off, H - wh - 50) + 'px';
    win.style.width  = ww + 'px';
    win.style.height = wh + 'px';
  }

  private makeDraggable(winId: string) {
    const ws = this.wins.get(winId);
    if (!ws || window.innerWidth < 768) return;
    const tb = ws.titlebar;
    let drag = false, ox = 0, oy = 0;
    tb.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('.xp-wbtn')) return;
      if (ws.maximized) return;
      drag = true; ox = e.clientX - ws.el.offsetLeft; oy = e.clientY - ws.el.offsetTop;
      tb.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    tb.addEventListener('pointermove', e => {
      if (!drag) return;
      const W = this.overlay.clientWidth, H = this.overlay.clientHeight;
      ws.el.style.left = Math.max(0, Math.min(e.clientX - ox, W - ws.el.offsetWidth)) + 'px';
      ws.el.style.top  = Math.max(0, Math.min(e.clientY - oy, H - 40)) + 'px';
    });
    tb.addEventListener('pointerup', () => { drag = false; });
    tb.addEventListener('lostpointercapture', () => { drag = false; });
  }

  private bringFront(winId: string) {
    const ws = this.wins.get(winId);
    if (ws) ws.el.style.zIndex = String(++this.zTop);
    this.tbBtns.forEach((btn, id) => btn.classList.toggle('xp-tb-active', id === winId && !this.wins.get(id)?.minimized));
  }

  private minimizeWin(winId: string) {
    const ws = this.wins.get(winId);
    if (!ws) return;
    ws.minimized = true;
    ws.el.classList.add('xp-win-hidden');
    this.tbBtns.get(winId)?.classList.remove('xp-tb-active');
  }

  private restoreWin(winId: string) {
    const ws = this.wins.get(winId);
    if (!ws) return;
    ws.minimized = false;
    ws.el.classList.remove('xp-win-hidden');
    this.bringFront(winId);
  }

  private toggleMax(winId: string) {
    const ws = this.wins.get(winId);
    if (!ws) return;
    const tbH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--xp-taskbar-h')) || 40;
    if (ws.maximized) {
      if (ws.prev) { Object.assign(ws.el.style, ws.prev); }
      ws.maximized = false;
      ws.titlebar.style.cursor = 'move';
    } else {
      ws.prev = { left: ws.el.style.left, top: ws.el.style.top, width: ws.el.style.width, height: ws.el.style.height };
      ws.el.style.left = '0'; ws.el.style.top = '0';
      ws.el.style.width = '100%'; ws.el.style.height = (this.overlay.clientHeight - tbH) + 'px';
      ws.maximized = true;
      ws.titlebar.style.cursor = 'default';
    }
  }

  private closeWin(winId: string) {
    this.wins.get(winId)?.el.remove();
    this.explorers.delete(winId);
    this.wins.delete(winId);
    this.tbBtns.get(winId)?.remove();
    this.tbBtns.delete(winId);
  }

  private makeTbBtn(winId: string, label: string, iconSvg: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'xp-tb-btn xp-tb-active';
    btn.innerHTML = `<svg viewBox="0 0 48 48">${iconSvg}</svg> ${this.escHtml(label)}`;
    btn.addEventListener('click', () => {
      const ws = this.wins.get(winId);
      if (!ws) return;
      if (ws.minimized) this.restoreWin(winId);
      else if (ws.el.style.zIndex === String(this.zTop)) this.minimizeWin(winId);
      else this.bringFront(winId);
    });
    return btn;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONTEXT MENUS
  // ════════════════════════════════════════════════════════════════════════════
  private showDesktopMenu(x: number, y: number) {
    this.closeCtxMenus();
    const menu = this.div('xp-ctx');
    menu.innerHTML = `
      <div class="xp-ctx-item" id="ctx-newcomp"><svg viewBox="0 0 48 48">${Icons.mycomputer}</svg>&nbsp;Open My Computer</div>
      <div class="xp-ctx-sep"></div>
      <div class="xp-ctx-item xp-disabled">Arrange Icons By</div>
      <div class="xp-ctx-item xp-disabled">Refresh</div>
      <div class="xp-ctx-sep"></div>
      <div class="xp-ctx-item" id="ctx-props">Properties</div>
    `;
    this.positionCtx(menu, x, y);
    document.body.appendChild(menu);
    menu.querySelector('#ctx-newcomp')!.addEventListener('click', () => { this.closeCtxMenus(); this.openExplorer('root'); });
    menu.querySelector('#ctx-props')!.addEventListener('click', () => { this.closeCtxMenus(); this.showSystemProps(); });

    setTimeout(() => {
      document.addEventListener('pointerdown', () => this.closeCtxMenus(), { once: true, capture: true });
    }, 0);
  }

  private positionCtx(menu: HTMLElement, x: number, y: number) {
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right > window.innerWidth)  menu.style.left = (x - r.width) + 'px';
      if (r.bottom > window.innerHeight) menu.style.top = (y - r.height) + 'px';
    });
  }

  private closeCtxMenus() {
    document.querySelectorAll('.xp-ctx').forEach(m => m.remove());
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DIALOGS
  // ════════════════════════════════════════════════════════════════════════════
  private showSystemProps() {
    const overlay = document.createElement('div');
    overlay.className = 'xp-dialog-overlay';
    const d = document.createElement('div');
    d.className = 'xp-dialog';
    d.innerHTML = `
      <div class="xp-dlg-title">
        <svg viewBox="0 0 48 48" width="16" height="16">${Icons.mycomputer}</svg>
        System Properties
      </div>
      <div class="xp-dlg-body">
        <div class="xp-dlg-msg">
          <svg viewBox="0 0 48 48" width="48" height="48">${Icons.mycomputer}</svg>
          <div>
            <b>Windows XP</b><br>
            Professional<br><br>
            Registered to: <b>${this.escHtml(this.userName)}</b><br>
            <br>
            Computer: Windows XP Desktop<br>
            Discord Activity v1.0
          </div>
        </div>
        <div class="xp-dlg-btns">
          <button class="xp-dlg-btn">OK</button>
        </div>
      </div>
    `;
    overlay.appendChild(d);
    document.body.appendChild(overlay);
    d.querySelector('.xp-dlg-btn')!.addEventListener('click', () => overlay.remove());
  }

  private showTurnOffDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'xp-dialog-overlay';
    const d = document.createElement('div');
    d.className = 'xp-dialog';
    d.innerHTML = `
      <div class="xp-dlg-title">
        <svg viewBox="0 0 22 22" width="16" height="16">${Icons.xpFlag}</svg>
        Turn off computer
      </div>
      <div class="xp-dlg-body">
        <div class="xp-dlg-msg">What do you want the computer to do?</div>
        <div class="xp-dlg-btns">
          <button class="xp-dlg-btn" id="dlg-cancel">Cancel</button>
          <button class="xp-dlg-btn" id="dlg-restart">Restart</button>
        </div>
      </div>
    `;
    overlay.appendChild(d);
    document.body.appendChild(overlay);
    d.querySelector('#dlg-cancel')!.addEventListener('click', () => overlay.remove());
    d.querySelector('#dlg-restart')!.addEventListener('click', () => { overlay.remove(); location.reload(); });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GLOBAL EVENTS
  // ════════════════════════════════════════════════════════════════════════════
  private wireGlobalEvents() {
    // Desktop right-click
    this.overlay.addEventListener('contextmenu', e => {
      const tgt = e.target as HTMLElement;
      if (!tgt.closest('.xp-window') && !tgt.closest('.xp-taskbar')) {
        e.preventDefault();
        this.showDesktopMenu(e.clientX, e.clientY);
      }
    });

    // Close start menu & ctx when clicking elsewhere
    this.overlay.addEventListener('pointerdown', e => {
      const tgt = e.target as HTMLElement;
      if (!tgt.closest('.xp-start-menu') && !tgt.closest('.xp-start-btn')) this.closeStartMenu();
      if (!tgt.closest('.xp-ctx')) this.closeCtxMenus();
      if (tgt === this.overlay || tgt.classList.contains('xp-desktop-icons'))
        this.overlay.querySelectorAll('.xp-icon').forEach(ic => ic.classList.remove('selected'));
    }, true);

    // Cursor sharing
    this.overlay.addEventListener('pointermove', e => {
      if (!this.room) return;
      const now = Date.now();
      if (now - this.lastCurSend < 50) return;
      this.lastCurSend = now;
      const r = this.overlay.getBoundingClientRect();
      this.room.send('cursor', {
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top)  / r.height) * 100,
        name: this.userName,
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COLYSEUS MULTIPLAYER
  // ════════════════════════════════════════════════════════════════════════════
  private async connectServer() {
    try {
      const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const httpBase = isLocal ? 'http://localhost:3001' : `${location.protocol}//${location.host}/.proxy/api`;
      const wsBase   = isLocal ? 'ws://localhost:3001'   : `wss://${location.host}/.proxy/api`;

      // Manual matchmaking — bridges v0.17 server flat response to v0.16 client nested format
      const resp = await fetch(`${httpBase}/matchmake/joinOrCreate/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ screenWidth: this.scale.width, screenHeight: this.scale.height }),
      });
      const data = await resp.json() as { name?: string; sessionId: string; roomId: string; processId: string };
      if (!resp.ok || !data.roomId) throw new Error(`Matchmake failed: ${JSON.stringify(data)}`);

      // Wrap into the nested format colyseus.js v0.16 expects
      const client = new Client(wsBase);
      this.room = await (client as any).consumeSeatReservation({
        sessionId: data.sessionId,
        room: { name: data.name ?? 'game', roomId: data.roomId, processId: data.processId },
      });
      console.log('[XP] Colyseus connected');

      this.room.onMessage('cursor', (d: { sessionId: string; x: number; y: number; name: string; color: string }) => {
        this.renderPlayerCursor(d);
      });
      this.room.onMessage('playerLeft', (d: { sessionId: string }) => {
        this.pCursors.get(d.sessionId)?.remove();
        this.pCursors.delete(d.sessionId);
      });
    } catch (err) {
      console.warn('[XP] Server unavailable:', err);
    }
  }

  private renderPlayerCursor(d: { sessionId: string; x: number; y: number; name: string; color: string }) {
    let el = this.pCursors.get(d.sessionId);
    if (!el) {
      el = this.div('xp-cursor');
      el.innerHTML = `
        <svg viewBox="0 0 20 28">
          <path d="M1 1 L1 21 L5 14 L10 25 L13 23 L8 12 L15 12 Z"
            fill="${d.color}" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
        <span class="xp-cursor-name">${this.escHtml(d.name || 'Player')}</span>
      `;
      this.overlay.appendChild(el);
      this.pCursors.set(d.sessionId, el);
    }
    const W = this.overlay.clientWidth, H = this.overlay.clientHeight;
    el.style.left = (d.x / 100 * W) + 'px';
    el.style.top  = (d.y / 100 * H) + 'px';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // UTILS
  // ════════════════════════════════════════════════════════════════════════════
  private div(cls: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = cls;
    return el;
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════════════════════════════════════
  private cleanup() {
    if (this.clockTick) clearInterval(this.clockTick);
    this.pCursors.forEach(el => el.remove());
    this.pCursors.clear();
    this.overlay?.remove();
    try { this.room?.leave(); } catch { /* ignore */ }
    this.room = null;
  }
}
