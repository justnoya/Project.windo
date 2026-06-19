# CSS Variables & Design Tokens

All values are defined in `:root` at the top of `packages/client/src/winxp.css`. Never hard-code any color, gradient, shadow, or font string that exists here — always use the variable.

---

## Layout Tokens

```css
--xp-taskbar-h: 40px          /* taskbar height (48px on mobile) */
--xp-safe-bottom: env(safe-area-inset-bottom, 0px)  /* iOS notch clearance */
--xp-radius-win: 8px 8px 4px 4px   /* window border-radius (top corners rounded, bottom square) */
```

---

## Color & Gradient Tokens

### Title Bar (active window) — Luna Royal Blue
```css
--xp-title-grad: linear-gradient(180deg,
  #4d90fe 0%, #3479ee 3%, #2567e0 8%,
  #1a5dd5 45%, #1458CC 50%,
  #1e62d8 55%, #2878e6 70%, #1c66d4 100%);
```
- This exact gradient is mandatory for all active window titlebars
- Never substitute a flat color or a simpler gradient

### Title Bar (inactive window)
```css
--xp-title-inactive: linear-gradient(180deg, #9ab4d6 0%, #728fbd 100%);
```
Applied with class `.xp-inactive` on `.xp-titlebar`.

### Taskbar
```css
--xp-tb-grad: linear-gradient(180deg,
  #3c8ce8 0%, #2477d8 4%, #1e72d2 50%,
  #1a68c8 51%, #1c6ccc 100%);
--xp-tb-border: #1054a6        /* top border of taskbar */
--xp-tb-tray: linear-gradient(180deg, #0f44a0 0%, #0b3a90 50%, #093580 100%)  /* clock/tray section */
```

### Start Button
```css
--xp-start-grad: linear-gradient(180deg,
  #79C724 0%, #55A812 40%, #408004 55%, #4EA816 100%);
--xp-start-hover: linear-gradient(180deg,
  #89D734 0%, #65B822 40%, #508814 55%, #5EB826 100%);
```
Active state: `linear-gradient(180deg, #3c7804 0%, #4e9810 100%)`

### Window Chrome
```css
--xp-win-bg: #ece9d8           /* window content background / menu bar / toolbar */
--xp-win-border: #0831d9       /* window outer border (1px solid) */
--xp-win-border-inner: rgba(255,255,255,0.6)  /* inner highlight ring */
--xp-win-shadow: 4px 6px 16px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.18)
```

### Buttons (standard dialog/toolbar buttons)
```css
--xp-btn-grad: linear-gradient(180deg, #f4f2ec 0%, #d6d3c8 100%)
--xp-btn-border: #7f9db9
```
Hover: `linear-gradient(180deg, #fff 0%, #e4e0d8 100%)` with `border-color: #316ac5`
Active: `linear-gradient(180deg, #d8d4cc 0%, #f0ede4 100%)`

### Sidebar
```css
--xp-sidebar-bg: #eef3fc
--xp-sidebar-link: #1452a8     /* link color; hover is #ff6600 */
```

### Selection / Focus
```css
--xp-blue-select: #316ac5      /* list selection highlight, focus rings */
```

### Typography
```css
--xp-font: Tahoma, 'Microsoft Sans Serif', Arial, sans-serif
--xp-font-size: 11px
```

---

## Raw Colors Used Directly (memorize these)

These appear frequently without a CSS variable — they are correct values to reuse:

| Purpose | Value |
|---------|-------|
| Window body background (white content area) | `#fff` |
| Menu/toolbar border | `#aca899` |
| Toolbar gradient | `linear-gradient(180deg, #f8f7f3 0%, #ece9d8 100%)` |
| Sidebar section title bg | `linear-gradient(90deg, #c8daf4 0%, var(--xp-sidebar-bg) 100%)` |
| Sidebar section title border | `#a8c4e0` |
| Sidebar title text | `#003c74` |
| Context menu bg | `#fff` with `border: 1px solid #8a8a8a` |
| Context menu shadow | `3px 3px 7px rgba(0,0,0,0.35), 1px 1px 0 rgba(255,255,255,0.5) inset` |
| Status bar bg | `var(--xp-win-bg)` with `border-top: 1px solid #aca899` |
| Scrollbar track | `#f0ede5` |
| Scrollbar thumb | `linear-gradient(90deg, #dbd7ce 0%, #c8c4bc 50%, #b8b4ac 100%)` |
| Scrollbar button bg | `linear-gradient(180deg, #ece9de 0%, #d8d4c8 100%)` |
| Scrollbar border | `#8a8880` |

---

## Window Control Buttons (`.xp-wbtn`)

Standard minimize/maximize buttons:
```css
background: linear-gradient(180deg, #6098e8 0%, #3272c2 50%, #2060b0 100%);
border: 1px solid rgba(0,0,60,0.5);
box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2);
```
Hover: `linear-gradient(180deg, #80b8f8 0%, #5090e0 50%, #3878d0 100%)`

Close button (`.xp-close`):
```css
background: linear-gradient(180deg, #e07070 0%, #cc2424 50%, #aa1c1c 100%);
margin-left: 2px;  /* slight separation from min/max */
```
Hover: `linear-gradient(180deg, #f09090 0%, #e03838 50%, #c02828 100%)`

---

## z-Index Layers (never break this stack)

| Layer | z-index | What lives here |
|-------|---------|-----------------|
| Desktop icons | 10 | `.xp-desktop-icons` |
| Windows | 100+ (dynamic) | `.xp-window` — managed by `nextZ()` |
| Sticky notes | 8500 | `.xp-sticky` |
| Taskbar | 9000 | `.xp-taskbar` |
| Start menu | 9500 | `.xp-start-menu` |
| Splash/login/lobby overlays | 9997–9999 | Full-screen scene overlays |
| Dialog overlays | 99990 | `.xp-dialog-overlay` |
| Context menus | 99999 | `.xp-ctx` |
| Multiplayer cursors | 99998 | `.xp-cursor` |
| Notifications | 999999 | `.mxp-notif-container` |
