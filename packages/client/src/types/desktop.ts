/**
 * Shared type definitions for the Windows XP desktop environment.
 * Used by WinXPDesktop and all feature modules (WhoYouPlay, etc.).
 */

/** Tracks the DOM state and metadata of an open XP window. */
export interface WinState {
  el: HTMLElement;
  titlebar: HTMLElement;
  minimized: boolean;
  maximized: boolean;
  /** Saved geometry used to restore a maximized window. */
  prev?: { left: string; top: string; width: string; height: string };
}

/** A sticky note placed on the desktop by a player (synced via Colyseus). */
export interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  author: string;
  sessionId: string;
}

/**
 * Minimal surface that feature modules need from WinXPDesktop.
 *
 * TypeScript uses structural typing — WinXPDesktop satisfies this interface
 * automatically as long as it exposes these members. No explicit `implements`
 * keyword required.
 *
 * When adding a new feature module, extend this interface with only the
 * methods it genuinely needs. Keep it narrow.
 */
export interface IDesktopContext {
  /** Full-screen DOM overlay that contains all XP windows. */
  overlay: HTMLDivElement;
  /** All currently open windows, keyed by winId. */
  wins: Map<string, WinState>;
  /** Taskbar button elements, keyed by winId. */
  tbBtns: Map<string, HTMLElement>;

  /** Returns the next z-index value (increments the internal counter). */
  nextZ(): number;

  // ── Window lifecycle ──────────────────────────────────────────────────────
  bringFront(winId: string): void;
  makeDraggable(winId: string): void;
  positionWin(el: HTMLElement): void;
  closeWin(winId: string): void;
  minimizeWin(winId: string): void;
  restoreWin(winId: string): void;
  toggleMax(winId: string): void;

  // ── Taskbar & Start Menu ─────────────────────────────────────────────────
  makeTbBtn(winId: string, label: string, iconSvg: string): HTMLElement;
  trackRecent(id: string, label: string, iconHtml: string, action: () => void): void;
}
