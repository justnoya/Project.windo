---
name: xp-app-integration
description: >
  Step-by-step guide for adding a new application window to the Windows XP
  desktop in this project. Use when the user asks to add a new app, feature
  window, desktop icon, or Start Menu entry to the WinXP Activity.
---

# Adding a New XP Desktop Application

This project renders a Windows XP desktop as a Discord Activity. Each "app"
is a draggable XP-styled window opened from a desktop icon and tracked in the
taskbar. Follow these steps to integrate a new one cleanly.

## Architecture Overview

```
packages/client/src/
├── types/desktop.ts          ← WinState, StickyNote, IDesktopContext
├── features/
│   └── WhoYouPlay.ts         ← reference implementation of a feature module
├── scenes/
│   └── WinXPDesktop.ts       ← desktop orchestrator (icons, taskbar, windows)
└── winxp.css                 ← all XP theme styles
```

## Step 1 — Create the feature file

Create `packages/client/src/features/YourFeature.ts`.

```typescript
import { SoundManager } from '../utils/SoundManager';
import type { IDesktopContext, WinState } from '../types/desktop';

const WIN_ID = 'yourfeature'; // must be globally unique

export class YourFeature {
  constructor(private ctx: IDesktopContext) {}

  open(): void {
    this.ctx.trackRecent(WIN_ID, 'Your Feature', `<span>🖼️</span>`, () => this.open());

    // Focus if already open
    if (this.ctx.wins.has(WIN_ID)) {
      const ws = this.ctx.wins.get(WIN_ID)!;
      ws.minimized ? this.ctx.restoreWin(WIN_ID) : this.ctx.bringFront(WIN_ID);
      return;
    }

    SoundManager.windowOpen();
    const win = document.createElement('div');
    win.className = 'xp-window';
    win.id = `win-${WIN_ID}`;
    win.style.zIndex = String(this.ctx.nextZ());
    win.innerHTML = `
      <div class="xp-titlebar">
        <span class="xp-win-title">Your Feature</span>
        <div class="xp-win-btns">
          <button class="xp-wbtn" id="min-${WIN_ID}">─</button>
          <button class="xp-wbtn" id="max-${WIN_ID}">☐</button>
          <button class="xp-wbtn xp-close" id="cls-${WIN_ID}">✕</button>
        </div>
      </div>
      <div class="your-feature-body"><!-- content here --></div>`;

    this.ctx.overlay.appendChild(win);
    this.ctx.positionWin(win);
    this.ctx.wins.set(WIN_ID, {
      el: win,
      titlebar: win.querySelector<HTMLElement>('.xp-titlebar')!,
      minimized: false,
      maximized: false,
    });
    this.ctx.makeDraggable(WIN_ID);
    this.ctx.bringFront(WIN_ID);

    win.querySelector(`#min-${WIN_ID}`)!
      .addEventListener('click', e => { e.stopPropagation(); this.ctx.minimizeWin(WIN_ID); });
    win.querySelector(`#max-${WIN_ID}`)!
      .addEventListener('click', e => { e.stopPropagation(); this.ctx.toggleMax(WIN_ID); });
    win.querySelector(`#cls-${WIN_ID}`)!
      .addEventListener('click', e => { e.stopPropagation(); this.ctx.closeWin(WIN_ID); });
    win.addEventListener('pointerdown', () => this.ctx.bringFront(WIN_ID));

    const tbBtn = this.ctx.makeTbBtn(WIN_ID, 'Your Feature', '');
    document.getElementById('xp-programs')?.appendChild(tbBtn);
    this.ctx.tbBtns.set(WIN_ID, tbBtn);
  }
}
```

## Step 2 — Register in WinXPDesktop.ts

```typescript
// 1. Import at top of file
import { YourFeature } from '../features/YourFeature';

// 2. Add private field to the class
private yourFeature!: YourFeature;

// 3. Instantiate in create() — after this.fs is set up
this.yourFeature = new YourFeature(this);

// 4. Add desktop icon in buildDesktopIcons()
area.appendChild(
  this.makeDesktopIconImg('Your Feature', '/your-icon.svg', () => this.yourFeature.open())
);
// OR with an inline SVG:
area.appendChild(
  this.makeDesktopIcon('Your Feature', Icons.someIcon, () => this.yourFeature.open())
);
```

## Step 3 — Add an icon

Place a 48×48 SVG at `packages/client/public/your-icon.svg`.
See `wyp-icon.svg` for an example of a well-structured icon file.

## Step 4 — Add CSS (if needed)

Append feature-specific styles to `packages/client/src/winxp.css` under a
clear section header:

```css
/* ═══ YOUR FEATURE ══════════════════════════════════════════════════════════ */
.your-feature-body { padding: 12px; font-family: Tahoma, Arial, sans-serif; }
```

Reuse existing XP utility classes wherever possible:
- `.xp-window` — standard window shell (border, shadow)
- `.xp-titlebar` — Luna blue title bar
- `.xp-wbtn` — minimize/maximize/close buttons
- `.xp-close` — red close button style

## Step 5 — Verify the build

```bash
cd packages/client && npm run build
```

If TypeScript errors appear on `IDesktopContext`, the method you need may
not be exposed yet — add it to `src/types/desktop.ts` and implement it as
a public method on `WinXPDesktop`.

## IDesktopContext reference

| Member | Type | Purpose |
|--------|------|---------|
| `overlay` | `HTMLDivElement` | Full-screen DOM container for all windows |
| `wins` | `Map<string, WinState>` | Open window registry |
| `tbBtns` | `Map<string, HTMLElement>` | Taskbar button registry |
| `nextZ()` | `() => number` | Get next z-index (auto-increments) |
| `bringFront(id)` | method | Focus a window |
| `positionWin(el)` | method | Place a new window with stagger offset |
| `makeDraggable(id)` | method | Enable drag-to-move on a window |
| `closeWin(id)` | method | Close and remove a window + taskbar button |
| `minimizeWin(id)` | method | Minimize to taskbar |
| `restoreWin(id)` | method | Restore from minimized |
| `toggleMax(id)` | method | Toggle maximize/restore |
| `makeTbBtn(id, label, svg)` | method | Create a taskbar button element |
| `trackRecent(id, label, html, fn)` | method | Add to Start Menu recent apps |

## Notes

- `WIN_ID` must be unique across all features — collisions break the window map.
- Always call `SoundManager.windowOpen()` when first creating the window.
- The `IDesktopContext` interface in `types/desktop.ts` is the contract.
  Add new methods there (and implement them as `public` on `WinXPDesktop`)
  when a feature needs something new.
- The `WhoYouPlay.ts` feature is the canonical reference implementation.
