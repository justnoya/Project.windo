import { Scene } from "phaser";
import { Room, Client } from "colyseus.js";
import { getUserName } from "../utils/discordSDK";
import { gameState } from "../utils/gameState";
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

const WYP_CHARS: Array<{ name: string; emoji: string; hints: string[] }> = [
  { name:'Mario',        emoji:'🍄', hints:['Italian plumber','Nintendo icon','Jumps on enemies','Saves Princess Peach'] },
  { name:'Sonic',        emoji:'💨', hints:['Fastest thing alive','Blue hedgehog','Sega mascot','Hates water'] },
  { name:'Pikachu',      emoji:'⚡', hints:['Electric type','Says own name',"Ash's partner",'#025 in Pokédex'] },
  { name:'Link',         emoji:'🗡️', hints:['Green tunic hero','Hyrule Kingdom','Master Sword','Never speaks'] },
  { name:'Master Chief', emoji:'🪖', hints:['Spartan-117','Xbox icon','Fights Covenant','Face always hidden'] },
  { name:'Lara Croft',   emoji:'🏹', hints:['Tomb Raider','British archaeologist','Dual pistols','Expert climber'] },
  { name:'Pac-Man',      emoji:'🟡', hints:['Eats dots','1980 arcade classic','Scared of ghosts','Waka waka'] },
  { name:'Mega Man',     emoji:'🤖', hints:['Blue robot','Arm cannon','Fights Robot Masters','Capcom game'] },
  { name:'Kirby',        emoji:'💗', hints:['Swallows enemies','Pink puffball','Dream Land hero','Copy ability'] },
  { name:'Samus',        emoji:'🚀', hints:['Bounty hunter','Power Suit','Fights Metroids','Secretly a woman'] },
  { name:'Donkey Kong',  emoji:'🍌', hints:['Throws barrels','King of the jungle','Wears a red tie','Big ape'] },
  { name:'Cloud',        emoji:'⚔️', hints:['Enormous sword','Spiky blonde hair','Ex-SOLDIER','Final Fantasy VII'] },
  { name:'Doom Slayer',  emoji:'💀', hints:['Rips and tears','UAC Mars base','Fights demons','Too angry to die'] },
  { name:'Crash',        emoji:'🌀', hints:['Spinning attack','Orange marsupial','Aku Aku mask','N. Sanity Beach'] },
  { name:'Spyro',        emoji:'🔥', hints:['Purple dragon','Breathes fire','Glides not flies','Collects gems'] },
  { name:'Snake',        emoji:'📦', hints:['Hides in boxes','Tactical espionage','Smokes cigarettes','Metal Gear hero'] },
];

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

  private wyp_myChar: string | null = null;
  private wyp_myEmoji = '';
  private wyp_myHintIdx = 0;
  private wyp_phase: 'pick' | 'play' = 'pick';
  private wyp_players = new Map<string, { name: string; color: string; ready: boolean; hints: string[]; revealed: boolean; character?: string; emoji?: string; guesserName?: string }>();
  private wyp_scores = new Map<string, number>();

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
    area.appendChild(this.makeDesktopIconImg('Who You Play?', '/wyp-icon.png', () => this.openWhoYouPlay()));
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
  // WHO YOU PLAY — MULTIPLAYER GUESSING GAME
  // ══════════════════════════════════════════════════════════════════════════
  private openWhoYouPlay() {
    const winId = 'whoyouplay';
    this.trackRecent(winId, 'Who You Play?',
      `<img src="/wyp-icon.png" class="xp-sm-recent-icon" />`,
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
      <div class="xp-titlebar">
        <img src="/wyp-icon.png" class="xp-win-icon-img" alt="Who You Play?" />
        <span class="xp-win-title">Who You Play?</span>
        <div class="xp-win-btns">
          <button class="xp-wbtn" id="min-${winId}" title="Minimize">─</button>
          <button class="xp-wbtn" id="max-${winId}" title="Maximize">☐</button>
          <button class="xp-wbtn xp-close" id="cls-${winId}" title="Close">✕</button>
        </div>
      </div>
      <div class="wyp-body" id="wyp-body">${this.wyp_buildPickPhase()}</div>`;
    this.overlay.appendChild(win);
    this.positionWin(win);
    this.wins.set(winId, { el: win, titlebar: win.querySelector<HTMLElement>('.xp-titlebar')!, minimized: false, maximized: false });
    this.makeDraggable(winId);
    this.bringFront(winId);
    win.querySelector('#min-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.minimizeWin(winId); });
    win.querySelector('#max-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.toggleMax(winId); });
    win.querySelector('#cls-' + winId)!.addEventListener('click', e => { e.stopPropagation(); this.closeWin(winId); });
    win.addEventListener('pointerdown', () => this.bringFront(winId));
    this.wyp_wirePickPhase(win);
    const tbBtn = this.makeTbBtn(winId, 'Who You Play?', Icons.mycomputer);
    tbBtn.innerHTML = `<img src="/wyp-icon.png" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;" /> Who You Play?`;
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.tbBtns.set(winId, tbBtn);
  }

  private wyp_buildPickPhase(): string {
    const cards = WYP_CHARS.map(c =>
      `<div class="wyp-char-card" data-char="${this.esc(c.name)}" data-emoji="${c.emoji}">
        <div class="wyp-char-emoji">${c.emoji}</div>
        <div class="wyp-char-name">${this.esc(c.name)}</div>
      </div>`
    ).join('');
    return `
      <div class="wyp-pick-phase">
        <div class="wyp-pick-header">
          <div class="wyp-pick-title">🎮 Who Are You Playing?</div>
          <div class="wyp-pick-sub">Pick your character — others must guess!</div>
        </div>
        <div class="wyp-chars-grid">${cards}</div>
        <div class="wyp-pick-confirm" id="wyp-pick-confirm" style="display:none">
          <span id="wyp-picked-preview"></span>
          <button class="wyp-confirm-btn" id="wyp-confirm-btn">▶ Play as this character!</button>
        </div>
      </div>`;
  }

  private wyp_wirePickPhase(win: HTMLElement) {
    let selectedChar: typeof WYP_CHARS[0] | null = null;
    win.querySelectorAll<HTMLElement>('.wyp-char-card').forEach(card => {
      card.addEventListener('pointerdown', e => {
        e.stopPropagation();
        SoundManager.click();
        win.querySelectorAll('.wyp-char-card').forEach(c => c.classList.remove('wyp-selected'));
        card.classList.add('wyp-selected');
        selectedChar = WYP_CHARS.find(c => c.name === card.dataset.char) || null;
        const confirm = win.querySelector<HTMLElement>('#wyp-pick-confirm')!;
        const preview = win.querySelector<HTMLElement>('#wyp-picked-preview')!;
        confirm.style.display = 'flex';
        preview.textContent = `${selectedChar?.emoji || ''} ${selectedChar?.name || ''}`;
      });
    });
    win.querySelector('#wyp-confirm-btn')?.addEventListener('click', () => {
      if (!selectedChar) return;
      SoundManager.wypPick();
      this.wyp_myChar = selectedChar.name;
      this.wyp_myEmoji = selectedChar.emoji;
      this.wyp_myHintIdx = 0;
      this.wyp_phase = 'play';
      this.room?.send('wyp:ready', { name: this.userName });
      win.querySelector<HTMLElement>('#wyp-body')!.innerHTML = this.wyp_buildPlayPhase();
      this.wyp_wirePlayPhase(win);
    });
  }

  private wyp_buildPlayPhase(): string {
    const char = WYP_CHARS.find(c => c.name === this.wyp_myChar);
    const hintsLeft = char ? char.hints.length - this.wyp_myHintIdx : 0;
    return `
      <div class="wyp-play-phase">
        <div class="wyp-play-left">
          <div class="wyp-my-secret">
            <div class="wyp-secret-label">🔒 Your secret character</div>
            <div class="wyp-secret-char">
              <span class="wyp-secret-emoji">${this.wyp_myEmoji}</span>
              <span class="wyp-secret-name">${this.esc(this.wyp_myChar || '')}</span>
            </div>
            <div class="wyp-hints-given" id="wyp-hints-given"></div>
            <button class="wyp-hint-btn" id="wyp-hint-btn" ${hintsLeft === 0 ? 'disabled' : ''}>
              💡 Drop Hint <span class="wyp-hint-count">(${hintsLeft} left)</span>
            </button>
          </div>
          <div class="wyp-score-panel">
            <div class="wyp-score-title">🏆 Scores</div>
            <div id="wyp-scores"><div class="wyp-empty">No scores yet</div></div>
          </div>
        </div>
        <div class="wyp-play-right">
          <div class="wyp-players-section">
            <div class="wyp-section-label">👥 Players</div>
            <div id="wyp-players-list" class="wyp-players-list">
              <div class="wyp-empty">Waiting for others to join…</div>
            </div>
          </div>
          <div class="wyp-feed-section">
            <div class="wyp-section-label">📡 Activity</div>
            <div id="wyp-feed" class="wyp-feed"></div>
          </div>
          <div class="wyp-guess-row">
            <select class="wyp-guess-select" id="wyp-guess-select">
              <option value="">Guess about…</option>
            </select>
            <input class="wyp-guess-input" id="wyp-guess-input" type="text"
              placeholder="Character name…" maxlength="60" autocomplete="off" />
            <button class="wyp-guess-btn" id="wyp-guess-btn">Guess!</button>
          </div>
          <button class="wyp-reset-btn" id="wyp-reset-btn">🔄 New Game</button>
        </div>
      </div>`;
  }

  private wyp_wirePlayPhase(win: HTMLElement) {
    this.wyp_refreshPlayers(win);
    this.wyp_refreshScores(win);

    win.querySelector('#wyp-hint-btn')?.addEventListener('click', () => {
      const char = WYP_CHARS.find(c => c.name === this.wyp_myChar);
      if (!char || this.wyp_myHintIdx >= char.hints.length) return;
      const hint = char.hints[this.wyp_myHintIdx++];
      SoundManager.wypHint();
      this.room?.send('wyp:hint', { hint });
      const given = win.querySelector<HTMLElement>('#wyp-hints-given')!;
      const tag = document.createElement('span');
      tag.className = 'wyp-hint-tag'; tag.textContent = hint;
      given.appendChild(tag);
      const btn = win.querySelector<HTMLButtonElement>('#wyp-hint-btn')!;
      const left = char.hints.length - this.wyp_myHintIdx;
      btn.disabled = left === 0;
      (btn.querySelector('.wyp-hint-count') as HTMLElement).textContent = `(${left} left)`;
    });

    const sendGuess = () => {
      const select = win.querySelector<HTMLSelectElement>('#wyp-guess-select')!;
      const input  = win.querySelector<HTMLInputElement>('#wyp-guess-input')!;
      const targetId = select.value; const guess = input.value.trim();
      if (!targetId || !guess) return;
      input.value = '';
      SoundManager.click();
      this.room?.send('wyp:guess', { fromName: this.userName, targetId, guess });
      this.wyp_addFeed(win, `🤔 You guessed <b>${this.esc(guess)}</b> for ${this.esc(this.wyp_players.get(targetId)?.name || 'someone')}`);
    };
    win.querySelector('#wyp-guess-btn')?.addEventListener('click', sendGuess);
    win.querySelector<HTMLInputElement>('#wyp-guess-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendGuess(); });

    win.querySelector('#wyp-reset-btn')?.addEventListener('click', () => {
      SoundManager.click();
      this.room?.send('wyp:reset', {});
      this.wyp_doReset(win);
    });
  }

  private wyp_refreshPlayers(win: HTMLElement) {
    const list   = win.querySelector<HTMLElement>('#wyp-players-list');
    const select = win.querySelector<HTMLSelectElement>('#wyp-guess-select');
    if (!list) return;
    const players = Array.from(this.wyp_players.entries());
    if (players.length === 0) {
      list.innerHTML = '<div class="wyp-empty">Waiting for others to join…</div>';
    } else {
      list.innerHTML = players.map(([sid, p]) => {
        const badge = p.revealed
          ? `<span class="wyp-char-badge wyp-revealed">${p.emoji || '🎮'} ${this.esc(p.character || '')}</span>`
          : `<span class="wyp-char-badge wyp-hidden">???</span>`;
        const hints = p.hints.length > 0
          ? `<div class="wyp-player-hints">${p.hints.map(h => `<span class="wyp-hint-tag-sm">${this.esc(h)}</span>`).join('')}</div>` : '';
        const guesser = p.revealed && p.guesserName
          ? `<span class="wyp-guessed-by">— guessed by ${this.esc(p.guesserName)}</span>` : '';
        return `<div class="wyp-player-row${p.revealed ? ' wyp-p-revealed' : ''}">
          <div class="wyp-p-avatar" style="background:${p.color}">${(p.name[0] || '?').toUpperCase()}</div>
          <div class="wyp-p-info">
            <div class="wyp-p-name">${this.esc(p.name)} ${badge} ${guesser}</div>
            ${hints}
          </div>
        </div>`;
      }).join('');
    }
    if (select) {
      const cur = select.value;
      select.innerHTML = '<option value="">Guess about…</option>';
      players.filter(([, p]) => !p.revealed).forEach(([sid, p]) => {
        const opt = document.createElement('option');
        opt.value = sid; opt.textContent = p.name;
        if (sid === cur) opt.selected = true;
        select.appendChild(opt);
      });
    }
  }

  private wyp_refreshScores(win: HTMLElement) {
    const el = win.querySelector<HTMLElement>('#wyp-scores');
    if (!el) return;
    const scores = Array.from(this.wyp_scores.entries()).sort((a, b) => b[1] - a[1]);
    if (scores.length === 0) { el.innerHTML = '<div class="wyp-empty">No scores yet</div>'; return; }
    el.innerHTML = scores.map(([sid, score]) => {
      const name = sid === this.room?.sessionId ? 'You' : (this.wyp_players.get(sid)?.name || 'Player');
      return `<div class="wyp-score-row"><span>${this.esc(name)}</span><span class="wyp-score-pts">${score} pt${score !== 1 ? 's' : ''}</span></div>`;
    }).join('');
  }

  private wyp_addFeed(win: HTMLElement, html: string) {
    const feed = win.querySelector<HTMLElement>('#wyp-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'wyp-feed-item'; item.innerHTML = html;
    feed.appendChild(item);
    if (feed.children.length > 40) feed.removeChild(feed.firstChild!);
    feed.scrollTop = feed.scrollHeight;
  }

  private wyp_doReset(win: HTMLElement) {
    this.wyp_myChar = null; this.wyp_myEmoji = ''; this.wyp_myHintIdx = 0;
    this.wyp_phase = 'pick'; this.wyp_players.clear(); this.wyp_scores.clear();
    win.querySelector<HTMLElement>('#wyp-body')!.innerHTML = this.wyp_buildPickPhase();
    this.wyp_wirePickPhase(win);
  }

  private wyp_onReady(d: { sessionId: string; name: string }) {
    const color = CURSOR_COLORS[this.wyp_players.size % CURSOR_COLORS.length];
    if (!this.wyp_players.has(d.sessionId))
      this.wyp_players.set(d.sessionId, { name: d.name, color, ready: true, hints: [], revealed: false });
    else
      this.wyp_players.get(d.sessionId)!.ready = true;
    const win = document.getElementById('win-whoyouplay');
    if (!win) return;
    this.wyp_refreshPlayers(win);
    this.wyp_addFeed(win, `🎮 <b>${this.esc(d.name)}</b> has picked a character!`);
  }

  private wyp_onHint(d: { sessionId: string; hint: string }) {
    const player = this.wyp_players.get(d.sessionId);
    if (player) player.hints.push(d.hint);
    const win = document.getElementById('win-whoyouplay');
    if (!win) return;
    SoundManager.wypHint();
    this.wyp_addFeed(win, `💡 <b>${this.esc(player?.name || 'Someone')}</b>: "${this.esc(d.hint)}"`);
    this.wyp_refreshPlayers(win);
  }

  private wyp_onGuess(d: { from: string; fromName: string; targetId: string; guess: string }) {
    const win = document.getElementById('win-whoyouplay');
    if (win) {
      const tName = this.wyp_players.get(d.targetId)?.name || 'someone';
      this.wyp_addFeed(win, `🤔 <b>${this.esc(d.fromName)}</b> guessed "<b>${this.esc(d.guess)}</b>" for ${this.esc(tName)}`);
    }
    if (d.targetId === this.room?.sessionId && this.wyp_myChar && this.wyp_phase === 'play') {
      if (d.guess.toLowerCase().trim() === this.wyp_myChar.toLowerCase().trim()) {
        SoundManager.wypReveal();
        this.room!.send('wyp:reveal', { character: this.wyp_myChar, emoji: this.wyp_myEmoji, guesserName: d.fromName });
        this.wyp_scores.set(d.from, (this.wyp_scores.get(d.from) || 0) + 1);
        if (win) {
          this.wyp_addFeed(win, `🎉 <b>${this.esc(d.fromName)}</b> correctly guessed <b>${this.wyp_myEmoji} ${this.esc(this.wyp_myChar)}</b>!`);
          this.wyp_refreshScores(win);
        }
      }
    }
  }

  private wyp_onReveal(d: { sessionId: string; character: string; emoji: string; guesserName: string }) {
    const player = this.wyp_players.get(d.sessionId);
    if (player) { player.revealed = true; player.character = d.character; player.emoji = d.emoji; player.guesserName = d.guesserName; }
    const win = document.getElementById('win-whoyouplay');
    if (!win) return;
    SoundManager.wypCorrect();
    this.wyp_addFeed(win, `🎊 <b>${this.esc(player?.name || 'Player')}</b> was <b>${d.emoji} ${this.esc(d.character)}</b> — guessed by <b>${this.esc(d.guesserName)}</b>!`);
    this.wyp_refreshPlayers(win);
    this.wyp_refreshScores(win);
  }

  private wyp_onReset() {
    const win = document.getElementById('win-whoyouplay');
    if (win) this.wyp_doReset(win);
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
        '.xp-icon, .xp-ctx-item:not(.xp-disabled), .xp-mitem, .xp-tb-btn, .xp-wbtn, .xp-sm-item:not(.xp-disabled), .xp-sb-link, .xp-nav:not(:disabled), .wyp-char-card, .wyp-hint-btn, .wyp-guess-btn, .wyp-confirm-btn, .wyp-reset-btn, .mxp-friend, .xp-sm-footer-btn'
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
      if (!this.wyp_players.has(d.sessionId))
        this.wyp_players.set(d.sessionId, { name: d.name, color: d.color, ready: false, hints: [], revealed: false });
    });
    this.room.onMessage('playerLeft', (d: { sessionId: string }) => {
      this.pCursors.get(d.sessionId)?.remove();
      this.pCursors.delete(d.sessionId);
      this.miscordOnline.delete(d.sessionId);
      this.wyp_players.delete(d.sessionId);
      if (this.miscordActiveFriend === d.sessionId) this.miscordActiveFriend = null;
      this.refreshMiscordFriends();
      const wypWin = document.getElementById('win-whoyouplay');
      if (wypWin && this.wyp_phase === 'play') this.wyp_refreshPlayers(wypWin);
    });
    this.room.onMessage('presence', (d: { sessionId: string; name: string; color: string }) => {
      this.miscordOnline.set(d.sessionId, { name: d.name, color: d.color });
      this.refreshMiscordFriends();
      if (!this.wyp_players.has(d.sessionId))
        this.wyp_players.set(d.sessionId, { name: d.name, color: d.color, ready: false, hints: [], revealed: false });
      const wypWin = document.getElementById('win-whoyouplay');
      if (wypWin && this.wyp_phase === 'play') this.wyp_refreshPlayers(wypWin);
    });
    this.room.onMessage('chat', (d: { from: string; fromName: string; to: string; text: string; ts: number }) => {
      this.onMiscordChat(d);
    });
    this.room.onMessage('wyp:ready',  (d: { sessionId: string; name: string })  => this.wyp_onReady(d));
    this.room.onMessage('wyp:hint',   (d: { sessionId: string; hint: string })  => this.wyp_onHint(d));
    this.room.onMessage('wyp:guess',  (d: { from: string; fromName: string; targetId: string; guess: string }) => this.wyp_onGuess(d));
    this.room.onMessage('wyp:reveal', (d: { sessionId: string; character: string; emoji: string; guesserName: string }) => this.wyp_onReveal(d));
    this.room.onMessage('wyp:reset',  () => this.wyp_onReset());
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
      const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

      let httpBase: string;
      let wsBase: string;

      if (isLocal) {
        httpBase = 'http://localhost:3001';
        wsBase   = 'ws://localhost:3001';
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
