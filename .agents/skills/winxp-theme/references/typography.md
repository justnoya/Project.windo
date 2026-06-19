# Typography Rules

## Fonts

This project uses exactly three font stacks. Never introduce others.

### 1. Tahoma — UI Font (default everywhere)
```css
font-family: Tahoma, 'Microsoft Sans Serif', Arial, sans-serif;
```
Used for: all window content, menus, toolbars, status bars, dialog text, taskbar buttons, labels.
Always at `11px` for chrome elements, `12px` for dialog messages, `13px` for larger labels.

### 2. Press Start 2P — Pixel/Retro Font
```css
font-family: 'Press Start 2P', 'Courier New', monospace;
```
Used for: Game Menu titles, Multiplayer Lobby titles, preloader text, splash "MADE BY" line, system-wide retro/gaming UI moments.
**Do not use this inside XP windows** — it belongs to the boot/menu layer only.

### 3. VT323 — CRT Terminal Font
```css
font-family: 'VT323', 'Courier New', monospace;
```
Used for: splash screen handle/username display, CRT aesthetic moments.
Only one usage in the project (splash `@just.tiwari` handle).

### 4. Courier New — Horror/Terminal Override
```css
font-family: 'Courier New', Courier, monospace;
```
Used exclusively in Miscord (the horror messenger): all `mxp-*` elements.
**Never use Courier New in standard XP windows.**

### 5. Franklin Gothic / Arial Narrow — Login Screen Only
```css
font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif;
```
Used only for login screen "Windows" branding text (italic bold, large).

---

## Font Sizes

| Context | Size |
|---------|------|
| Standard chrome (menus, buttons, labels) | `11px` |
| Window title text | `12px` |
| Start button | `14px` (italic bold) |
| Dialog messages | `11px` |
| Status bar | `11px` |
| Sidebar links | `11px` |
| Icon labels | `11px` |
| Section headers (small caps) | `10px` |
| Taskbar clock | `11px` |
| Context menu | `11px` |
| Scrollbar | N/A |
| Tiny metadata / hints | `9px–10px` |

---

## Text Shadows

XP UI uses text-shadow extensively for legibility and the characteristic "glowing" look.

### Window title (active)
```css
text-shadow: 1px 1px 3px rgba(0,0,0,0.6), 0 0 6px rgba(0,0,120,0.4);
```

### Desktop icon labels (on wallpaper)
```css
text-shadow:
  1px 1px 2px #000,
  -1px -1px 2px #000,
  1px -1px 2px #000,
  -1px 1px 2px #000,
  0 0 4px #000;
```
Heavy multi-directional shadow for legibility on the bliss wallpaper.

### Start button
```css
text-shadow: 1px 1px 2px rgba(0,0,0,0.7), 0 0 4px rgba(0,80,0,0.4);
```

### Taskbar clock
```css
text-shadow: 1px 1px 2px rgba(0,0,0,0.6);
```

### Taskbar button text
```css
text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
```

### Buttons and labels on dark backgrounds (login, lobby)
```css
text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
```

### Splash screen "glitch" effect
```css
text-shadow:
  0 0 8px rgba(255,255,255,0.8),
  0 0 20px rgba(100,160,255,0.6),
  2px 2px 0 #1a3a8a;
```

---

## Text Rendering

The overlay uses:
```css
-webkit-font-smoothing: subpixel-antialiased;
```
This mimics Windows ClearType rendering. Do not set `font-smooth: never` or `antialiased` — subpixel is correct for XP.

---

## Text Selection

Most chrome elements set:
```css
-webkit-user-select: none;
user-select: none;
```
This is critical for titlebar, desktop icons, taskbar, and menus — users should not accidentally select text when clicking.

Only content areas (file labels being renamed, chat inputs, sticky note text) allow selection.

---

## Letter Spacing

- Standard UI: none (default) or very subtle `0.2px–0.3px`
- Start button: `letter-spacing: 0.3px`
- Window title: `letter-spacing: 0.2px`
- Login branding: `letter-spacing: 0.03em`
- "Press Start 2P" retro titles: `letter-spacing: 0.04em–0.18em` (wider spacing fits the pixel font)
- `UPPERCASE` labels (Miscord, horror sections): `letter-spacing: 0.08em–0.15em`

---

## Line Heights

- General content: `line-height: 1.3–1.55`
- Chat messages: `line-height: 1.6`
- Dialog messages: `line-height: 1.5`
- Sticky note body: `line-height: 1.55`
- Retro/horror elements: `line-height: 1.9` (very open, CRT feel)
