/**
 * WhoYouPlay — a 4-phase psychological quiz that escalates from light Windows
 * XP aesthetics into dark glitch-art as the questions get more personal.
 *
 * This class is self-contained: it owns all quiz state, renders its own XP
 * window, and only touches the desktop through the narrow IDesktopContext
 * interface (window lifecycle + taskbar helpers).
 *
 * To open from the desktop: `this.wyp.open()`
 */

import { SoundManager } from '../utils/SoundManager';
import type { IDesktopContext, WinState } from '../types/desktop';

// ── Phase configuration ────────────────────────────────────────────────────

const PHASE_CONFIG = {
  1: {
    windowBg: '#ece9d8', contentBg: '#fff',
    titleBar: 'linear-gradient(180deg,#1a91e8 0%,#0f5db5 8%,#1278d0 40%,#1787e5 88%,#0c5db5 100%)',
    titleText: '#ffffff',
    progressFill: 'linear-gradient(90deg,#3b8de5,#6fc8ff)',
    label: 'ICEBREAKER', labelColor: '#1060c8',
    nextLabel: 'Next ▶',
    glitch: false, scanlines: false, flicker: false,
  },
  2: {
    windowBg: '#d8d5c4', contentBg: '#f0ede0',
    titleBar: 'linear-gradient(180deg,#0f6aaa 0%,#094a88 8%,#0a5aaa 40%,#0f6aaa 88%,#083a78 100%)',
    titleText: '#ddeeff',
    progressFill: 'linear-gradient(90deg,#1a6ab8,#4a9aee)',
    label: 'GETTING PERSONAL', labelColor: '#083a88',
    nextLabel: 'Continue ▶',
    glitch: false, scanlines: false, flicker: true,
  },
  3: {
    windowBg: '#1a1a2e', contentBg: '#0d0d1a',
    titleBar: 'linear-gradient(180deg,#0a0a18 0%,#050510 50%,#0a0a18 100%)',
    titleText: '#7a9aff',
    progressFill: 'linear-gradient(90deg,#3a0a6a,#8a2aee)',
    label: 'THE DEEP END', labelColor: '#6a4aee',
    nextLabel: 'Go deeper...',
    glitch: true, scanlines: true, flicker: true,
  },
  4: {
    windowBg: '#000000', contentBg: '#030303',
    titleBar: 'linear-gradient(180deg,#0a0000 0%,#050000 50%,#0a0000 100%)',
    titleText: '#cc0000',
    progressFill: 'linear-gradient(90deg,#4a0000,#cc0000)',
    label: 'IT KNOWS YOU', labelColor: '#880000',
    nextLabel: "There's no going back.",
    glitch: true, scanlines: true, flicker: true,
  },
} as const;

type Phase = keyof typeof PHASE_CONFIG;

// ── Quiz data ──────────────────────────────────────────────────────────────

const QUESTIONS: Array<{
  id: number;
  phase: Phase;
  type: 'choice' | 'input';
  question: string;
  options: string[];
  placeholder: string;
}> = [
  { id: 1, phase: 1, type: 'choice', question: 'Night owl or early bird?',
    options: ['Deep night owl 🦉', 'Early riser ☀️', 'Depends on the day', "I don't sleep"],
    placeholder: '' },
  { id: 2, phase: 1, type: 'choice', question: 'Pick the vibe that matches your energy right now.',
    options: ['Chaotic but alive', 'Quiet and focused', 'Somewhere in between', 'Completely offline'],
    placeholder: '' },
  { id: 3, phase: 2, type: 'input',
    question: "What's the last thing you said online that you actually meant?",
    options: [], placeholder: "Be honest. Nobody's watching. Yet." },
  { id: 4, phase: 2, type: 'choice',
    question: "You've been typing a message for 3 minutes. You delete it. Why?",
    options: ['Too much, too real', "They wouldn't get it", 'Changed my mind', 'I never send those'],
    placeholder: '' },
  { id: 5, phase: 3, type: 'choice',
    question: "There's a version of you that exists only online.\n\nHow much of that version is real?",
    options: ['Most of it', 'Some of it', 'Almost none', 'More real than IRL'],
    placeholder: '' },
  { id: 6, phase: 3, type: 'input',
    question: 'Finish this: "The version of me that nobody sees is..."',
    options: [], placeholder: 'This is between you and the screen.' },
  { id: 7, phase: 4, type: 'choice',
    question: 'You said you were fine.\n\nWere you?',
    options: ['Yes', 'No', "I don't remember", 'Stop.'],
    placeholder: '' },
  { id: 8, phase: 4, type: 'input',
    question: 'What are you actually doing here?',
    options: [], placeholder: '...' },
];

