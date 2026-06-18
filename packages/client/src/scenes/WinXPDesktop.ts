import { Scene } from "phaser";
import { Room, Client } from "colyseus.js";
import { getUserName } from "../utils/discordSDK";
import { SoundManager } from "../utils/SoundManager";
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

interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  author: string;
  sessionId: string;
}

const CURSOR_COLORS = ['#FF4444','#4488FF','#44CC88','#FFAA44','#AA44FF','#FF44AA','#44DDFF','#FFDD44'];

export class WinXPDesktop extends Scene {
  private bg!: Phaser.GameObjects.Image;
  private overlay!: HTMLDivElement;
  private touchCursor!: HTMLDivElement;
  private touchHide: ReturnType<typeof setTimeout> | null = null;
  private fs!: VirtualFileSystem;
  private room: Room | null = null;
  private wins = new Map<string, WinState>();
  private explorers = new Map<string, FileExplorer>();
  private tbBtns = new Map<string, HTMLElement>();
  private pCursors = new Map<string, HTMLElement>();
  private stickyNotes = new Map<string, HTMLElement>();
  private zTop = 100;
  private clockTick: ReturnType<typeof setInterval> | null = null;
  private lastCurSend = 0;
  private userName = 'User';
  private isMobile = false;

  constructor() { super('WinXPDesktop'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.isMobile = window.innerWidth < 768 || ('ontouchstart' in window);

    // ── Phaser background ─────────────────────────────────────────────────────
    if (this.textures.exists('bliss')) {
      this.bg = this.add.image(W / 2, H / 2, 'bliss').setDisplaySize(W, H);
    } else {
      this.cameras.main.setBackgroundColor(0x3a8820);
    }
    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      if (this.bg) this.bg.setPosition(gs.width / 2, gs.height / 2).setDisplaySize(gs.width, gs.height);
    }, this);

    // ── DOM overlay — fixed to viewport so it ALWAYS covers full screen ────────
    this.overlay = document.createElement('div');
    this.overlay.className = 'xp-overlay';
    document.body.appendChild(this.overlay);           // ← body, not #gameParent

    // ── Mobile touch-cursor ───────────────────────────────────────────────────
    this.touchCursor = document.createElement('div');
    this.touchCursor.className = 'xp-touch-cursor';
    document.body.appendChild(this.touchCursor);

    // ── Virtual FS + user ────────────────────────────────────────────────────
    this.fs = new VirtualFileSystem();
    this.userName = getUserName() || 'User';

    // ── Build UI ─────────────────────────────────────────────────────────────
    this.buildDesktopIcons();
    this.buildTaskbar();
    this.buildStartMenu();
    this.wireGlobalEvents();

    // ── Unlock audio + startup sound ─────────────────────────────────────────
    SoundManager.unlock();
    this.time.delayedCall(300, () => SoundManager.startup());

    // ── Multiplayer ───────────────────────────────────────────────────────────
    this.connectServer();

