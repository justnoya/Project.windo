# Forbidden Patterns — What Is Never Allowed

This project enforces strict Windows XP Luna authenticity. The following are hard rejections. If you are about to do any of these, stop and use the correct XP pattern instead.

---

## Forbidden CSS / Styling

### ❌ Flat backgrounds
```css
/* WRONG — flat, modern look */
background: #4285f4;
background: #e8eaf6;
```
```css
/* CORRECT — always use gradients for interactive elements */
background: var(--xp-title-grad);
background: var(--xp-btn-grad);
```

### ❌ border-radius > 8px on windows or buttons
```css
/* WRONG — too rounded, looks Material/iOS */
border-radius: 12px;
border-radius: 50%;
```
```css
/* CORRECT */
border-radius: var(--xp-radius-win); /* 8px 8px 4px 4px */
border-radius: 3px;  /* buttons */
border-radius: 12px; /* ONLY the Start button — nothing else */
```

### ❌ box-shadow without inset highlights
```css
/* WRONG — modern flat shadow */
box-shadow: 0 4px 6px rgba(0,0,0,0.1);
```
```css
/* CORRECT — XP always adds inner highlight */
box-shadow: var(--xp-win-shadow);
/* or */
box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2);
```

### ❌ Tailwind utility classes
There is no Tailwind in this project. Classes like `flex`, `p-4`, `bg-blue-500`, `rounded-lg`, `text-sm`, `hover:bg-gray-100` do not exist.

### ❌ CSS frameworks (Bootstrap, MUI, Bulma, etc.)
Do not import or use any external UI library. Everything is hand-crafted.

### ❌ CSS custom properties not defined in `:root`
Do not invent new `--my-color` variables. Use existing tokens from `css-variables.md` or write raw values matching the XP palette.

### ❌ Fonts not in the project
Do not use Google Fonts other than `Press Start 2P` and `VT323` (already imported). Do not use `system-ui`, `Inter`, `Roboto`, `SF Pro`, etc.

### ❌ SVG icons from icon libraries (Heroicons, Lucide, Font Awesome, etc.)
All icons are hand-drawn inline SVG in `XPIcons.ts`. Add new ones there. Do not `npm install` an icon library.

### ❌ `display: flex` with `gap` on menu items that hover-highlight
Context menus and start menu items use `padding` for hit area, not gap between flex children. Always test that the full item row highlights on hover.

### ❌ `transition: all`
Only transition the specific property that changes. `transition: all` causes janky behavior on XP elements.

### ❌ `opacity: 0.5` as disabled state
Use `.xp-disabled` class which sets `opacity: 0.55` and correct cursor. Never roll your own disabled styling.

---

## Forbidden HTML Structure

### ❌ Raw `<div>` without XP classes as a window
Every window must use `.xp-window` as its root class. A bare div sitting in the overlay is wrong.

### ❌ Creating a second overlay
There is one `div.xp-overlay`. Do not create a second full-screen fixed div for your feature. Everything goes into the existing overlay.

### ❌ Appending to `document.body` directly
All UI elements go into `this.overlay` (the `.xp-overlay` div). Appending to `document.body` skips the z-index layer system and the overlay's `pointer-events: none` base.

### ❌ Using Phaser GameObjects for UI text or buttons
Phaser is for the Bliss wallpaper and game canvas only. All interactive UI is DOM/HTML. Do not create `this.add.text()` or `this.add.image()` for UI elements.

### ❌ Missing `pointer-events: auto` on interactive elements
The overlay root is `pointer-events: none`. Every clickable element (buttons, icons, windows) must restore pointer events. The `.xp-window` class does this already, but custom containers must too.

---

## Forbidden JavaScript Patterns

### ❌ `new Audio()` for sound
```typescript
// WRONG
new Audio('/sounds/click.mp3').play();
```
```typescript
// CORRECT
import { SoundManager } from '../utils/SoundManager';
SoundManager.click();
```

### ❌ Direct `zIndex` assignment without `nextZ()`
```typescript
// WRONG
win.style.zIndex = '200';
```
```typescript
// CORRECT
win.style.zIndex = String(this.nextZ());
```
Without `nextZ()`, windows will fight each other for z-position and the layer system breaks.

### ❌ `addEventListener('dblclick', ...)` for desktop icons
Real XP uses a 420ms double-tap detection via `pointerdown` timestamps. The `dblclick` event is unreliable on touch devices and has different timing characteristics. See the desktop icon section in `components.md`.

### ❌ Hardcoding window positions
```typescript
// WRONG
win.style.left = '100px';
win.style.top = '50px';
```
```typescript
// CORRECT
this.positionWin(win);  // uses cascade offset + viewport bounds
```

### ❌ Skipping window registration in `this.wins`
Every window must be registered so minimize/restore/close/bringFront work correctly.

---

## Forbidden Aesthetic Decisions

### ❌ Drop shadows that are too soft or too large
XP shadows are crisp and moderate: `4px 6px 16px rgba(0,0,0,0.55)`. Never `blur: 40px` or `blur: 2px` — both look wrong.

### ❌ Transparent window bodies
XP windows have opaque content areas (`#fff` or `#ece9d8`). No frosted glass, no `backdrop-filter`, no `rgba` window backgrounds.

### ❌ Dark mode windows (unless it's a horror/WYP app)
Standard XP windows are light. Only Miscord and WYP phases 3–4 use dark themes, and those are intentional horror features with their own CSS namespaces.

### ❌ Emoji in window titles
XP window titles use plain text + a 16×16 icon. No emoji.

### ❌ Animated titlebars on standard windows
The titlebar gradient is static. Only the `wyp-titlebar` transitions its gradient (phase changes). No CSS animations on normal window titlebars.

### ❌ Icon sizes other than 48×48 (desktop) or 16×16 (toolbar/menu)
XP uses these two sizes exclusively. Do not introduce 24×24, 32×32, or 64×64 in UI contexts.