const RESULTS = [
  { name: 'The Ghost',     emoji: '👻', color: '#4a6aaa',
    tagline: 'You were online. Just not really there.',
    desc: "You observe more than you participate. You know everything about everyone and they know almost nothing about you. That's not an accident." },
  { name: 'The Performer', emoji: '🎭', color: '#aa4a6a',
    tagline: "You perform connection. Sometimes it's even real.",
    desc: "Every message is slightly curated. Every reaction slightly calculated. You're not fake — you're just always aware of the audience. Even when there isn't one." },
  { name: 'The Absorber',  emoji: '🕳️', color: '#6a4aaa',
    tagline: "You carry everyone else's chaos. Who carries yours?",
    desc: "You're the person people come to. You hold it together for everyone. But at 3AM, when it's just you and the screen — that's a different story." },
  { name: 'The Signal',    emoji: '⚡', color: '#aa8a00',
    tagline: "Even you don't know what you'll do next.",
    desc: "You're unpredictable in a way that isn't performance — it's just how you're wired. People can't read you. Half the time, you can't either. That's the point." },
];

const GLITCH_CHARS = '!@#$%^&*░▒▓█▄▀■□▪▫';

const WIN_ID = 'whoyouplay';

// ── WhoYouPlay class ───────────────────────────────────────────────────────

export class WhoYouPlay {
  // Quiz state — reset each time the user plays again
  private cur = 0;
  private answers: Record<number, string> = {};
  private inputVal = '';
  private done = false;
  private result = RESULTS[0];

