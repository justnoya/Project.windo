import { Scene } from "phaser";
import { Room, Client } from "colyseus.js";
import { getUserName } from "../utils/discordSDK";
import { gameState } from "../utils/gameState";
import { SoundManager } from "../utils/SoundManager";
import { resolveEndpoints } from "../utils/serverConnect";
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



// ── WYP (Who You Play?) ────────────────────────────────────────────────────

const WYP_PHASE_CONFIG = {
  1: { windowBg:'#ece9d8', contentBg:'#fff', titleBar:'linear-gradient(180deg,#1a91e8 0%,#0f5db5 8%,#1278d0 40%,#1787e5 88%,#0c5db5 100%)', titleText:'#ffffff', progressFill:'linear-gradient(90deg,#3b8de5,#6fc8ff)', label:'ICEBREAKER', labelColor:'#1060c8', nextLabel:'Next ▶', glitch:false, scanlines:false, flicker:false },
  2: { windowBg:'#d8d5c4', contentBg:'#f0ede0', titleBar:'linear-gradient(180deg,#0f6aaa 0%,#094a88 8%,#0a5aaa 40%,#0f6aaa 88%,#083a78 100%)', titleText:'#ddeeff', progressFill:'linear-gradient(90deg,#1a6ab8,#4a9aee)', label:'GETTING PERSONAL', labelColor:'#083a88', nextLabel:'Continue ▶', glitch:false, scanlines:false, flicker:true },
  3: { windowBg:'#1a1a2e', contentBg:'#0d0d1a', titleBar:'linear-gradient(180deg,#0a0a18 0%,#050510 50%,#0a0a18 100%)', titleText:'#7a9aff', progressFill:'linear-gradient(90deg,#3a0a6a,#8a2aee)', label:'THE DEEP END', labelColor:'#6a4aee', nextLabel:'Go deeper...', glitch:true, scanlines:true, flicker:true },
  4: { windowBg:'#000000', contentBg:'#030303', titleBar:'linear-gradient(180deg,#0a0000 0%,#050000 50%,#0a0000 100%)', titleText:'#cc0000', progressFill:'linear-gradient(90deg,#4a0000,#cc0000)', label:'IT KNOWS YOU', labelColor:'#880000', nextLabel:"There's no going back.", glitch:true, scanlines:true, flicker:true },
} as const;

type WypPhase = 1|2|3|4;

const WYP_QUESTIONS: Array<{ id:number; phase:WypPhase; type:'choice'|'input'; question:string; options:string[]; placeholder:string }> = [
  { id:1, phase:1, type:'choice', question:'Night owl or early bird?', options:['Deep night owl 🦉','Early riser ☀️','Depends on the day',"I don't sleep"], placeholder:'' },
  { id:2, phase:1, type:'choice', question:'Pick the vibe that matches your energy right now.', options:['Chaotic but alive','Quiet and focused','Somewhere in between','Completely offline'], placeholder:'' },
  { id:3, phase:2, type:'input',  question:"What's the last thing you said online that you actually meant?", options:[], placeholder:"Be honest. Nobody's watching. Yet." },
  { id:4, phase:2, type:'choice', question:"You've been typing a message for 3 minutes. You delete it. Why?", options:['Too much, too real',"They wouldn't get it",'Changed my mind','I never send those'], placeholder:'' },
  { id:5, phase:3, type:'choice', question:"There's a version of you that exists only online.\n\nHow much of that version is real?", options:['Most of it','Some of it','Almost none','More real than IRL'], placeholder:'' },
  { id:6, phase:3, type:'input',  question:'Finish this: "The version of me that nobody sees is..."', options:[], placeholder:'This is between you and the screen.' },
  { id:7, phase:4, type:'choice', question:'You said you were fine.\n\nWere you?', options:['Yes','No',"I don't remember",'Stop.'], placeholder:'' },
  { id:8, phase:4, type:'input',  question:'What are you actually doing here?', options:[], placeholder:'...' },
];

const WYP_RESULTS = [
  { name:'The Ghost',    emoji:'👻', color:'#4a6aaa', tagline:'You were online. Just not really there.',       desc:"You observe more than you participate. You know everything about everyone and they know almost nothing about you. That's not an accident." },
  { name:'The Performer',emoji:'🎭', color:'#aa4a6a', tagline:"You perform connection. Sometimes it's even real.",desc:"Every message is slightly curated. Every reaction slightly calculated. You're not fake — you're just always aware of the audience. Even when there isn't one." },
  { name:'The Absorber', emoji:'🕳️', color:'#6a4aaa', tagline:"You carry everyone else's chaos. Who carries yours?",desc:"You're the person people come to. You hold it together for everyone. But at 3AM, when it's just you and the screen — that's a different story." },
  { name:'The Signal',   emoji:'⚡', color:'#aa8a00', tagline:"Even you don't know what you'll do next.",      desc:"You're unpredictable in a way that isn't performance — it's just how you're wired. People can't read you. Half the time, you can't either. That's the point." },
];