    // ── Cleanup ───────────────────────────────────────────────────────────────
    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy',  this.cleanup, this);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESKTOP ICONS
  // ══════════════════════════════════════════════════════════════════════════
  private buildDesktopIcons() {
    const area = this.div('xp-desktop-icons');
    this.overlay.appendChild(area);
    area.appendChild(this.makeDesktopIcon('My Computer', Icons.mycomputer, () => this.openExplorer('root')));
    area.appendChild(this.makeDesktopIconImg('Miscord', '/miscord-icon.png', () => this.openMiscord()));
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
      if (now - lastTap < 420) { SoundManager.dblClick(); onOpen(); }
      else SoundManager.click();
      lastTap = now;
    });
    return d;
  }

  private makeDesktopIconImg(label: string, imgSrc: string, onOpen: () => void): HTMLElement {
    const d = this.div('xp-icon');
    d.innerHTML = `<img src="${imgSrc}" class="xp-icon-img" alt="${label}" /><span class="xp-icon-label">${label}</span>`;
    let lastTap = 0;
    d.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const now = Date.now();
      this.overlay.querySelectorAll('.xp-icon').forEach(el => el.classList.remove('selected'));
      d.classList.add('selected');
      if (now - lastTap < 420) { SoundManager.dblClick(); onOpen(); }
      else SoundManager.click();
      lastTap = now;
    });
    return d;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASKBAR
  // ══════════════════════════════════════════════════════════════════════════
  private buildTaskbar() {
    const tb = this.div('xp-taskbar');
    this.overlay.appendChild(tb);

    const startBtn = document.createElement('button');
    startBtn.className = 'xp-start-btn';
    startBtn.innerHTML = `<svg viewBox="0 0 22 22">${Icons.xpFlag}</svg>start`;
    startBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleStartMenu(); });
    tb.appendChild(startBtn);

    const progs = this.div('xp-programs');
    progs.id = 'xp-programs';
    tb.appendChild(progs);

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

  // ══════════════════════════════════════════════════════════════════════════
  // START MENU
  // ══════════════════════════════════════════════════════════════════════════
  private buildStartMenu() {
    const initial = (this.userName[0] || 'U').toUpperCase();
    const sm = this.div('xp-start-menu');
    sm.id = 'xp-start-menu';
    sm.innerHTML = `
      <div class="xp-sm-header">
        <div class="xp-sm-avatar">${initial}</div>
        <div class="xp-sm-username">${this.esc(this.userName)}</div>
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

    const nav = (id: string) => { SoundManager.menuItem(); this.closeStartMenu(); this.openExplorer(id); };
    sm.querySelector('#sm-comp')!.addEventListener('click', () => nav('root'));
    sm.querySelector('#smr-comp')!.addEventListener('click', () => nav('root'));
    sm.querySelector('#sm-docs')!.addEventListener('click', () => nav('mydocs'));
    sm.querySelector('#smr-docs')!.addEventListener('click', () => nav('mydocs'));
    sm.querySelector('#sm-pics')!.addEventListener('click', () => nav('mypics'));
    sm.querySelector('#sm-music')!.addEventListener('click', () => nav('mymusic'));
    sm.querySelector('#sm-off')!.addEventListener('click', () => {
      SoundManager.menuItem();
      this.closeStartMenu();
      this.showTurnOffDialog();
    });
  }

  private toggleStartMenu() {
    const sm = document.getElementById('xp-start-menu');
    if (!sm) return;
    const opening = !sm.classList.contains('open');
    sm.classList.toggle('open');
    if (opening) SoundManager.menuOpen(); else SoundManager.menuClose();
  }
  private closeStartMenu() {
    document.getElementById('xp-start-menu')?.classList.remove('open');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MISCORD WINDOW
  // ══════════════════════════════════════════════════════════════════════════
  private openMiscord() {
    const winId = 'miscord';
    if (this.wins.has(winId)) {
      const ws = this.wins.get(winId)!;
      if (ws.minimized) this.restoreWin(winId);
      else this.bringFront(winId);
      return;
    }
    SoundManager.windowOpen();

    const win = document.createElement('div');
    win.className = 'xp-window miscord-window';
    win.id = 'win-' + winId;
    win.style.zIndex = String(++this.zTop);

    const SEED_MESSAGES = [
      { author: 'clyde_ghost', avatar: '👻', text: 'is anyone else seeing this or just me', ts: '9:42 AM' },
      { author: 'xX_n00bslayer_Xx', avatar: '💀', text: 'yeah the app keeps crashing lmaooo', ts: '9:43 AM' },
      { author: 'totallynotabot', avatar: '🤖', text: 'ERROR: connection_refused — retrying in 3s…', ts: '9:43 AM' },
      { author: 'clyde_ghost', avatar: '👻', text: 'bro who let the bot in here', ts: '9:44 AM' },
      { author: 'vaporwave99', avatar: '🌊', text: 'miscord my beloved 💜', ts: '9:45 AM' },
    ];

    const seedHtml = SEED_MESSAGES.map(m => `
      <div class="mc-msg">
        <div class="mc-avatar">${m.avatar}</div>
        <div class="mc-msg-content">
          <span class="mc-author">${m.author}</span>
          <span class="mc-ts">${m.ts}</span>
          <div class="mc-text">${m.text}</div>
        </div>
      </div>`).join('');

    win.innerHTML = `
      <div class="xp-titlebar miscord-titlebar">
        <img src="/miscord-icon.png" class="xp-win-icon-img" alt="Miscord" />
        <span class="xp-win-title">Miscord</span>
        <div class="xp-win-btns">
          <button class="xp-wbtn" id="min-${winId}" title="Minimize">─</button>
          <button class="xp-wbtn" id="max-${winId}" title="Maximize">☐</button>
          <button class="xp-wbtn xp-close" id="cls-${winId}" title="Close">✕</button>
        </div>
      </div>
      <div class="mc-body">
        <div class="mc-server-rail">
          <div class="mc-server-icon mc-server-home" title="Home">
            <img src="/miscord-icon.png" alt="Miscord" />
          </div>
          <div class="mc-server-sep"></div>
          <div class="mc-server-icon" title="General">💬</div>
          <div class="mc-server-icon" title="Gaming">🎮</div>
          <div class="mc-server-icon" title="Memes">💀</div>
          <div class="mc-server-icon" title="Music">🎵</div>
        </div>
        <div class="mc-sidebar">
          <div class="mc-guild-header">
            <span>Miscord HQ</span>
            <span class="mc-guild-chevron">▾</span>
          </div>
          <div class="mc-channel-section">TEXT CHANNELS</div>
          <div class="mc-channel mc-channel-active">
            <span class="mc-channel-hash">#</span> general
          </div>
          <div class="mc-channel">
            <span class="mc-channel-hash">#</span> off-topic
          </div>
          <div class="mc-channel">
            <span class="mc-channel-hash">#</span> bug-reports
          </div>
          <div class="mc-channel">
            <span class="mc-channel-hash">#</span> memes
          </div>
          <div class="mc-channel-section">VOICE CHANNELS</div>
          <div class="mc-channel mc-channel-voice">
            <span class="mc-channel-hash">🔊</span> General
          </div>
          <div class="mc-channel mc-channel-voice">
            <span class="mc-channel-hash">🔊</span> AFK
          </div>
          <div class="mc-user-panel">
            <div class="mc-user-avatar">🤕</div>
            <div class="mc-user-info">
              <div class="mc-user-name">${this.esc(this.userName)}</div>
              <div class="mc-user-status">Online</div>
            </div>
            <div class="mc-user-icons">🎤 🎧 ⚙</div>
          </div>
        </div>
        <div class="mc-main">
          <div class="mc-channel-header">
            <span class="mc-channel-hash-big">#</span>
            <span class="mc-channel-name-big">general</span>
            <span class="mc-channel-topic">Welcome to Miscord. Things may be slightly broken.</span>
          </div>
          <div class="mc-messages" id="mc-messages-${winId}">${seedHtml}</div>
          <div class="mc-input-area">
            <input class="mc-input" id="mc-input-${winId}" type="text" placeholder="Message #general" maxlength="200" />
            <button class="mc-send-btn" id="mc-send-${winId}" title="Send">➤</button>
          </div>
        </div>
      </div>
    `;

    this.overlay.appendChild(win);
    this.positionWin(win);
    this.wins.set(winId, {
      el: win,
      titlebar: win.querySelector<HTMLElement>('.xp-titlebar')!,
      minimized: false,
      maximized: false,
    });
    this.makeDraggable(winId);
    this.bringFront(winId);

    win.querySelector('#min-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.minimizeWin(winId); });
    win.querySelector('#max-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.toggleMax(winId); });
    win.querySelector('#cls-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.closeWin(winId); });
    win.addEventListener('pointerdown', () => this.bringFront(winId));

    const input = win.querySelector<HTMLInputElement>('#mc-input-' + winId)!;
    const sendBtn = win.querySelector<HTMLButtonElement>('#mc-send-' + winId)!;
    const msgArea = win.querySelector<HTMLElement>('#mc-messages-' + winId)!;

    const sendMessage = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      const now = new Date();
      const h = now.getHours() % 12 || 12;
      const m = String(now.getMinutes()).padStart(2, '0');
      const ts = `${h}:${m} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
      const msg = document.createElement('div');
      msg.className = 'mc-msg mc-msg-own';
      msg.innerHTML = `
        <div class="mc-avatar">😊</div>
        <div class="mc-msg-content">
          <span class="mc-author mc-author-own">${this.esc(this.userName)}</span>
          <span class="mc-ts">${ts}</span>
          <div class="mc-text">${this.esc(text)}</div>
        </div>`;
      msgArea.appendChild(msg);
      msgArea.scrollTop = msgArea.scrollHeight;
      SoundManager.click();
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

    const tbBtn = this.makeTbBtn(winId, 'Miscord', Icons.mycomputer);
    tbBtn.innerHTML = `<img src="/miscord-icon.png" style="width:16px;height:16px;object-fit:contain;" /> Miscord`;
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.tbBtns.set(winId, tbBtn);

    setTimeout(() => { msgArea.scrollTop = msgArea.scrollHeight; }, 50);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FILE EXPLORER WINDOW
  // ══════════════════════════════════════════════════════════════════════════
  openExplorer(startId: string) {
    const winId = 'exp-' + startId;
    if (this.wins.has(winId)) {
      const ws = this.wins.get(winId)!;
      if (ws.minimized) this.restoreWin(winId);
      else this.bringFront(winId);
      return;
    }
    SoundManager.windowOpen();

    const node = this.fs.getNode(startId);
    const title = node?.name ?? 'My Computer';
    const win = this.buildWindow(winId, title);
    this.overlay.appendChild(win);
    this.positionWin(win);
    this.wins.set(winId, {
      el: win,
      titlebar: win.querySelector<HTMLElement>('.xp-titlebar')!,
      minimized: false,
      maximized: false,
    });
    this.makeDraggable(winId);
    this.bringFront(winId);

    const explorer = new FileExplorer(
      this.fs,
      win.querySelector<HTMLElement>('#cnt-' + winId)!,
      win.querySelector<HTMLInputElement>('.xp-addr')!,
      win.querySelector<HTMLElement>('#sts-' + winId)!,
      win.querySelector<HTMLButtonElement>('#back-' + winId)!,
      win.querySelector<HTMLButtonElement>('#fwd-' + winId)!,
      win.querySelector<HTMLButtonElement>('#up-' + winId)!,
      win.querySelector<HTMLElement>('.xp-win-title')!,
      startId,
    );
    this.explorers.set(winId, explorer);

    const sb = (id: string) => explorer.navigate(id);
    win.querySelector('#sb-comp')!.addEventListener('click', () => sb('root'));
    win.querySelector('#sb-docs')!.addEventListener('click', () => sb('mydocs'));
    win.querySelector('#sb-pics')!.addEventListener('click', () => sb('mypics'));
    win.querySelector('#sb-dsk')!.addEventListener('click',  () => sb('desktop_'));
    win.querySelector('#new-' + winId)!.addEventListener('click', () => explorer.newFolder());

    const tbBtn = this.makeTbBtn(winId, title, Icons.mycomputer);
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.tbBtns.set(winId, tbBtn);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WINDOW BUILDER
  // ══════════════════════════════════════════════════════════════════════════
  private buildWindow(winId: string, title: string): HTMLElement {
    const win = this.div('xp-window');
    win.id = 'win-' + winId;
    win.style.zIndex = String(++this.zTop);
    win.innerHTML = `
      <div class="xp-titlebar">
        <svg class="xp-win-icon" viewBox="0 0 48 48">${Icons.mycomputer}</svg>
        <span class="xp-win-title">${this.esc(title)}</span>
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
        <button class="xp-nav" id="back-${winId}" disabled>
          <svg viewBox="0 0 16 16">${Icons.arrowBack}</svg>&nbsp;Back
        </button>
        <button class="xp-nav" id="fwd-${winId}" disabled>
          <svg viewBox="0 0 16 16">${Icons.arrowFwd}</svg>
        </button>
        <button class="xp-nav" id="up-${winId}">
          <svg viewBox="0 0 16 16">${Icons.arrowUp}</svg>&nbsp;Up
        </button>
        <span class="xp-toolbar-sep"></span>
        <button class="xp-nav" id="new-${winId}">
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
            <div class="xp-sb-link" id="sb-comp"><svg viewBox="0 0 48 48">${Icons.mycomputer}</svg> My Computer</div>
            <div class="xp-sb-link" id="sb-docs"><svg viewBox="0 0 48 48">${Icons.folderOpen}</svg> My Documents</div>
            <div class="xp-sb-link" id="sb-pics"><svg viewBox="0 0 48 48">${Icons.folderOpen}</svg> My Pictures</div>
            <div class="xp-sb-link" id="sb-dsk"><svg viewBox="0 0 48 48">${Icons.folderOpen}</svg> Desktop</div>
          </div>
        </div>
        <div class="xp-content" id="cnt-${winId}"></div>
      </div>
      <div class="xp-statusbar"><span class="xp-sb-part" id="sts-${winId}">0 objects</span></div>
    `;

    win.querySelector('#min-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.minimizeWin(winId); });
    win.querySelector('#max-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.toggleMax(winId); });
    win.querySelector('#cls-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.closeWin(winId); });
    win.addEventListener('pointerdown', () => this.bringFront(winId));
    return win;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WINDOW MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════
  private positionWin(win: HTMLElement) {
    if (this.isMobile || window.innerWidth < 768) return; // CSS handles mobile
    const W = window.innerWidth, H = window.innerHeight;
    const tbH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--xp-taskbar-h')) || 40;
    const ww = Math.min(840, W - 30);
    const wh = Math.min(580, H - tbH - 20);
    const off = (this.wins.size) * 28;
    win.style.left = Math.min(60 + off, W - ww - 10) + 'px';
    win.style.top  = Math.min(16 + off, H - wh - tbH - 10) + 'px';
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
      drag = true;
      ox = e.clientX - ws.el.offsetLeft;
      oy = e.clientY - ws.el.offsetTop;
      tb.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    tb.addEventListener('pointermove', e => {
      if (!drag) return;
      const W = window.innerWidth, H = window.innerHeight;
      ws.el.style.left = Math.max(0, Math.min(e.clientX - ox, W - ws.el.offsetWidth)) + 'px';
      ws.el.style.top  = Math.max(0, Math.min(e.clientY - oy, H - 40)) + 'px';
    });
    tb.addEventListener('pointerup', () => { drag = false; });
    tb.addEventListener('lostpointercapture', () => { drag = false; });
  }

  private bringFront(winId: string) {
    const ws = this.wins.get(winId);
    if (ws) ws.el.style.zIndex = String(++this.zTop);
    this.tbBtns.forEach((btn, id) =>
      btn.classList.toggle('xp-tb-active', id === winId && !this.wins.get(id)?.minimized));
  }

  private minimizeWin(winId: string) {
    const ws = this.wins.get(winId);
    if (!ws) return;
    ws.minimized = true;
    ws.el.classList.add('xp-win-hidden');
    this.tbBtns.get(winId)?.classList.remove('xp-tb-active');
    SoundManager.windowMinimize();
  }

  private restoreWin(winId: string) {
    const ws = this.wins.get(winId);
    if (!ws) return;
    ws.minimized = false;
    ws.el.classList.remove('xp-win-hidden');
    this.bringFront(winId);
    SoundManager.windowRestore();
  }

  private toggleMax(winId: string) {
    const ws = this.wins.get(winId);
    if (!ws) return;
    const tbH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--xp-taskbar-h')) || 40;
    const safeB = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--xp-safe-bottom')) || 0;
    if (ws.maximized) {
      if (ws.prev) Object.assign(ws.el.style, ws.prev);
      ws.maximized = false;
      ws.titlebar.style.cursor = 'move';
    } else {
      ws.prev = { left: ws.el.style.left, top: ws.el.style.top, width: ws.el.style.width, height: ws.el.style.height };
      ws.el.style.left = '0';
      ws.el.style.top = '0';
      ws.el.style.width = '100%';
      ws.el.style.height = (window.innerHeight - tbH - safeB) + 'px';
      ws.maximized = true;
      ws.titlebar.style.cursor = 'default';
    }
  }

  private closeWin(winId: string) {
    SoundManager.windowClose();
    this.wins.get(winId)?.el.remove();
    this.explorers.delete(winId);
    this.wins.delete(winId);
    this.tbBtns.get(winId)?.remove();
    this.tbBtns.delete(winId);
  }

  private makeTbBtn(winId: string, label: string, iconSvg: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'xp-tb-btn xp-tb-active';
    btn.innerHTML = `<svg viewBox="0 0 48 48">${iconSvg}</svg> ${this.esc(label)}`;
    btn.addEventListener('click', () => {
      const ws = this.wins.get(winId);
      if (!ws) return;
      SoundManager.click();
      if (ws.minimized) this.restoreWin(winId);
      else if (ws.el.style.zIndex === String(this.zTop)) this.minimizeWin(winId);
      else this.bringFront(winId);
    });
    return btn;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONTEXT MENUS
  // ══════════════════════════════════════════════════════════════════════════
  private showDesktopMenu(x: number, y: number) {
    this.closeCtxMenus();
    const menu = this.div('xp-ctx');
    menu.innerHTML = `
      <div class="xp-ctx-item" id="ctx-comp"><svg viewBox="0 0 48 48" width="16" height="16">${Icons.mycomputer}</svg>&nbsp;Open My Computer</div>
      <div class="xp-ctx-sep"></div>
      <div class="xp-ctx-item" id="ctx-note">📌&nbsp; New Sticky Note</div>
      <div class="xp-ctx-sep"></div>
      <div class="xp-ctx-item xp-disabled">Arrange Icons By</div>
      <div class="xp-ctx-item xp-disabled">Refresh</div>
      <div class="xp-ctx-sep"></div>
      <div class="xp-ctx-item" id="ctx-props">Properties</div>
    `;
    this.posCtx(menu, x, y);
    document.body.appendChild(menu);
    menu.querySelector('#ctx-comp')!.addEventListener('click', () => { this.closeCtxMenus(); this.openExplorer('root'); });
    menu.querySelector('#ctx-note')!.addEventListener('click', () => { this.closeCtxMenus(); this.spawnNote(x, y); });
    menu.querySelector('#ctx-props')!.addEventListener('click', () => { this.closeCtxMenus(); this.showSystemProps(); });
    setTimeout(() => document.addEventListener('pointerdown', () => this.closeCtxMenus(), { once: true, capture: true }), 0);
  }

  private posCtx(menu: HTMLElement, x: number, y: number) {
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right  > window.innerWidth)  menu.style.left = (x - r.width) + 'px';
      if (r.bottom > window.innerHeight) menu.style.top  = (y - r.height) + 'px';
    });
  }

  private closeCtxMenus() {
    document.querySelectorAll('.xp-ctx').forEach(m => m.remove());
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DIALOGS
  // ══════════════════════════════════════════════════════════════════════════
  private showSystemProps() {
    const ov = document.createElement('div');
    ov.className = 'xp-dialog-overlay';
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
          <div><b>Windows XP</b><br>Professional<br><br>
          User: <b>${this.esc(this.userName)}</b><br><br>
          Discord Activity — Phaser 3 + Colyseus</div>
        </div>
        <div class="xp-dlg-btns"><button class="xp-dlg-btn">OK</button></div>
      </div>`;
    ov.appendChild(d);
    document.body.appendChild(ov);
    d.querySelector('.xp-dlg-btn')!.addEventListener('click', () => ov.remove());
  }

  private showTurnOffDialog() {
    const ov = document.createElement('div');
    ov.className = 'xp-dialog-overlay';
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
      </div>`;
    ov.appendChild(d);
    document.body.appendChild(ov);
    d.querySelector('#dlg-cancel')!.addEventListener('click', () => ov.remove());
    d.querySelector('#dlg-restart')!.addEventListener('click', () => { ov.remove(); location.reload(); });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GLOBAL EVENTS
  // ══════════════════════════════════════════════════════════════════════════
  private wireGlobalEvents() {
    // Right-click on desktop
    this.overlay.addEventListener('contextmenu', e => {
      const t = e.target as HTMLElement;
      if (!t.closest('.xp-window') && !t.closest('.xp-taskbar')) {
        e.preventDefault();
        this.showDesktopMenu(e.clientX, e.clientY);
      }
    });

    // Close start-menu / ctx when clicking elsewhere
    this.overlay.addEventListener('pointerdown', e => {
      const t = e.target as HTMLElement;
      if (!t.closest('.xp-start-menu') && !t.closest('.xp-start-btn')) this.closeStartMenu();
      if (!t.closest('.xp-ctx')) this.closeCtxMenus();
      if (t === this.overlay || t.classList.contains('xp-desktop-icons'))
        this.overlay.querySelectorAll('.xp-icon').forEach(ic => ic.classList.remove('selected'));
    }, true);

    // ── Mouse cursor sharing ──────────────────────────────────────────────
    document.addEventListener('pointermove', e => {
      // Show mobile touch cursor (own finger)
      if (e.pointerType === 'touch') {
        this.touchCursor.style.left = e.clientX + 'px';
        this.touchCursor.style.top  = e.clientY + 'px';
        this.touchCursor.classList.add('xp-touch-active');
        if (this.touchHide) clearTimeout(this.touchHide);
        this.touchHide = setTimeout(() => this.touchCursor.classList.remove('xp-touch-active'), 600);
      }

      // Send cursor to server
      if (!this.room) return;
      const now = Date.now();
      if (now - this.lastCurSend < 50) return;
      this.lastCurSend = now;
      this.room.send('cursor', {
        x: (e.clientX / window.innerWidth)  * 100,
        y: (e.clientY / window.innerHeight) * 100,
        name: this.userName,
      });
    });

    // Also show touch cursor on touchstart
    document.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (!t) return;
      this.touchCursor.style.left = t.clientX + 'px';
      this.touchCursor.style.top  = t.clientY + 'px';
      this.touchCursor.classList.add('xp-touch-active');
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (this.touchHide) clearTimeout(this.touchHide);
      this.touchHide = setTimeout(() => this.touchCursor.classList.remove('xp-touch-active'), 400);
    }, { passive: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER
  // ══════════════════════════════════════════════════════════════════════════
  private async connectServer() {
    try {
      const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '');

      let httpBase: string;
      let wsBase: string;

      if (isLocal) {
        httpBase = 'http://localhost:3001';
        wsBase   = 'ws://localhost:3001';
      } else if (serverUrl) {
        httpBase = serverUrl;
        wsBase   = serverUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
      } else {
        httpBase = `${location.protocol}//${location.host}/.proxy/api`;
        wsBase   = `wss://${location.host}/.proxy/api`;
      }

      const resp = await fetch(`${httpBase}/matchmake/joinOrCreate/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ screenWidth: this.scale.width, screenHeight: this.scale.height }),
      });
      const data = await resp.json() as { name?: string; sessionId: string; roomId: string; processId: string };
      if (!resp.ok || !data.roomId) throw new Error(`Matchmake error: ${JSON.stringify(data)}`);

      const client = new Client(wsBase);
      this.room = await (client as any).consumeSeatReservation({
        sessionId: data.sessionId,
        room: { name: data.name ?? 'game', roomId: data.roomId, processId: data.processId },
      });
      console.log('[XP] Colyseus connected ✓');

      this.room!.onMessage('cursor', (d: { sessionId: string; x: number; y: number; name: string; color: string }) => {
        this.renderPeerCursor(d);
      });
      this.room!.onMessage('playerLeft', (d: { sessionId: string }) => {
        this.pCursors.get(d.sessionId)?.remove();
        this.pCursors.delete(d.sessionId);
      });

      this.room!.onMessage('note:add',    (d: StickyNote) => this.renderNote(d));
      this.room!.onMessage('note:move',   (d: { id: string; x: number; y: number }) => {
        const el = this.stickyNotes.get(d.id);
        if (el) { el.style.left = d.x + 'px'; el.style.top = d.y + 'px'; }
      });
      this.room!.onMessage('note:delete', (d: { id: string }) => {
        this.stickyNotes.get(d.id)?.remove();
        this.stickyNotes.delete(d.id);
      });
    } catch (err) {
      console.warn('[XP] Multiplayer unavailable:', err);
    }
  }

  private renderPeerCursor(d: { sessionId: string; x: number; y: number; name: string; color: string }) {
    let el = this.pCursors.get(d.sessionId);
    if (!el) {
      el = document.createElement('div');
      el.className = 'xp-cursor';
      el.innerHTML = `
        <svg viewBox="0 0 20 28">
          <path d="M1 1 L1 21 L5 14 L10 25 L13 23 L8 12 L15 12 Z"
            fill="${d.color}" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
        <span class="xp-cursor-name">${this.esc(d.name || 'Player')}</span>`;
      document.body.appendChild(el);
      this.pCursors.set(d.sessionId, el);
    }
    el.style.left = (d.x / 100 * window.innerWidth)  + 'px';
    el.style.top  = (d.y / 100 * window.innerHeight) + 'px';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════════════════════════════════════════
  private div(cls: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = cls;
    return el;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // STICKY NOTES
  // ══════════════════════════════════════════════════════════════════════════

  private spawnNote(clickX: number, clickY: number) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const x = Math.min(Math.max(10, clickX - 10), window.innerWidth  - 210);
    const y = Math.min(Math.max(10, clickY - 10), window.innerHeight - 170);

    const el = document.createElement('div');
    el.className = 'xp-sticky xp-sticky-editing';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.innerHTML = `
      <div class="xp-sticky-header">
        <span class="xp-sticky-author">${this.esc(this.userName)}</span>
        <button class="xp-sticky-close" title="Cancel">✕</button>
      </div>
      <textarea class="xp-sticky-input" placeholder="Write a note…" maxlength="200"></textarea>
      <div class="xp-sticky-hint">Enter to post · Esc to cancel</div>
    `;
    document.body.appendChild(el);

    const ta     = el.querySelector('.xp-sticky-input') as HTMLTextAreaElement;
    const cancel = el.querySelector('.xp-sticky-close') as HTMLButtonElement;
    ta.focus();

    this.makeNoteDraggable(el, id, false);

    let committed = false;
    const commit = () => {
      if (committed) return;
      const text = ta.value.trim();
      if (!text) { el.remove(); return; }
      committed = true;
      this.finaliseNote(el, id, text, false);
      if (this.room) {
        this.room.send('note:add', {
          id,
          text,
          x: parseInt(el.style.left),
          y: parseInt(el.style.top),
          author: this.userName,
        });
      }
    };

    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { el.remove(); }
    });
    cancel.addEventListener('click', () => el.remove());

    // Click outside → commit
    setTimeout(() => {
      const onOut = (e: PointerEvent) => {
        if (!el.contains(e.target as Node)) { commit(); document.removeEventListener('pointerdown', onOut, true); }
      };
      document.addEventListener('pointerdown', onOut, true);
    }, 200);
  }

  private finaliseNote(el: HTMLElement, id: string, text: string, isOwn: boolean) {
    el.classList.remove('xp-sticky-editing');
    const header = el.querySelector('.xp-sticky-header')!;
    const oldClose = header.querySelector('.xp-sticky-close');
    if (oldClose) oldClose.remove();
    // Replace textarea / hint with text
    el.querySelector('.xp-sticky-input')?.remove();
    el.querySelector('.xp-sticky-hint')?.remove();
    const body = document.createElement('div');
    body.className = 'xp-sticky-text';
    body.innerHTML = this.esc(text).replace(/\n/g, '<br>');
    el.appendChild(body);
    // Add delete button only for own notes
    if (isOwn || !isOwn) { // always show (only own notes reach here via renderNote with isOwn)
      const closeBtn = document.createElement('button');
      closeBtn.className = 'xp-sticky-close';
      closeBtn.title = 'Delete';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', () => {
        this.room?.send('note:delete', { id });
        el.remove();
        this.stickyNotes.delete(id);
        SoundManager.windowClose();
      });
      header.appendChild(closeBtn);
    }
    this.stickyNotes.set(id, el);
    this.makeNoteDraggable(el, id, true);
  }

  private renderNote(data: StickyNote) {
    // Deduplicate (server echoes back to all including sender)
    if (this.stickyNotes.has(data.id)) return;

    const el = document.createElement('div');
    el.className = 'xp-sticky';
    el.style.left = data.x + 'px';
    el.style.top  = data.y + 'px';
    el.style.setProperty('--note-accent', data.color || '#f0c000');
    el.innerHTML = `
      <div class="xp-sticky-header">
        <span class="xp-sticky-author">${this.esc(data.author || 'Player')}</span>
      </div>
      <div class="xp-sticky-text">${this.esc(data.text).replace(/\n/g, '<br>')}</div>
    `;
    document.body.appendChild(el);
    this.stickyNotes.set(data.id, el);

    const isOwn = this.room ? data.sessionId === this.room.sessionId : false;
    if (isOwn) {
      const header = el.querySelector('.xp-sticky-header')!;
      const btn = document.createElement('button');
      btn.className = 'xp-sticky-close'; btn.title = 'Delete'; btn.textContent = '✕';
      btn.addEventListener('click', () => {
        this.room?.send('note:delete', { id: data.id });
        el.remove(); this.stickyNotes.delete(data.id);
        SoundManager.windowClose();
      });
      header.appendChild(btn);
      this.makeNoteDraggable(el, data.id, true);
    }
  }

  private makeNoteDraggable(el: HTMLElement, id: string, sendOnDrop: boolean) {
    const header = el.querySelector('.xp-sticky-header') as HTMLElement;
    if (!header) return;
    header.style.cursor = 'move';
    let drag = false, ox = 0, oy = 0, sl = 0, st = 0;
    header.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).classList.contains('xp-sticky-close')) return;
      drag = true; ox = e.clientX; oy = e.clientY;
      sl = parseInt(el.style.left) || 0; st = parseInt(el.style.top) || 0;
      header.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    header.addEventListener('pointermove', e => {
      if (!drag) return;
      el.style.left = Math.max(0, Math.min(window.innerWidth  - 200, sl + e.clientX - ox)) + 'px';
      el.style.top  = Math.max(0, Math.min(window.innerHeight - 80,  st + e.clientY - oy)) + 'px';
    });
    header.addEventListener('pointerup', () => {
      if (!drag) return; drag = false;
      if (sendOnDrop && this.room) {
        this.room.send('note:move', { id, x: parseInt(el.style.left), y: parseInt(el.style.top) });
      }
    });
  }

  private cleanup() {
    if (this.clockTick) clearInterval(this.clockTick);
    if (this.touchHide) clearTimeout(this.touchHide);
    this.pCursors.forEach(el => el.remove());
    this.pCursors.clear();
    this.stickyNotes.forEach(el => el.remove());
    this.stickyNotes.clear();
    this.overlay?.remove();
    this.touchCursor?.remove();
    try { this.room?.leave(); } catch { /* ignore */ }
    this.room = null;
  }
}