  // Active timers — stopped whenever the window closes or re-renders
  private glitchTimers: ReturnType<typeof setInterval>[] = [];
  private flickerTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private ctx: IDesktopContext) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /** Open (or focus) the WYP window on the desktop. */
  open(): void {
    this.ctx.trackRecent(
      WIN_ID,
      'Who You Play?',
      `<img src="/wyp-icon.svg" class="xp-sm-recent-icon" style="width:16px;height:16px;" />`,
      () => this.open(),
    );

    // If already open, focus it
    if (this.ctx.wins.has(WIN_ID)) {
      const ws = this.ctx.wins.get(WIN_ID)!;
      if (ws.minimized) this.ctx.restoreWin(WIN_ID);
      else this.ctx.bringFront(WIN_ID);
      return;
    }

    SoundManager.windowOpen();
    const win = this.createWindow();
    this.ctx.overlay.appendChild(win);
    this.ctx.positionWin(win);

    const ws: WinState = {
      el: win,
      titlebar: win.querySelector<HTMLElement>('.xp-titlebar')!,
      minimized: false,
      maximized: false,
    };
    this.ctx.wins.set(WIN_ID, ws);
    this.ctx.makeDraggable(WIN_ID);
    this.ctx.bringFront(WIN_ID);

    // Window chrome buttons
    win.querySelector(`#min-${WIN_ID}`)!
      .addEventListener('click', e => { e.stopPropagation(); this.ctx.minimizeWin(WIN_ID); });
    win.querySelector(`#max-${WIN_ID}`)!
      .addEventListener('click', e => { e.stopPropagation(); this.ctx.toggleMax(WIN_ID); });
    win.querySelector(`#cls-${WIN_ID}`)!
      .addEventListener('click', e => { e.stopPropagation(); this.stopTimers(); this.ctx.closeWin(WIN_ID); });
    win.addEventListener('pointerdown', () => this.ctx.bringFront(WIN_ID));

    // Taskbar button
    const tbBtn = this.ctx.makeTbBtn(WIN_ID, 'Who You Play?', '');
    tbBtn.innerHTML = `<img src="/wyp-icon.svg" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:4px;" /> Who You Play?`;
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.ctx.tbBtns.set(WIN_ID, tbBtn);

    // Pick a random result type for this session
    this.result = RESULTS[Math.floor(Math.random() * RESULTS.length)];
    this.render(win);
  }

  // ── Private: window construction ─────────────────────────────────────────

  private createWindow(): HTMLElement {
    const win = document.createElement('div');
    win.className = 'xp-window wyp-window';
    win.id = `win-${WIN_ID}`;
    win.style.zIndex = String(this.ctx.nextZ());
    win.innerHTML = `
      <div class="xp-titlebar wyp-titlebar">
        <img src="/wyp-icon.svg" class="xp-win-icon-img" alt="Who You Play?" />
        <span class="xp-win-title" style="color:#fff;text-shadow:1px 1px 2px rgba(0,0,0,0.5);">Who You Play?</span>
        <div class="xp-win-btns">
          <button class="xp-wbtn" id="min-${WIN_ID}" title="Minimize">─</button>
          <button class="xp-wbtn" id="max-${WIN_ID}" title="Maximize">☐</button>
          <button class="xp-wbtn xp-close" id="cls-${WIN_ID}" title="Close">✕</button>
        </div>
      </div>
      <div id="wyp-body" style="flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative;"></div>`;
    return win;
  }

  // ── Private: rendering ────────────────────────────────────────────────────

  private render(win: HTMLElement): void {
    this.stopTimers();

    const q     = QUESTIONS[this.cur];
    const phase: Phase = this.done ? 4 : q.phase;
    const p     = PHASE_CONFIG[phase];
    const dark  = phase >= 3;
    const blood = phase === 4;
    const pct   = Math.round((this.cur / QUESTIONS.length) * 100);

    // Update window chrome to match current phase
    win.style.background = this.done ? '#000' : p.windowBg;
    const tb = win.querySelector<HTMLElement>('.wyp-titlebar');
    if (tb) {
      tb.style.background = p.titleBar;
      const span = tb.querySelector<HTMLElement>('.xp-win-title');
      if (span) {
        span.style.color        = p.titleText;
        span.style.textShadow   = dark ? `0 0 10px ${p.titleText}` : '1px 1px 2px rgba(0,0,0,0.5)';
        span.style.letterSpacing = dark ? '0.5px' : '0';
      }
    }

    const body = win.querySelector<HTMLElement>('#wyp-body');
    if (!body) return;

    if (this.done) {
      body.innerHTML = this.buildResultHTML();
      body.querySelector('#wyp-restart')
        ?.addEventListener('click', () => { this.resetState(); this.render(win); });
      return;
    }

    body.innerHTML = this.buildQuestionHTML(q, p, phase, dark, blood, pct);
    this.wireQuestionEvents(body, win, q, dark, blood, phase);
    this.startTimers(win, phase);
  }

  // ── Private: HTML builders ────────────────────────────────────────────────

  private buildQuestionHTML(
    q: typeof QUESTIONS[0],
    p: typeof PHASE_CONFIG[1],
    phase: Phase,
    dark: boolean,
    blood: boolean,
    pct: number,
  ): string {
    const textColor = dark ? (blood ? '#cc3333' : '#7a9aff') : '#111';
    const subColor  = dark ? (blood ? '#661111' : '#4a4a8a') : '#555';
    const canNext   = q.type === 'input'
      ? this.inputVal.trim().length > 0
      : this.answers[q.id] !== undefined;
    const canBack   = this.cur > 0;
    const total     = QUESTIONS.length;

    const sunken = this.borderStyle(dark, 'sunken');
    const raised  = this.borderStyle(dark, 'raised');

    const navBtn = (disabled: boolean, primary = false): string =>
      `font-family:Tahoma,Arial,sans-serif;font-size:11px;padding:5px 18px;min-width:85px;` +
      `cursor:${disabled ? 'default' : 'pointer'};` +
      `background:${disabled ? (dark ? '#0a0a12' : '#e8e4dc') : dark ? 'linear-gradient(180deg,#0d0d1a,#0a0a14)' : 'linear-gradient(180deg,#f8f6f0,#e8e4d8)'};` +
      `${disabled ? sunken : raised}` +
      `outline:${primary && !disabled ? `2px solid ${blood ? '#660000' : dark ? '#3a3aaa' : '#003399'}` : `1px solid ${dark ? '#1a1a2a' : '#d4d0c8'}`};` +
      `outline-offset:${primary ? '1px' : '0'};` +
      `color:${disabled ? (dark ? '#333' : '#aaa') : dark ? (blood ? '#cc0000' : '#7a9aff') : '#000'};` +
      `user-select:none;letter-spacing:${phase === 4 ? '0.5px' : '0'};`;

    const optionsHTML = q.type === 'choice'
      ? q.options.map(opt => {
          const sel    = this.answers[q.id] === opt;
          const optBg  = sel
            ? (blood ? 'linear-gradient(180deg,#2a0000,#1a0000)' : dark ? 'linear-gradient(180deg,#1a1a4a,#0d0d2a)' : 'linear-gradient(180deg,#c8deff,#a0c4ff)')
            : (dark   ? 'linear-gradient(180deg,#0d0d18,#080810)'   : 'linear-gradient(180deg,#f8f6f0,#e8e4d8)');
          const radioBg  = sel ? (blood ? '#660000' : dark ? '#3a3aee' : '#1060c8') : (dark ? '#050508' : '#fff');
          const radioBdr = dark ? (sel ? (blood ? '#880000' : '#4a4aee') : '#2a2a4a') : '#666';
          return `<div class="wyp-opt-btn${sel ? ' wyp-opt-sel' : ''}" data-opt="${this.esc(opt)}"
              style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${optBg};${sel ? sunken : raised}cursor:pointer;
              font-family:Tahoma,Arial,sans-serif;font-size:11px;user-select:none;color:${dark ? (blood && sel ? '#cc0000' : '#8a9acc') : '#000'};transition:background 0.08s;">
              <span style="width:13px;height:13px;border:2px solid ${radioBdr};border-radius:50%;background:${radioBg};display:inline-flex;
                align-items:center;justify-content:center;flex-shrink:0;box-shadow:inset 1px 1px 2px rgba(0,0,0,${dark ? 0.6 : 0.15});transition:background 0.15s;">
                ${sel ? '<span style="width:5px;height:5px;background:#fff;border-radius:50%;"></span>' : ''}
              </span>${this.esc(opt)}</div>`;
        }).join('')
      : '';

    const inputHTML = q.type === 'input'
      ? `<textarea id="wyp-input" placeholder="${this.esc(q.placeholder)}" rows="3"
           style="margin-top:10px;width:100%;font-family:Tahoma,Arial,sans-serif;font-size:11px;padding:5px 6px;
           background:${dark ? '#030305' : '#fff'};${sunken}resize:vertical;
           color:${dark ? (blood ? '#aa2222' : '#6a8aee') : '#000'};box-sizing:border-box;
           caret-color:${dark ? (blood ? '#cc0000' : '#7a9aff') : '#000'};"></textarea>`
      : '';

    return `
      <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;background:${p.windowBg};position:relative;">
        ${p.scanlines ? '<div style="position:absolute;inset:0;pointer-events:none;z-index:10;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.18) 2px,rgba(0,0,0,0.18) 4px);"></div>' : ''}
        <div style="padding:14px 14px 10px;display:flex;flex-direction:column;flex:1;min-height:0;">

          <!-- Progress bar -->
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:10px;color:${dark ? '#4a4a6a' : '#444'};font-family:Tahoma,Arial,sans-serif;">${dark ? 'DEPTH' : 'Progress'}</span>
              <span style="font-size:10px;color:${dark ? '#4a4a6a' : '#444'};font-family:Tahoma,Arial,sans-serif;">${pct}%</span>
            </div>
            <div style="height:14px;background:${dark ? '#050508' : '#b8b4a8'};border-top:2px solid ${dark ? '#000' : '#7a7a7a'};border-left:2px solid ${dark ? '#000' : '#7a7a7a'};border-right:2px solid ${dark ? '#1a1a2a' : '#fff'};border-bottom:2px solid ${dark ? '#1a1a2a' : '#fff'};padding:1px;overflow:hidden;position:relative;">
              <div style="width:${pct}%;height:100%;background:${p.progressFill};transition:width 0.4s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,0.3);"></div>
              <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(90deg,transparent,transparent 9px,rgba(255,255,255,0.08) 9px,rgba(255,255,255,0.08) 10px);"></div>
            </div>
          </div>

          <!-- Phase badge -->
          <div style="display:inline-flex;align-items:center;gap:5px;padding:2px 8px;background:${phase >= 3 ? 'transparent' : '#f0ede4'};border:1px solid ${p.labelColor};margin-bottom:10px;width:fit-content;">
            <span style="width:6px;height:6px;border-radius:50%;background:${p.labelColor};display:inline-block;flex-shrink:0;${phase >= 3 ? `box-shadow:0 0 6px ${p.labelColor};` : ''}"></span>
            <span class="${phase >= 3 ? 'wyp-glitch' : ''}" data-text="${p.label}"
              style="font-size:9px;font-family:Tahoma,Arial,sans-serif;color:${p.labelColor};letter-spacing:1.5px;font-weight:bold;${phase >= 3 ? `text-shadow:0 0 8px ${p.labelColor};` : ''}">${p.label}</span>
          </div>

          <!-- Question -->
          <div style="background:${p.contentBg};${sunken}padding:12px;margin-bottom:10px;position:relative;">
            <p id="wyp-qtext" class="${phase >= 3 ? 'wyp-glitch' : ''}" data-text="${this.esc(q.question)}"
              style="margin:0;font-size:${dark ? '13px' : '12px'};line-height:1.6;font-weight:bold;color:${textColor};
              font-family:Tahoma,Arial,sans-serif;white-space:pre-line;${dark ? `text-shadow:0 0 12px ${textColor}33;` : ''}${blood ? 'letter-spacing:0.3px;' : ''}">${this.esc(q.question)}</p>
            ${inputHTML}
          </div>

          <!-- Options (choice type) -->
          ${q.type === 'choice' ? `<div id="wyp-opts" style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">${optionsHTML}</div>` : ''}

          <!-- Navigation -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid ${dark ? '#111' : '#c0bdb0'};margin-top:auto;">
            <button id="wyp-back" ${!canBack ? 'disabled' : ''} class="wyp-nav-btn" style="${navBtn(!canBack)}">◀ Back</button>
            <span style="font-size:9px;color:${subColor};font-family:Tahoma,Arial,sans-serif;">${this.cur + 1} / ${total}</span>
            <button id="wyp-next" ${!canNext ? 'disabled' : ''} class="wyp-nav-btn" style="${navBtn(!canNext, true)}">${p.nextLabel}</button>
          </div>

        </div>
      </div>`;
  }

  private buildResultHTML(): string {
    const r = this.result;
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;padding:24px 20px;text-align:center;position:relative;animation:wyp-fadein 0.8s ease;overflow:hidden;">
        <div style="position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.2) 2px,rgba(0,0,0,0.2) 4px);"></div>
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;max-width:360px;">
          <div style="font-size:56px;margin-bottom:14px;filter:drop-shadow(0 0 24px ${r.color});animation:wyp-fadein 0.6s ease;">${r.emoji}</div>
          <div style="font-size:21px;font-weight:bold;font-family:Tahoma,Arial,sans-serif;color:${r.color};text-shadow:0 0 24px ${r.color},0 0 40px ${r.color}44;margin-bottom:7px;letter-spacing:0.3px;">${this.esc(r.name)}</div>
          <div style="font-size:11px;color:#888;font-family:Tahoma,Arial,sans-serif;font-style:italic;margin-bottom:18px;">${this.esc(r.tagline)}</div>
          <div style="border-top:1px solid #1a1a1a;padding-top:14px;margin-bottom:22px;font-size:11px;color:#555;font-family:Tahoma,Arial,sans-serif;line-height:1.75;">${this.esc(r.desc)}</div>
          <button id="wyp-restart" class="wyp-nav-btn"
            style="font-family:Tahoma,Arial,sans-serif;font-size:11px;padding:6px 22px;background:linear-gradient(180deg,#0d0d1a,#0a0a14);color:#7a9aff;border-top:2px solid #2a2a4a;border-left:2px solid #2a2a4a;border-right:2px solid #000;border-bottom:2px solid #000;outline:1px solid #1a1a2a;cursor:pointer;letter-spacing:0.5px;user-select:none;">↺ Play Again</button>
        </div>
      </div>`;
  }

  // ── Private: event wiring ─────────────────────────────────────────────────

  private wireQuestionEvents(
    body: HTMLElement,
    win: HTMLElement,
    q: typeof QUESTIONS[0],
    dark: boolean,
    blood: boolean,
    phase: Phase,
  ): void {
    // Option buttons
    body.querySelectorAll<HTMLElement>('.wyp-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.answers[q.id] = btn.dataset.opt!;
        SoundManager.click();
        this.render(win);
      });
      btn.addEventListener('mouseenter', () => {
        if (!btn.classList.contains('wyp-opt-sel'))
          btn.style.background = dark
            ? (blood ? 'linear-gradient(180deg,#1a0000,#0d0000)' : 'linear-gradient(180deg,#14142a,#0d0d1e)')
            : 'linear-gradient(180deg,#fffbe8,#fde060)';
      });
      btn.addEventListener('mouseleave', () => {
        if (!btn.classList.contains('wyp-opt-sel'))
          btn.style.background = dark
            ? 'linear-gradient(180deg,#0d0d18,#080810)'
            : 'linear-gradient(180deg,#f8f6f0,#e8e4d8)';
      });
    });

    // Text input
    const textarea = body.querySelector<HTMLTextAreaElement>('#wyp-input');
    if (textarea) {
      textarea.value = this.inputVal;
      textarea.addEventListener('input', e => {
        this.inputVal = (e.target as HTMLTextAreaElement).value;
        const nb = body.querySelector<HTMLButtonElement>('#wyp-next');
        if (nb) nb.disabled = this.inputVal.trim().length === 0;
      });
    }

    // Next button — fade out current content before re-rendering
    body.querySelector('#wyp-next')?.addEventListener('click', () => {
      const canNext = q.type === 'input'
        ? this.inputVal.trim().length > 0
        : this.answers[q.id] !== undefined;
      if (!canNext) return;
      if (q.type === 'input') this.answers[q.id] = this.inputVal;
      SoundManager.click();
      const inner = body.querySelector<HTMLDivElement>('div');
      if (inner) { inner.style.opacity = '0'; inner.style.transition = 'opacity 0.2s'; }
      setTimeout(() => {
        if (this.cur < QUESTIONS.length - 1) { this.cur++; this.inputVal = ''; }
        else { this.done = true; }
        this.render(win);
      }, 220);
    });

    // Back button
    body.querySelector('#wyp-back')?.addEventListener('click', () => {
      if (this.cur === 0) return;
      SoundManager.click();
      this.cur--;
      const prev = QUESTIONS[this.cur];
      this.inputVal = prev.type === 'input' ? (this.answers[prev.id] || '') : '';
      this.render(win);
    });
  }

  // ── Private: phase effects ────────────────────────────────────────────────

  private startTimers(win: HTMLElement, phase: Phase): void {
    // Window flicker — subtle for phase 2, more frequent for 3-4
    if (phase >= 2) {
      this.flickerTimer = setInterval(() => {
        if (Math.random() < (phase >= 3 ? 0.06 : 0.015)) {
          win.style.opacity = '0.82';
          setTimeout(() => { win.style.opacity = '1'; }, 70);
        }
      }, 140);
    }

    // Glitch text — corrupts `.wyp-glitch` elements then restores them
    if (phase >= 3) {
      const doGlitch = () => {
        win.querySelectorAll<HTMLElement>('.wyp-glitch').forEach(el => {
          const orig = el.dataset.text || '';
          if (!orig || Math.random() > 0.45) return;
          el.textContent = orig
            .split('')
            .map(c => Math.random() < 0.13
              ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
              : c)
            .join('');
          setTimeout(() => { el.textContent = orig; }, 90);
        });
      };
      this.glitchTimers.push(setInterval(doGlitch, 2800 + Math.random() * 1800));
    }
  }

  private stopTimers(): void {
    if (this.flickerTimer) { clearInterval(this.flickerTimer); this.flickerTimer = null; }
    this.glitchTimers.forEach(t => clearInterval(t));
    this.glitchTimers = [];
  }

  private resetState(): void {
    this.cur      = 0;
    this.answers  = {};
    this.inputVal = '';
    this.done     = false;
    this.result   = RESULTS[Math.floor(Math.random() * RESULTS.length)];
  }

  // ── Private: helpers ──────────────────────────────────────────────────────

  /** Classic XP inset/outset border as an inline-style string. */
  private borderStyle(dark: boolean, kind: 'sunken' | 'raised'): string {
    if (kind === 'sunken')
      return `border-top:2px solid ${dark ? '#000' : '#7a7a7a'};border-left:2px solid ${dark ? '#000' : '#7a7a7a'};border-right:2px solid ${dark ? '#1a1a2a' : '#fff'};border-bottom:2px solid ${dark ? '#1a1a2a' : '#fff'};outline:1px solid ${dark ? '#0a0a12' : '#d4d0c8'};`;
    return `border-top:2px solid ${dark ? '#2a2a4a' : '#fff'};border-left:2px solid ${dark ? '#2a2a4a' : '#fff'};border-right:2px solid ${dark ? '#000' : '#7a7a7a'};border-bottom:2px solid ${dark ? '#000' : '#7a7a7a'};outline:1px solid ${dark ? '#1a1a2a' : '#d4d0c8'};`;
  }

  /** HTML-escapes a string for safe injection into innerHTML. */
  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