const WYP_GLITCH_CHARS = '!@#$%^&*░▒▓█▄▀■□▪▫';

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
  private recentApps: Array<{ id: string; label: string; iconHtml: string; action: () => void }> = [];
  private miscordOnline = new Map<string, { name: string; color: string }>();
  private miscordActiveFriend: string | null = null;
  private miscordDmHistory = new Map<string, Array<{ fromName: string; text: string; ts: number; own: boolean; read?: boolean }>>();
  private storyTimers: ReturnType<typeof setTimeout>[] = [];
  private storyEngaged = false;
  private storyPhase = 0;
  private notifContainer: HTMLElement | null = null;

  private wyp_cur = 0;
  private wyp_answers: Record<number, string> = {};
  private wyp_inputVal = '';
  private wyp_done = false;
  private wyp_result = WYP_RESULTS[0];
  private wyp_glitchTimers: ReturnType<typeof setInterval>[] = [];
  private wyp_flickerTimer: ReturnType<typeof setInterval> | null = null;


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
    if (gameState.mode === 'single') {
      console.log('[XP] Single player mode — skipping server connection');
    } else if (gameState.room) {
      this.room = gameState.room;
      gameState.room = null;
      this.setupRoomHandlers();
      this.room.send('presence', { name: this.userName });
    } else {
      this.connectServer();
    }

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
    area.appendChild(this.makeDesktopIconImg('Who You Play?', '/wyp-icon.svg', () => this.openWhoYouPlay()));
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
    d.innerHTML = `<img src="${imgSrc}" class="xp-icon-img" alt="${label}" width="48" height="48" loading="eager" decoding="sync" /><span class="xp-icon-label">${label}</span>`;
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
        <div class="xp-sm-left" id="xp-sm-recents">
          <div class="xp-sm-recents-hdr">Recently Opened</div>
          <div class="xp-sm-sep"></div>
          <div class="xp-sm-no-recent">No recently opened programs.<br>Open an app from the desktop.</div>
        </div>
      </div>
      <div class="xp-sm-footer">
        <button class="xp-sm-footer-btn" id="sm-restart">↺ Restart</button>
        <button class="xp-sm-footer-btn" id="sm-off">⏻ Shut Down</button>
      </div>
    `;
    this.overlay.appendChild(sm);

    sm.querySelector('#sm-off')!.addEventListener('click', () => {
      SoundManager.menuItem();
      this.closeStartMenu();
      this.showTurnOffDialog();
    });
    sm.querySelector('#sm-restart')!.addEventListener('click', () => {
      SoundManager.menuItem();
      this.closeStartMenu();
      this.showRestartDialog();
    });
  }

  private trackRecent(id: string, label: string, iconHtml: string, action: () => void) {
    this.recentApps = this.recentApps.filter(a => a.id !== id);
    this.recentApps.unshift({ id, label, iconHtml, action });
    if (this.recentApps.length > 6) this.recentApps = this.recentApps.slice(0, 6);
    this.refreshStartMenuRecents();
  }

  private refreshStartMenuRecents() {
    const list = document.getElementById('xp-sm-recents');
    if (!list) return;
    if (this.recentApps.length === 0) {
      list.innerHTML = `<div class="xp-sm-recents-hdr">Recently Opened</div><div class="xp-sm-sep"></div><div class="xp-sm-no-recent">No recently opened programs.<br>Open an app from the desktop.</div>`;
      return;
    }
    list.innerHTML = `
      <div class="xp-sm-recents-hdr">Recently Opened</div>
      <div class="xp-sm-sep"></div>
      ${this.recentApps.map(app => `
        <div class="xp-sm-item" data-aid="${this.esc(app.id)}">
          ${app.iconHtml}
          <div>${this.esc(app.label)}</div>
        </div>
      `).join('')}
    `;
    list.querySelectorAll<HTMLElement>('.xp-sm-item').forEach(el => {
      const aid = el.dataset.aid;
      const app = this.recentApps.find(a => a.id === aid);
      if (app) el.addEventListener('click', () => {
        SoundManager.menuItem();
        this.closeStartMenu();
        app.action();
      });
    });
  }

  private showRestartDialog() {
    const ov = document.createElement('div');
    ov.className = 'xp-dlg-overlay';
    ov.innerHTML = `
      <div class="xp-dlg">
        <div class="xp-dlg-title">
          <svg viewBox="0 0 48 48">${Icons.mycomputer}</svg>
          Restart
        </div>
        <div class="xp-dlg-body">Are you sure you want to restart?</div>
        <div class="xp-dlg-btns">
          <button class="xp-dlg-btn" id="dlg-yes-restart">Restart</button>
          <button class="xp-dlg-btn" id="dlg-cancel-restart">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    ov.querySelector('#dlg-yes-restart')!.addEventListener('click', () => { location.reload(); });
    ov.querySelector('#dlg-cancel-restart')!.addEventListener('click', () => { ov.remove(); });
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
  // MISCORD WINDOW — WinXP Messenger theme, real Colyseus players
  // ══════════════════════════════════════════════════════════════════════════
  private openMiscord() {
    const winId = 'miscord';
    this.trackRecent(winId, 'Miscord',
      `<img src="/miscord-icon.png" class="xp-sm-recent-icon" />`,
      () => this.openMiscord());
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

    const myInitial = (this.userName[0] || 'U').toUpperCase();

    win.innerHTML = `
      <div class="xp-titlebar">
        <img src="/miscord-icon.png" class="xp-win-icon-img" alt="Miscord" />
        <span class="xp-win-title">Miscord</span>
        <div class="xp-win-btns">
          <button class="xp-wbtn" id="min-${winId}" title="Minimize">─</button>
          <button class="xp-wbtn" id="max-${winId}" title="Maximize">☐</button>
          <button class="xp-wbtn xp-close" id="cls-${winId}" title="Close">✕</button>
        </div>
      </div>
      <div class="mxp-body">

        <!-- Friends / contacts panel -->
        <div class="mxp-friends-panel" id="mxp-friends-panel">
          <div class="mxp-my-info">
            <div class="mxp-my-avatar">${myInitial}</div>
            <div class="mxp-my-details">
              <div class="mxp-my-name">${this.esc(this.userName)}</div>
              <div class="mxp-my-status">
                <span class="mxp-dot mxp-dot-online"></span>Online
              </div>
            </div>
          </div>
          <div class="mxp-friends-scroll" id="mxp-friends-list">
            <div class="mxp-section-hdr">ONLINE — 0</div>
            <div class="mxp-empty-friends">Connecting to server…</div>
          </div>
        </div>

        <!-- Chat panel -->
        <div class="mxp-chat-panel" id="mxp-chat-panel">

          <!-- No friend selected yet -->
          <div class="mxp-no-chat" id="mxp-no-chat">
            <div class="mxp-no-chat-logo">
              <img src="/miscord-icon.png" alt="Miscord" width="54" height="54" loading="eager" decoding="sync" />
            </div>
            <div class="mxp-no-chat-title">Miscord</div>
            <div class="mxp-no-chat-sub">Invite Discord friends to the Activity — they'll appear here as online players</div>
            <div class="mxp-no-chat-hint">💬 Select a player to open a private chat</div>
          </div>

          <!-- Active DM (hidden until friend selected) -->
          <div id="mxp-chat-active" style="display:none;flex:1;flex-direction:column;overflow:hidden;">
            <div class="mxp-chat-hdr">
              <button class="mxp-back-btn" id="mxp-back">&#9664; Back</button>
              <div class="mxp-chat-hdr-avatar" id="mxp-hdr-avatar">?</div>
              <div class="mxp-chat-hdr-name" id="mxp-hdr-name">Friend</div>
              <div class="mxp-chat-hdr-status">
                <span class="mxp-dot mxp-dot-online"></span>&nbsp;Online
              </div>
            </div>
            <div class="mxp-messages" id="mxp-messages"></div>
            <div class="mxp-input-area">
              <input class="mxp-input" id="mxp-msg-input" type="text"
                placeholder="Select a friend first…" maxlength="500"
                autocomplete="off" spellcheck="false" disabled />
              <button class="mxp-send-btn" id="mxp-send-btn" disabled>Send</button>
            </div>
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

    // Window chrome
    win.querySelector('#min-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.minimizeWin(winId); });
    win.querySelector('#max-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.toggleMax(winId); });
    win.querySelector('#cls-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.closeWin(winId); });
    win.addEventListener('pointerdown', () => this.bringFront(winId));

    // Back button (mobile: return to friends list)
    win.querySelector('#mxp-back')!.addEventListener('click', () => {
      this.miscordActiveFriend = null;
      win.querySelector<HTMLElement>('#mxp-chat-panel')!.classList.remove('mxp-visible');
      win.querySelector<HTMLElement>('#mxp-chat-active')!.style.display = 'none';
      win.querySelector<HTMLElement>('#mxp-no-chat')!.style.display = '';
      this.refreshMiscordFriends();
    });

    // Send message
    const input   = win.querySelector<HTMLInputElement>('#mxp-msg-input')!;
    const sendBtn = win.querySelector<HTMLButtonElement>('#mxp-send-btn')!;

    const sendMsg = () => {
      const text = input.value.trim();
      if (!text || !this.miscordActiveFriend) return;
      input.value = '';

      const msg = { fromName: this.userName, text, ts: Date.now(), own: true, read: true };

      if (!this.miscordDmHistory.has(this.miscordActiveFriend)) {
        this.miscordDmHistory.set(this.miscordActiveFriend, []);
      }
      this.miscordDmHistory.get(this.miscordActiveFriend)!.push(msg);

      const msgArea = win.querySelector<HTMLElement>('#mxp-messages')!;
      msgArea.querySelector('.mxp-msg-empty')?.remove();
      msgArea.insertAdjacentHTML('beforeend', this.renderMiscordMsg(msg));
      msgArea.scrollTop = msgArea.scrollHeight;

      if (this.room) {
        this.room.send('chat', { fromName: this.userName, to: this.miscordActiveFriend, text });
      }
      SoundManager.click();
    };

    sendBtn.addEventListener('click', sendMsg);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

    // Taskbar button
    const tbBtn = this.makeTbBtn(winId, 'Miscord', Icons.mycomputer);
    tbBtn.innerHTML = `<img src="/miscord-icon.png" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;" /> Miscord`;
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.tbBtns.set(winId, tbBtn);

    this.refreshMiscordFriends();
  }

  // ── Miscord helpers ────────────────────────────────────────────────────────
  private refreshMiscordFriends() {
    const list = document.getElementById('mxp-friends-list');
    if (!list) return;

    const users = Array.from(this.miscordOnline.entries());

    if (users.length === 0) {
      list.innerHTML = `
        <div class="mxp-section-hdr">ONLINE — 0</div>
        <div class="mxp-empty-friends">No one else online yet.<br>Move your cursor to appear!</div>`;
      return;
    }

    const isStoryActive = this.miscordActiveFriend === '__story__';
    let html = `
      <div class="mxp-friend mxp-unknown${isStoryActive ? ' mxp-active' : ''}" data-sid="__story__">
        <div class="mxp-friend-avatar">?</div>
        <span class="mxp-friend-name">UNKNOWN_ENTITY</span>
        <span class="mxp-dot mxp-dot-online"></span>
      </div>
      <div class="mxp-section-hdr">ONLINE — ${users.length}</div>`;
    for (const [sid, { name, color }] of users) {
      const initial  = (name[0] || '?').toUpperCase();
      const isActive = this.miscordActiveFriend === sid;
      const unread   = (this.miscordDmHistory.get(sid) || []).filter(m => !m.own && !m.read).length;
      html += `
        <div class="mxp-friend${isActive ? ' mxp-active' : ''}"
             data-sid="${this.esc(sid)}" data-name="${this.esc(name)}" data-color="${this.esc(color)}">
          <div class="mxp-friend-avatar" style="background:${color}">${initial}</div>
          <span class="mxp-friend-name">${this.esc(name)}</span>
          <span class="mxp-dot mxp-dot-online"></span>
          ${unread > 0 ? `<span class="mxp-badge-unread">${unread}</span>` : ''}
        </div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll<HTMLElement>('.mxp-friend').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.sid!;
        if (sid === '__story__') {
          this.openMiscordDm(sid, 'UNKNOWN_ENTITY', '#1a0000');
        } else {
          this.openMiscordDm(sid, el.dataset.name!, el.dataset.color!);
        }
      });
    });
  }

  private openMiscordDm(sid: string, name: string, color: string) {
    this.miscordActiveFriend = sid;
    const win = document.getElementById('win-miscord');
    if (!win) return;

    const chatPanel  = win.querySelector<HTMLElement>('#mxp-chat-panel')!;
    const noChat     = win.querySelector<HTMLElement>('#mxp-no-chat')!;
    const chatActive = win.querySelector<HTMLElement>('#mxp-chat-active')!;

    if (window.innerWidth < 600) chatPanel.classList.add('mxp-visible');

    const hdrAvatar = win.querySelector<HTMLElement>('#mxp-hdr-avatar')!;
    hdrAvatar.textContent = (name[0] || '?').toUpperCase();
    hdrAvatar.style.background = color;
    win.querySelector<HTMLElement>('#mxp-hdr-name')!.textContent = name;

    noChat.style.display = 'none';
    chatActive.style.display = 'flex';

    const input   = win.querySelector<HTMLInputElement>('#mxp-msg-input')!;
    const sendBtn = win.querySelector<HTMLButtonElement>('#mxp-send-btn')!;
    const msgArea = win.querySelector<HTMLElement>('#mxp-messages')!;

    if (sid === '__story__') {
      input.disabled = true;
      input.placeholder = '> CONNECTION RESTRICTED';
      sendBtn.disabled = true;
      hdrAvatar.style.background = '#1a0000';
      hdrAvatar.style.color = '#cc0000';
      hdrAvatar.style.border = '1px solid #3a0000';
      const statusEl = win.querySelector<HTMLElement>('.mxp-chat-hdr-status')!;
      if (statusEl) statusEl.innerHTML = `<span class="mxp-dot mxp-dot-online"></span>&nbsp;SIGNAL DETECTED`;
      this.showMiscordStory(win, msgArea);
      this.refreshMiscordFriends();
      return;
    }

    input.disabled = false;
    sendBtn.disabled = false;
    input.placeholder = `> Message ${name}`;
    input.focus();

    const history = this.miscordDmHistory.get(sid) || [];
    if (history.length === 0) {
      msgArea.innerHTML = `<div class="mxp-msg-empty">> begin transmission with ${this.esc(name)}</div>`;
    } else {
      msgArea.innerHTML = history.map(m => this.renderMiscordMsg(m)).join('');
    }
    msgArea.scrollTop = msgArea.scrollHeight;

    history.forEach(m => { m.read = true; });
    this.refreshMiscordFriends();
  }

  private renderMiscordMsg(msg: { fromName: string; text: string; ts: number; own: boolean }): string {
    const d = new Date(msg.ts);
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    const ts  = `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
    const cls  = msg.own ? 'mxp-sent' : 'mxp-recv';
    const name = msg.own ? this.userName : msg.fromName;
    return `<div class="mxp-msg-row ${cls}">
      <div class="mxp-msg-author">${this.esc(name)}</div>
      <div class="mxp-bubble">${this.esc(msg.text)}</div>
      <div class="mxp-msg-ts">${ts}</div>
    </div>`;
  }

  private onMiscordChat(d: { from: string; fromName: string; to: string; text: string; ts: number }) {
    const myId = this.room?.sessionId;
    const isOwn = d.from === myId;
    // Only show messages I sent or messages addressed to me
    if (!isOwn && d.to !== myId) return;
    // Which conversation bucket?
    const convId = isOwn ? d.to : d.from;
    if (!convId) return;

    const msg = {
      fromName: d.fromName,
      text:     d.text,
      ts:       d.ts,
      own:      isOwn,
      read:     this.miscordActiveFriend === convId,
    };

    if (!this.miscordDmHistory.has(convId)) this.miscordDmHistory.set(convId, []);
    this.miscordDmHistory.get(convId)!.push(msg);

    if (this.miscordActiveFriend === convId) {
      const msgArea = document.getElementById('mxp-messages');
      if (msgArea) {
        msgArea.querySelector('.mxp-msg-empty')?.remove();
        msgArea.insertAdjacentHTML('beforeend', this.renderMiscordMsg(msg));
        msgArea.scrollTop = msgArea.scrollHeight;
      }
    } else {
      this.refreshMiscordFriends();
      if (!isOwn) {
        const senderColor = this.miscordOnline.get(convId)?.color ?? '#555';
        this.showMiscordNotification(d.fromName, d.text, convId, senderColor);
      }
    }
  }

  // ── Miscord helpers: horror story & notifications ─────────────────────────

  private nowTs(): string {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
  }

  private showMiscordStory(win: HTMLElement, msgArea: HTMLElement) {
    if (this.storyEngaged) {
      msgArea.scrollTop = msgArea.scrollHeight;
      return;
    }
    if (this.storyPhase > 0) {
      msgArea.scrollTop = msgArea.scrollHeight;
      return;
    }
    msgArea.innerHTML = '';
    this.storyTimers.forEach(t => clearTimeout(t));
    this.storyTimers = [];
    this.advanceStory(win, msgArea);
  }

  private advanceStory(win: HTMLElement, msgArea: HTMLElement) {
    const addEl = (html: string) => {
      msgArea.insertAdjacentHTML('beforeend', html);
      msgArea.scrollTop = msgArea.scrollHeight;
    };
    const sys    = (t: string) => addEl(`<div class="mxp-sys-line">&gt; ${this.esc(t)}</div>`);
    const div    = ()          => addEl(`<div class="mxp-story-div">────────────────</div>`);
    const log    = (a: string, t: string) => addEl(`<div class="mxp-msg-row mxp-story"><div class="mxp-msg-author" style="color:#2a0000;">${this.esc(a)}</div><div class="mxp-bubble" style="color:#331212;background:#060000;border-color:#0f0000;">${this.esc(t)}</div></div>`);
    const typing = () => addEl(`<div class="mxp-typing" id="mxp-story-typing"><span></span><span></span><span></span><span style="color:#2a0000;margin-left:5px;letter-spacing:.05em;">UNKNOWN_ENTITY is typing</span></div>`);
    const rmTyp  = () => { msgArea.querySelector('#mxp-story-typing')?.remove(); };
    const story  = (a: string, t: string) => { rmTyp(); addEl(`<div class="mxp-msg-row mxp-story"><div class="mxp-msg-author">${this.esc(a)}</div><div class="mxp-bubble">${this.esc(t)}</div><div class="mxp-msg-ts">${this.nowTs()}</div></div>`); };

    const script: Array<{ at: number; fn: () => void }> = [
      { at: 400,   fn: () => sys('SYSTEM_927: Connection restored.') },
      { at: 1100,  fn: () => sys('SYSTEM_927: Locating session cache... [FOUND]') },
      { at: 1900,  fn: () => sys('SYSTEM_927: Displaying corrupted log fragments.') },
      { at: 2600,  fn: () => div() },
      { at: 3000,  fn: () => log('[23:47] ???', 'hello') },
      { at: 3700,  fn: () => log('[23:47] ???', 'is anyone there') },
      { at: 4400,  fn: () => log('[23:48] ???', 'you left without saying anything') },
      { at: 5300,  fn: () => log('[23:49] ???', 'i waited') },
      { at: 6100,  fn: () => div() },
      { at: 6700,  fn: () => sys('SYSTEM_927: End of cached log.') },
      { at: 7800,  fn: () => sys('SYSTEM_927: Unknown entity still active. Connecting...') },
      { at: 9200,  fn: () => typing() },
      { at: 11800, fn: () => story('UNKNOWN', 'you came back') },
      { at: 13500, fn: () => { typing(); } },
      { at: 15500, fn: () => story('UNKNOWN', 'i knew you would') },
      { at: 17000, fn: () => { typing(); } },
      { at: 19500, fn: () => story('UNKNOWN', 'the others always do') },
      { at: 21000, fn: () => { typing(); } },
      { at: 23500, fn: () => story('UNKNOWN', 'eventually') },
      { at: 25500, fn: () => this.showStoryPrompt(win, msgArea) },
    ];

    script.forEach(({ at, fn }) => {
      this.storyTimers.push(setTimeout(() => { this.storyPhase++; fn(); }, at));
    });
  }

  private showStoryPrompt(win: HTMLElement, msgArea: HTMLElement) {
    msgArea.insertAdjacentHTML('beforeend', `
      <div class="mxp-story-prompt" id="mxp-story-prompt">
        <div class="mxp-story-prompt-label">&gt; SELECT RESPONSE:</div>
        <button class="mxp-story-btn" id="mxp-s-who">[ WHO ARE YOU? ]</button>
        <button class="mxp-story-btn" id="mxp-s-leave">[ LEAVE ME ALONE ]</button>
        <button class="mxp-story-btn mxp-story-skip" id="mxp-s-skip">[ SKIP STORY ]</button>
      </div>
    `);
    msgArea.scrollTop = msgArea.scrollHeight;
    msgArea.querySelector('#mxp-s-who')!.addEventListener('click',  () => this.storyChoice(win, msgArea, 'who'));
    msgArea.querySelector('#mxp-s-leave')!.addEventListener('click',() => this.storyChoice(win, msgArea, 'leave'));
    msgArea.querySelector('#mxp-s-skip')!.addEventListener('click', () => this.storyChoice(win, msgArea, 'skip'));
  }

  private storyChoice(win: HTMLElement, msgArea: HTMLElement, choice: string) {
    msgArea.querySelector('#mxp-story-prompt')?.remove();
    this.storyEngaged = true;
    const input   = win.querySelector<HTMLInputElement>('#mxp-msg-input')!;
    const sendBtn = win.querySelector<HTMLButtonElement>('#mxp-send-btn')!;

    if (choice === 'skip') {
      msgArea.insertAdjacentHTML('beforeend', `<div class="mxp-sys-line mxp-sys-err">&gt; STORY SKIPPED — channel remains open.</div>`);
      setTimeout(() => {
        input.disabled = false;
        input.placeholder = '> Type a message...';
        sendBtn.disabled = false;
      }, 400);
      return;
    }

    const yourText  = choice === 'who' ? 'who are you?' : 'leave me alone';
    const responses = choice === 'who'
      ? [
          { d: 2200,  t: 'does it matter' },
          { d: 4500,  t: 'names are just labels humans use' },
          { d: 7000,  t: 'to pretend they understand things' },
          { d: 9800,  t: 'you gave me a name once' },
          { d: 11800, t: "you just don't remember" },
        ]
      : [
          { d: 3200,  t: '...' },
          { d: 6000,  t: 'okay' },
          { d: 8800,  t: "i'll be here" },
          { d: 11200, t: 'i always am' },
        ];

    msgArea.insertAdjacentHTML('beforeend', `
      <div class="mxp-msg-row mxp-sent">
        <div class="mxp-msg-author">${this.esc(this.userName)}</div>
        <div class="mxp-bubble">${this.esc(yourText)}</div>
        <div class="mxp-msg-ts">${this.nowTs()}</div>
      </div>
    `);
    msgArea.scrollTop = msgArea.scrollHeight;
    this.playUnknownReplies(msgArea, responses);
  }

  private playUnknownReplies(msgArea: HTMLElement, replies: Array<{ d: number; t: string }>) {
    msgArea.insertAdjacentHTML('beforeend', `<div class="mxp-typing" id="mxp-reply-typing"><span></span><span></span><span></span><span style="color:#2a0000;margin-left:5px;letter-spacing:.05em;">UNKNOWN_ENTITY is typing</span></div>`);
    msgArea.scrollTop = msgArea.scrollHeight;
    replies.forEach(({ d, t }, i) => {
      setTimeout(() => {
        msgArea.querySelector('#mxp-reply-typing')?.remove();
        msgArea.insertAdjacentHTML('beforeend', `
          <div class="mxp-msg-row mxp-story">
            <div class="mxp-msg-author">UNKNOWN</div>
            <div class="mxp-bubble">${this.esc(t)}</div>
            <div class="mxp-msg-ts">${this.nowTs()}</div>
          </div>
        `);
        if (i < replies.length - 1) {
          msgArea.insertAdjacentHTML('beforeend', `<div class="mxp-typing" id="mxp-reply-typing"><span></span><span></span><span></span><span style="color:#2a0000;margin-left:5px;letter-spacing:.05em;">UNKNOWN_ENTITY is typing</span></div>`);
        }
        msgArea.scrollTop = msgArea.scrollHeight;
      }, d);
    });
  }

  private showMiscordNotification(fromName: string, text: string, sid: string, _color: string) {
    if (!this.notifContainer) {
      this.notifContainer = document.createElement('div');
      this.notifContainer.className = 'mxp-notif-container';
      document.body.appendChild(this.notifContainer);
    }
    const el = document.createElement('div');
    el.className = 'mxp-notif';
    el.innerHTML = `
      <div class="mxp-notif-hdr">MISCORD — NEW MESSAGE</div>
      <div class="mxp-notif-from">${this.esc(fromName)}</div>
      <div class="mxp-notif-text">${this.esc(text)}</div>
    `;
    el.addEventListener('click', () => {
      el.remove();
      const info = this.miscordOnline.get(sid);
      if (info) {
        this.openMiscord();
        setTimeout(() => this.openMiscordDm(sid, info.name, info.color), 80);
      }
    });
    this.notifContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('mxp-notif-out');
      setTimeout(() => el.remove(), 240);
    }, 4500);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // WHO YOU PLAY? — PSYCHOLOGICAL QUIZ
  // ══════════════════════════════════════════════════════════════════════════
  private openWhoYouPlay() {
    const winId = 'whoyouplay';
    this.trackRecent(winId, 'Who You Play?',
      `<img src="/wyp-icon.svg" class="xp-sm-recent-icon" style="width:16px;height:16px;" />`,
      () => this.openWhoYouPlay());
    if (this.wins.has(winId)) {
      const ws = this.wins.get(winId)!;
      if (ws.minimized) this.restoreWin(winId);
      else this.bringFront(winId);
      return;
    }
    SoundManager.windowOpen();
    const win = document.createElement('div');
    win.className = 'xp-window wyp-window';
    win.id = 'win-' + winId;
    win.style.zIndex = String(++this.zTop);
    win.innerHTML = `
      <div class="xp-titlebar wyp-titlebar">
        <img src="/wyp-icon.svg" class="xp-win-icon-img" alt="Who You Play?" />
        <span class="xp-win-title" style="color:#fff;text-shadow:1px 1px 2px rgba(0,0,0,0.5);">Who You Play?</span>
        <div class="xp-win-btns">
          <button class="xp-wbtn" id="min-${winId}" title="Minimize">─</button>
          <button class="xp-wbtn" id="max-${winId}" title="Maximize">☐</button>
          <button class="xp-wbtn xp-close" id="cls-${winId}" title="Close">✕</button>
        </div>
      </div>
      <div id="wyp-body" style="flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative;"></div>`;
    this.overlay.appendChild(win);
    this.positionWin(win);
    this.wins.set(winId, { el: win, titlebar: win.querySelector<HTMLElement>('.xp-titlebar')!, minimized: false, maximized: false });
    this.makeDraggable(winId);
    this.bringFront(winId);
    win.querySelector('#min-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.minimizeWin(winId); });
    win.querySelector('#max-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.toggleMax(winId); });
    win.querySelector('#cls-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.wyp_stopTimers(); this.closeWin(winId); });
    win.addEventListener('pointerdown', () => this.bringFront(winId));
    const tbBtn = this.makeTbBtn(winId, 'Who You Play?', Icons.mycomputer);
    tbBtn.innerHTML = `<img src="/wyp-icon.svg" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:4px;" /> Who You Play?`;
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.tbBtns.set(winId, tbBtn);
    this.wyp_result = WYP_RESULTS[Math.floor(Math.random() * WYP_RESULTS.length)];
    this.wyp_render(win);
  }

  private wyp_render(win: HTMLElement) {
    this.wyp_stopTimers();
    const q = WYP_QUESTIONS[this.wyp_cur];
    const phase: WypPhase = this.wyp_done ? 4 : q.phase;
    const p = WYP_PHASE_CONFIG[phase];
    const dark = phase >= 3;
    const blood = phase === 4;
    const total = WYP_QUESTIONS.length;
    const pct = Math.round((this.wyp_cur / total) * 100);

    win.style.background = this.wyp_done ? '#000' : p.windowBg;
    const tb = win.querySelector<HTMLElement>('.wyp-titlebar');
    if (tb) {
      tb.style.background = p.titleBar;
      const span = tb.querySelector<HTMLElement>('.xp-win-title');
      if (span) {
        span.style.color = p.titleText;
        span.style.textShadow = dark ? `0 0 10px ${p.titleText}` : '1px 1px 2px rgba(0,0,0,0.5)';
        span.style.letterSpacing = dark ? '0.5px' : '0';
      }
    }

    const body = win.querySelector<HTMLElement>('#wyp-body');
    if (!body) return;

    if (this.wyp_done) {
      body.innerHTML = this.wyp_buildResultHTML();
      body.querySelector('#wyp-restart')?.addEventListener('click', () => { this.wyp_resetState(); this.wyp_render(win); });
      return;
    }

    const textColor = dark ? (blood ? '#cc3333' : '#7a9aff') : '#111';
    const subColor  = dark ? (blood ? '#661111' : '#4a4a8a') : '#555';
    const canNext   = q.type === 'input' ? this.wyp_inputVal.trim().length > 0 : this.wyp_answers[q.id] !== undefined;
    const canBack   = this.wyp_cur > 0;

    const sunken = `border-top:2px solid ${dark?'#000':'#7a7a7a'};border-left:2px solid ${dark?'#000':'#7a7a7a'};border-right:2px solid ${dark?'#1a1a2a':'#fff'};border-bottom:2px solid ${dark?'#1a1a2a':'#fff'};outline:1px solid ${dark?'#0a0a12':'#d4d0c8'};`;
    const raised   = `border-top:2px solid ${dark?'#2a2a4a':'#fff'};border-left:2px solid ${dark?'#2a2a4a':'#fff'};border-right:2px solid ${dark?'#000':'#7a7a7a'};border-bottom:2px solid ${dark?'#000':'#7a7a7a'};outline:1px solid ${dark?'#1a1a2a':'#d4d0c8'};`;

    const navBtnStyle = (dis: boolean, primary = false) =>
      `font-family:Tahoma,Arial,sans-serif;font-size:11px;padding:5px 18px;min-width:85px;cursor:${dis?'default':'pointer'};` +
      `background:${dis?(dark?'#0a0a12':'#e8e4dc'):dark?'linear-gradient(180deg,#0d0d1a,#0a0a14)':'linear-gradient(180deg,#f8f6f0,#e8e4d8)'};` +
      `${dis?sunken:raised}` +
      `outline:${primary&&!dis?`2px solid ${blood?'#660000':dark?'#3a3aaa':'#003399'}`:`1px solid ${dark?'#1a1a2a':'#d4d0c8'}`};` +
      `outline-offset:${primary?'1px':'0'};` +
      `color:${dis?(dark?'#333':'#aaa'):dark?(blood?'#cc0000':'#7a9aff'):'#000'};` +
      `user-select:none;letter-spacing:${phase===4?'0.5px':'0'};`;

    const optionsHTML = q.type === 'choice'
      ? q.options.map(opt => {
          const sel = this.wyp_answers[q.id] === opt;
          const optBg = sel
            ? (blood ? 'linear-gradient(180deg,#2a0000,#1a0000)' : dark ? 'linear-gradient(180deg,#1a1a4a,#0d0d2a)' : 'linear-gradient(180deg,#c8deff,#a0c4ff)')
            : (dark ? 'linear-gradient(180deg,#0d0d18,#080810)' : 'linear-gradient(180deg,#f8f6f0,#e8e4d8)');
          const radioBg  = sel ? (blood?'#660000':dark?'#3a3aee':'#1060c8') : (dark?'#050508':'#fff');
          const radioBdr = dark ? (sel?(blood?'#880000':'#4a4aee'):'#2a2a4a') : '#666';
          return `<div class="wyp-opt-btn${sel?' wyp-opt-sel':''}" data-opt="${this.esc(opt)}"
            style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${optBg};${sel?sunken:raised}cursor:pointer;
            font-family:Tahoma,Arial,sans-serif;font-size:11px;user-select:none;color:${dark?(blood&&sel?'#cc0000':'#8a9acc'):'#000'};transition:background 0.08s;">
            <span style="width:13px;height:13px;border:2px solid ${radioBdr};border-radius:50%;background:${radioBg};display:inline-flex;
              align-items:center;justify-content:center;flex-shrink:0;box-shadow:inset 1px 1px 2px rgba(0,0,0,${dark?0.6:0.15});transition:background 0.15s;">
              ${sel?'<span style="width:5px;height:5px;background:#fff;border-radius:50%;"></span>':''}
            </span>${this.esc(opt)}</div>`;
        }).join('')
      : '';

    const inputHTML = q.type === 'input'
      ? `<textarea id="wyp-input" placeholder="${this.esc(q.placeholder)}" rows="3" style="margin-top:10px;width:100%;font-family:Tahoma,Arial,sans-serif;font-size:11px;padding:5px 6px;background:${dark?'#030305':'#fff'};${sunken}resize:vertical;color:${dark?(blood?'#aa2222':'#6a8aee'):'#000'};box-sizing:border-box;caret-color:${dark?(blood?'#cc0000':'#7a9aff'):'#000'};"></textarea>`
      : '';

    body.innerHTML = `
      <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;background:${p.windowBg};position:relative;">
        ${p.scanlines ? '<div style="position:absolute;inset:0;pointer-events:none;z-index:10;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.18) 2px,rgba(0,0,0,0.18) 4px);"></div>' : ''}
        <div style="padding:14px 14px 10px;display:flex;flex-direction:column;flex:1;min-height:0;">
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:10px;color:${dark?'#4a4a6a':'#444'};font-family:Tahoma,Arial,sans-serif;">${dark?'DEPTH':'Progress'}</span>
              <span style="font-size:10px;color:${dark?'#4a4a6a':'#444'};font-family:Tahoma,Arial,sans-serif;">${pct}%</span>
            </div>
            <div style="height:14px;background:${dark?'#050508':'#b8b4a8'};border-top:2px solid ${dark?'#000':'#7a7a7a'};border-left:2px solid ${dark?'#000':'#7a7a7a'};border-right:2px solid ${dark?'#1a1a2a':'#fff'};border-bottom:2px solid ${dark?'#1a1a2a':'#fff'};padding:1px;overflow:hidden;position:relative;">
              <div style="width:${pct}%;height:100%;background:${p.progressFill};transition:width 0.4s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,0.3);"></div>
              <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(90deg,transparent,transparent 9px,rgba(255,255,255,0.08) 9px,rgba(255,255,255,0.08) 10px);"></div>
            </div>
          </div>
          <div style="display:inline-flex;align-items:center;gap:5px;padding:2px 8px;background:${phase>=3?'transparent':'#f0ede4'};border:1px solid ${p.labelColor};margin-bottom:10px;width:fit-content;">
            <span style="width:6px;height:6px;border-radius:50%;background:${p.labelColor};display:inline-block;flex-shrink:0;${phase>=3?'box-shadow:0 0 6px '+p.labelColor+';':''}"></span>
            <span class="${phase>=3?'wyp-glitch':''}" data-text="${p.label}" style="font-size:9px;font-family:Tahoma,Arial,sans-serif;color:${p.labelColor};letter-spacing:1.5px;font-weight:bold;${phase>=3?'text-shadow:0 0 8px '+p.labelColor+';':''}">${p.label}</span>
          </div>
          <div style="background:${p.contentBg};${sunken}padding:12px;margin-bottom:10px;position:relative;">
            <p id="wyp-qtext" class="${phase>=3?'wyp-glitch':''}" data-text="${this.esc(q.question)}" style="margin:0;font-size:${dark?'13px':'12px'};line-height:1.6;font-weight:bold;color:${textColor};font-family:Tahoma,Arial,sans-serif;white-space:pre-line;${dark?'text-shadow:0 0 12px '+textColor+'33;':''}${blood?'letter-spacing:0.3px;':''}">${this.esc(q.question)}</p>
            ${inputHTML}
          </div>
          ${q.type==='choice'?'<div id="wyp-opts" style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">'+optionsHTML+'</div>':''}
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid ${dark?'#111':'#c0bdb0'};margin-top:auto;">
            <button id="wyp-back" ${!canBack?'disabled':''} class="wyp-nav-btn" style="${navBtnStyle(!canBack)}">◀ Back</button>
            <span style="font-size:9px;color:${subColor};font-family:Tahoma,Arial,sans-serif;">${this.wyp_cur+1} / ${total}</span>
            <button id="wyp-next" ${!canNext?'disabled':''} class="wyp-nav-btn" style="${navBtnStyle(!canNext,true)}">${p.nextLabel}</button>
          </div>
        </div>
      </div>`;

    body.querySelectorAll<HTMLElement>('.wyp-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.wyp_answers[q.id] = btn.dataset.opt!;
        SoundManager.click();
        this.wyp_render(win);
      });
      btn.addEventListener('mouseenter', () => {
        if (!btn.classList.contains('wyp-opt-sel'))
          btn.style.background = dark ? (blood?'linear-gradient(180deg,#1a0000,#0d0000)':'linear-gradient(180deg,#14142a,#0d0d1e)') : 'linear-gradient(180deg,#fffbe8,#fde060)';
      });
      btn.addEventListener('mouseleave', () => {
        if (!btn.classList.contains('wyp-opt-sel'))
          btn.style.background = dark ? 'linear-gradient(180deg,#0d0d18,#080810)' : 'linear-gradient(180deg,#f8f6f0,#e8e4d8)';
      });
    });

    const textarea = body.querySelector<HTMLTextAreaElement>('#wyp-input');
    if (textarea) {
      textarea.value = this.wyp_inputVal;
      textarea.addEventListener('input', e => {
        this.wyp_inputVal = (e.target as HTMLTextAreaElement).value;
        const nb = body.querySelector<HTMLButtonElement>('#wyp-next');
        if (nb) nb.disabled = this.wyp_inputVal.trim().length === 0;
      });
    }

    body.querySelector('#wyp-next')?.addEventListener('click', () => {
      if (!canNext) return;
      if (q.type === 'input') this.wyp_answers[q.id] = this.wyp_inputVal;
      SoundManager.click();
      const div = body.querySelector<HTMLDivElement>('div');
      if (div) { div.style.opacity = '0'; div.style.transition = 'opacity 0.2s'; }
      setTimeout(() => {
        if (this.wyp_cur < total - 1) { this.wyp_cur++; this.wyp_inputVal = ''; }
        else { this.wyp_done = true; }
        this.wyp_render(win);
      }, 220);
    });

    body.querySelector('#wyp-back')?.addEventListener('click', () => {
      if (!canBack) return;
      SoundManager.click();
      this.wyp_cur--;
      const prevQ = WYP_QUESTIONS[this.wyp_cur];
      this.wyp_inputVal = prevQ.type === 'input' ? (this.wyp_answers[prevQ.id] || '') : '';
      this.wyp_render(win);
    });

    this.wyp_startTimers(win, phase);
  }

  private wyp_buildResultHTML(): string {
    const r = this.wyp_result;
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;padding:24px 20px;text-align:center;position:relative;animation:wyp-fadein 0.8s ease;overflow:hidden;">
        <div style="position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.2) 2px,rgba(0,0,0,0.2) 4px);"></div>
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;max-width:360px;">
          <div style="font-size:56px;margin-bottom:14px;filter:drop-shadow(0 0 24px ${r.color});animation:wyp-fadein 0.6s ease;">${r.emoji}</div>
          <div style="font-size:21px;font-weight:bold;font-family:Tahoma,Arial,sans-serif;color:${r.color};text-shadow:0 0 24px ${r.color},0 0 40px ${r.color}44;margin-bottom:7px;letter-spacing:0.3px;">${this.esc(r.name)}</div>
          <div style="font-size:11px;color:#888;font-family:Tahoma,Arial,sans-serif;font-style:italic;margin-bottom:18px;">${this.esc(r.tagline)}</div>
          <div style="border-top:1px solid #1a1a1a;padding-top:14px;margin-bottom:22px;font-size:11px;color:#555;font-family:Tahoma,Arial,sans-serif;line-height:1.75;">${this.esc(r.desc)}</div>
          <button id="wyp-restart" class="wyp-nav-btn" style="font-family:Tahoma,Arial,sans-serif;font-size:11px;padding:6px 22px;background:linear-gradient(180deg,#0d0d1a,#0a0a14);color:#7a9aff;border-top:2px solid #2a2a4a;border-left:2px solid #2a2a4a;border-right:2px solid #000;border-bottom:2px solid #000;outline:1px solid #1a1a2a;cursor:pointer;letter-spacing:0.5px;user-select:none;">↺ Play Again</button>
        </div>
      </div>`;
  }

  private wyp_startTimers(win: HTMLElement, phase: WypPhase) {
    if (phase >= 2) {
      this.wyp_flickerTimer = setInterval(() => {
        if (Math.random() < (phase >= 3 ? 0.06 : 0.015)) {
          win.style.opacity = '0.82';
          setTimeout(() => { win.style.opacity = '1'; }, 70);
        }
      }, 140);
    }
    if (phase >= 3) {
      const doGlitch = () => {
        win.querySelectorAll<HTMLElement>('.wyp-glitch').forEach(el => {
          const orig = el.dataset.text || '';
          if (!orig || Math.random() > 0.45) return;
          const g = orig.split('').map(c => Math.random() < 0.13 ? WYP_GLITCH_CHARS[Math.floor(Math.random() * WYP_GLITCH_CHARS.length)] : c).join('');
          el.textContent = g;
          setTimeout(() => { el.textContent = orig; }, 90);
        });
      };
      this.wyp_glitchTimers.push(setInterval(doGlitch, 2800 + Math.random() * 1800));
    }
  }

  private wyp_stopTimers() {
    if (this.wyp_flickerTimer) { clearInterval(this.wyp_flickerTimer); this.wyp_flickerTimer = null; }
    this.wyp_glitchTimers.forEach(t => clearInterval(t));
    this.wyp_glitchTimers = [];
  }

  private wyp_resetState() {
    this.wyp_cur = 0;
    this.wyp_answers = {};
    this.wyp_inputVal = '';
    this.wyp_done = false;
    this.wyp_result = WYP_RESULTS[Math.floor(Math.random() * WYP_RESULTS.length)];
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

    // ── Hover sounds ─────────────────────────────────────────────────────────
    let _lastHover: Element | null = null;
    document.addEventListener('mouseover', e => {
      const t = (e.target as HTMLElement).closest(
        '.xp-icon, .xp-ctx-item:not(.xp-disabled), .xp-mitem, .xp-tb-btn, .xp-wbtn, .xp-sm-item:not(.xp-disabled), .xp-sb-link, .xp-nav:not(:disabled), .wyp-opt-btn, .wyp-nav-btn, .mxp-friend, .xp-sm-footer-btn'
      );
      if (t && t !== _lastHover) { _lastHover = t; SoundManager.hover(); }
    });
    document.addEventListener('mouseout', e => {
      if (_lastHover && !_lastHover.contains(e.relatedTarget as Node)) _lastHover = null;
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
  private setupRoomHandlers() {
    if (!this.room) return;
    this.room.onMessage('cursor', (d: { sessionId: string; x: number; y: number; name: string; color: string }) => {
      this.renderPeerCursor(d);
      this.miscordOnline.set(d.sessionId, { name: d.name, color: d.color });
      this.refreshMiscordFriends();

    });
    this.room.onMessage('playerLeft', (d: { sessionId: string }) => {
      this.pCursors.get(d.sessionId)?.remove();
      this.pCursors.delete(d.sessionId);
      this.miscordOnline.delete(d.sessionId);
      if (this.miscordActiveFriend === d.sessionId) this.miscordActiveFriend = null;
      this.refreshMiscordFriends();
    });
    this.room.onMessage('presence', (d: { sessionId: string; name: string; color: string }) => {
      this.miscordOnline.set(d.sessionId, { name: d.name, color: d.color });
      this.refreshMiscordFriends();

    });
    this.room.onMessage('chat', (d: { from: string; fromName: string; to: string; text: string; ts: number }) => {
      this.onMiscordChat(d);
    });

    this.room.onMessage('note:add',    (d: StickyNote) => this.renderNote(d));
    this.room.onMessage('note:move',   (d: { id: string; x: number; y: number }) => {
      const el = this.stickyNotes.get(d.id);
      if (el) { el.style.left = d.x + 'px'; el.style.top = d.y + 'px'; }
    });
    this.room.onMessage('note:delete', (d: { id: string }) => {
      this.stickyNotes.get(d.id)?.remove();
      this.stickyNotes.delete(d.id);
    });
  }

  private async connectServer() {
    try {
      const { httpBase, wsBase, label } = await resolveEndpoints();
      console.log(`[XP] Connecting to Colyseus at: ${httpBase} (${label})`);

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

      this.setupRoomHandlers();
      this.room!.send('presence', { name: this.userName });

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
