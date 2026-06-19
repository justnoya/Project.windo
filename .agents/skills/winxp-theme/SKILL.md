---
name: winxp-theme
description: Master reference for the Windows XP Luna theme used in this project. Load this skill for ANY UI task — new features, components, windows, buttons, layouts, or styling. If a user asks to build, redesign, or style anything visual in this project, this skill is required. Enforces strict XP Luna authenticity: no alien UI frameworks, no flat/material/tailwind aesthetics, no Bootstrap, no arbitrary colors. Every pixel must look like Windows XP or it is rejected.
---

# Windows XP Luna — Master UI Skill

This project uses a hand-crafted, pixel-accurate recreation of the Windows XP Luna Blue theme. There is no UI framework (no Bootstrap, Tailwind, MUI, etc.). Every visual element is built with raw HTML + CSS classes defined in `packages/client/src/winxp.css`.

**The rule is absolute: all new UI must use XP Luna classes and design tokens. Anything that looks "modern", "flat", or "Material" is wrong.**

## When to Use

- Building any new feature window or app
- Adding buttons, inputs, dialogs, menus, or lists
- Writing any CSS for this project
- Reviewing or modifying existing UI code
- Any task where "what should this look like?" is a question

## Reference Files — Read Before Building

| File | When to read |
|------|-------------|
| `references/css-variables.md` | Before writing any color, gradient, shadow, font, or size value |
| `references/components.md` | Before building any window, button, input, menu, or list |
| `references/typography.md` | Before writing any text style, font-family, or text-shadow |
| `references/animations.md` | Before writing any transition, animation, or keyframe |
| `references/forbidden-patterns.md` | Read once — what is NEVER allowed |

Always read `references/components.md` and `references/css-variables.md` at minimum.

---

## Core Architecture

### The Overlay System

Everything visual lives inside a single `div.xp-overlay` that sits above the Phaser canvas:

```html
<div class="xp-overlay">
  <!-- all windows, taskbar, icons, menus go here -->
</div>
```

- `xp-overlay` is `position: fixed; inset: 0; pointer-events: none; z-index: 1000`
- Individual interactive elements set `pointer-events: auto` on themselves
- Never use `document.body` or Phaser GameObjects for UI — always `xp-overlay`

### Window Registry

Every open window is tracked in `this.wins: Map<string, WinState>` (see `src/types/desktop.ts`). When building a feature, you get a window element back and register it:

```typescript
const winEl = /* build your window HTML */;
this.overlay.appendChild(winEl);
this.wins.set(winId, { el: winEl, titlebar, minimized: false, maximized: false });
this.positionWin(winEl);
this.makeDraggable(winId);
const tbBtn = this.makeTbBtn(winId, 'Window Title', iconSvg);
document.getElementById('xp-programs')!.appendChild(tbBtn);
this.tbBtns.set(winId, tbBtn);
```

### CSS Class Naming Convention

- `xp-*` — core desktop chrome (windows, taskbar, icons, menus, dialogs)
- `mxp-*` — Miscord app (the horror-themed messenger; Courier New, dark reds)
- `wyp-*` — Who You Play quiz (escalating dark theme)
- New apps: pick a short prefix, e.g. `calc-*`, `paint-*`, `notes-*`

---

## Building a New XP Window — Quick Template

```typescript
// 1. Build the window element
const win = document.createElement('div');
win.className = 'xp-window my-app-window';
win.style.zIndex = String(this.nextZ());
win.innerHTML = `
  <div class="xp-titlebar" id="myapp-tb">
    <svg class="xp-win-icon" viewBox="0 0 48 48">${iconSvg}</svg>
    <span class="xp-win-title">My App</span>
    <div class="xp-win-btns">
      <button class="xp-wbtn xp-minimize" title="Minimize">─</button>
      <button class="xp-wbtn xp-maximize" title="Maximize">□</button>
      <button class="xp-wbtn xp-close" title="Close">✕</button>
    </div>
  </div>
  <div class="xp-menubar">
    <span class="xp-mitem">File</span>
    <span class="xp-mitem">Edit</span>
    <span class="xp-mitem">Help</span>
  </div>
  <div class="xp-wbody">
    <div class="xp-sidebar">
      <!-- optional left sidebar -->
    </div>
    <div class="xp-content">
      <!-- main content -->
    </div>
  </div>
  <div class="xp-statusbar">
    <span class="xp-sb-part">Ready</span>
  </div>
`;

// 2. Wire close/min/max buttons using desktop methods
win.querySelector('.xp-close')!.addEventListener('click', () => this.closeWin(winId));
win.querySelector('.xp-minimize')!.addEventListener('click', () => this.minimizeWin(winId));
win.querySelector('.xp-maximize')!.addEventListener('click', () => this.toggleMax(winId));
```

---

## Adding App-Specific CSS

All CSS goes in `packages/client/src/winxp.css`. Add a clearly marked section at the bottom:

```css
/* ═══════════════════════════════════════════════════════════════
   MY APP NAME
   ═══════════════════════════════════════════════════════════════ */

.myapp-window {
  min-width: 400px;
  min-height: 300px;
}
```

Use the exact `═══` section banner style. Never create a separate CSS file.

---

## Icons

All icons are inline SVG strings in `src/XPIcons.ts`. Each is an SVG inner-HTML for `viewBox="0 0 48 48"` (desktop/window icons) or `viewBox="0 0 16 16"` (toolbar icons).

To add a new icon: append it as a named export to `XPIcons.ts`. Use the same flat pixel-art style with bold fills and subtle strokes. Reference the existing icons for color conventions (folders = gold `#FFD700`/`#E8A000`, drives = slate blue, etc.).

---

## Sound

Always call `SoundManager` for interactions:

```typescript
import { SoundManager } from '../utils/SoundManager';

SoundManager.click();          // single click / selection
SoundManager.dblClick();       // double-click / open action
SoundManager.windowClose();    // window close
SoundManager.windowMinimize(); // minimize
SoundManager.windowRestore();  // restore from taskbar
```

Never use `new Audio()` or `HTMLAudioElement` directly.

---

## Mobile Rules

- On `window.innerWidth < 768`: windows go full-screen (CSS handles this with `@media (max-width: 767px)`)
- `positionWin()` skips positioning on mobile — do not fight this
- `makeDraggable()` skips on mobile — titles are not draggable on touch
- Hide sidebars on mobile with `.xp-sidebar { display: none }` (already in the media query)
- Taskbar height increases to `48px` on mobile (CSS var `--xp-taskbar-h`)

---

## Custom Cursor

The project uses authentic XP cursors served from `/public/cursors/`:
- `arrow.svg` — default
- `pointer.svg` — clickable elements
- `text.svg` — text inputs
- `move.svg` — draggable titlebars

The CSS automatically assigns these via the cursor rules at the bottom of `winxp.css`. New clickable elements that are not buttons should have their selector added to the `.xp-overlay button, ...` pointer cursor rule.
