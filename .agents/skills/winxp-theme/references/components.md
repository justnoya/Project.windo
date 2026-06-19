# XP Component Reference

Complete class listing and usage rules for every component in the theme. All classes are in `packages/client/src/winxp.css`.

---

## Window (`.xp-window`)

The fundamental container for every app.

```css
.xp-window {
  position: absolute;
  min-width: 300px; min-height: 200px;
  border-radius: var(--xp-radius-win);   /* 8px 8px 4px 4px */
  box-shadow: var(--xp-win-shadow);
  border: 1px solid var(--xp-win-border);
  outline: 1px solid rgba(255,255,255,0.3);
  outline-offset: -2px;
  display: flex; flex-direction: column;
  overflow: hidden; pointer-events: auto;
}
.xp-window.xp-win-hidden { display: none !important; }  /* minimized state */
```

**Required inner structure (top to bottom):**
1. `.xp-titlebar` — always first
2. `.xp-menubar` — optional (omit if app has no menus)
3. `.xp-toolbar` — optional
4. `.xp-addrrow` — optional (address/breadcrumb bar like File Explorer)
5. `.xp-wbody` — required flex container for sidebar + content
6. `.xp-statusbar` — optional

---

## Title Bar (`.xp-titlebar`)

```html
<div class="xp-titlebar">
  <svg class="xp-win-icon" viewBox="0 0 48 48">...</svg>
  <span class="xp-win-title">Window Title</span>
  <div class="xp-win-btns">
    <button class="xp-wbtn xp-minimize">─</button>
    <button class="xp-wbtn xp-maximize">□</button>
    <button class="xp-wbtn xp-close">✕</button>
  </div>
</div>
```

- Height: `30px` (desktop), `38px` (mobile)
- Gradient: `var(--xp-title-grad)` (active), `var(--xp-title-inactive)` (unfocused)
- Title text: `color: #fff`, `font-size: 12px`, `font-weight: bold`, `font-family: var(--xp-font)`
- Title text-shadow: `1px 1px 3px rgba(0,0,0,0.6), 0 0 6px rgba(0,0,120,0.4)`
- The titlebar is the drag handle: `cursor: move`
- Add class `.xp-inactive` when window loses focus
- Icon: `width: 16px; height: 16px` (`.xp-win-icon`)
- For image icons (PNG/SVG files): use `.xp-win-icon-img` (same size, `margin-right: 4px`)

**Window control buttons** (`.xp-wbtn`): `22×22px`, `border-radius: 3px`. See css-variables.md for exact colors.

---

## Menu Bar (`.xp-menubar`)

```html
<div class="xp-menubar">
  <span class="xp-mitem">File</span>
  <span class="xp-mitem">Edit</span>
  <span class="xp-mitem">View</span>
  <span class="xp-mitem">Help</span>
</div>
```
- Height: `22px`, `background: var(--xp-win-bg)`, `border-bottom: 1px solid #aca899`
- `.xp-mitem`: `padding: 2px 8px`, hover: `background: #316ac5; color: #fff`

---

## Toolbar (`.xp-toolbar`)

```html
<div class="xp-toolbar">
  <button class="xp-nav">
    <svg viewBox="0 0 16 16">...</svg> Back
  </button>
  <div class="xp-toolbar-sep"></div>
  <button class="xp-nav">New Folder</button>
</div>
```
- Height: `36px`
- Background: `linear-gradient(180deg, #f8f7f3 0%, #ece9d8 100%)`
- `.xp-nav`: `height: 27px`, transparent border until hover
- Hover: `border-color: #316ac5; background: linear-gradient(180deg, #f0f4ff 0%, #d8e4f8 100%)`
- `.xp-toolbar-sep`: 1px vertical divider, `height: 22px`

---

## Address Bar (`.xp-addrrow`)

```html
<div class="xp-addrrow">
  <label>Address</label>
  <input class="xp-addr" type="text" readonly value="C:\Documents" />
</div>
```
- Height: `26px`
- Input: `height: 19px`, `border: 1px solid #7f9db9`, `border-radius: 2px`, `background: #fff`
- Inner shadow: `inset 1px 1px 3px rgba(0,0,0,0.12)`

---

## Window Body, Sidebar, Content

```html
<div class="xp-wbody">
  <div class="xp-sidebar">
    <div class="xp-sb-sec">
      <div class="xp-sb-title">File and Folder Tasks</div>
      <a class="xp-sb-link">
        <svg viewBox="0 0 16 16">...</svg>
        Make a new folder
      </a>
    </div>
  </div>
  <div class="xp-content">
    <!-- file items or app content -->
  </div>
</div>
```

**`.xp-wbody`**: `flex: 1; display: flex; overflow: hidden; background: #fff`

**`.xp-sidebar`**: `width: 170px; background: var(--xp-sidebar-bg); border-right: 2px solid #c4cfe8`
- Hidden on mobile via media query

**`.xp-sb-title`**: section header — gradient bg, `color: #003c74`, `font-weight: bold`
**`.xp-sb-link`**: `color: var(--xp-sidebar-link)`, underlined, hover turns `#ff6600`

**`.xp-content`**: scrollable main area, `background: #fff`, uses `flex-wrap: wrap` for icon grids

---

## File / Content Items (`.xp-fitem`)

```html
<div class="xp-fitem">
  <svg viewBox="0 0 48 48">...</svg>
  <span class="xp-flabel">My Documents</span>
</div>
```
- `width: 88px`, centered column layout
- Hover: `background: rgba(49,106,197,0.12); outline: 1px dotted #316ac5`
- Selected (`.xp-sel`): `background: #316ac5` — label color turns `#fff`
- Label: `font-size: 11px`, `word-break: break-word`, `max-width: 84px`
- Rename input (`.xp-frename`): white input with blue border + ring

---

## Status Bar (`.xp-statusbar`)

```html
<div class="xp-statusbar">
  <span class="xp-sb-part">3 objects</span>
  <span class="xp-sb-part">Disk free: 2.3 GB</span>
</div>
```
- Height: `22px`, `background: var(--xp-win-bg)`, `border-top: 1px solid #aca899`
- Inner top highlight: `inset 0 1px 0 rgba(255,255,255,0.6)`
- Each part separated by `border-right: 1px solid #aca899` with `margin-right: 12px`

---

## Desktop Icons (`.xp-icon`)

```html
<div class="xp-icon">
  <svg viewBox="0 0 48 48">...</svg>
  <span class="xp-icon-label">My Computer</span>
</div>
```
- `width: 80px`, flex column, centered
- SVG: `48×48px` with `drop-shadow(1px 2px 4px rgba(0,0,0,0.5))`
- Label: `color: #fff` with heavy multi-direction text-shadow for legibility on bliss wallpaper
- Hover: `background: rgba(49,106,197,0.30)` + dotted white outline
- Selected: `background: rgba(49,106,197,0.55)`

For image-based icons (`.xp-icon-img`): `48×48px`, `object-fit: contain`, same drop-shadow.

**Double-click detection** (no `dblclick` event — use pointer timing):
```typescript
let lastTap = 0;
el.addEventListener('pointerdown', () => {
  const now = Date.now();
  if (now - lastTap < 420) onOpen(); // double-click threshold
  lastTap = now;
});
```

---

## Taskbar (`.xp-taskbar`)

Pre-built by `WinXPDesktop` — never rebuild. Interact via:
- `document.getElementById('xp-programs')` — append taskbar buttons here
- `this.makeTbBtn(winId, label, iconSvg)` — creates a properly styled button
- `.xp-tb-active` class on button = window is focused/active

Taskbar button (`.xp-tb-btn`): `min-width: 120px; max-width: 180px; height: calc(--xp-taskbar-h - 8px)`
Bold white text, ellipsis overflow, semi-transparent gradient. Active state shows inset shadow.

---

## Start Menu (`.xp-start-menu`)

Pre-built by `WinXPDesktop`. Structure:
- `.xp-sm-header` — blue gradient bar with avatar + username
- `.xp-sm-body` → `.xp-sm-left` (recently used apps) + `.xp-sm-right` (hidden by default)
- `.xp-sm-item` — each app entry (32×32 icon + title + subtitle)
- `.xp-sm-sep` — horizontal divider `height: 1px; background: #c8d4e4`
- `.xp-sm-footer` — dark blue bar with Log Off / Turn Off buttons
- Hover: `background: #316ac5; color: #fff`

---

## Context Menu (`.xp-ctx`)

```html
<div class="xp-ctx" style="left: Xpx; top: Ypx;">
  <div class="xp-ctx-item">Open</div>
  <div class="xp-ctx-sep"></div>
  <div class="xp-ctx-item">Rename</div>
  <div class="xp-ctx-item xp-disabled">Delete</div>
</div>
```
- `position: fixed`, `z-index: 99999`
- `min-width: 175px`, `padding: 2px`
- Item hover: `background: #316ac5; color: #fff`
- Separator: `height: 1px; background: #d8d8d8; margin: 2px`

Always remove on `document.click` (next click outside).

---

## Dialog (`.xp-dialog`)

```html
<div class="xp-dialog-overlay">
  <div class="xp-dialog">
    <div class="xp-dlg-title">
      <!-- icon + title text -->
    </div>
    <div class="xp-dlg-body">
      <div class="xp-dlg-msg">Message text here.</div>
      <div class="xp-dlg-btns">
        <button class="xp-dlg-btn">OK</button>
        <button class="xp-dlg-btn">Cancel</button>
      </div>
    </div>
  </div>
</div>
```
- Overlay: `z-index: 99990`, centered flex, slight dim background
- Dialog: `background: var(--xp-win-bg)`, same window border + radius + shadow
- Title bar: `height: 28px`, same `--xp-title-grad`
- Button: `min-width: 75px; height: 23px`, `background: var(--xp-btn-grad)`, `border: 1px solid #7f9db9`

---

## Scrollbars

The CSS globally overrides WebKit scrollbars to 17px XP-style. These apply automatically. Do not override scrollbar styles in app-specific CSS.

---

## Multiplayer Cursors (`.xp-cursor`)

Pre-managed by `WinXPDesktop`. Do not instantiate manually.
The `.xp-cursor-name` label uses `background: rgba(0,0,0,0.75)`, `font-size: 10px`, rounded badge.

---

## Sticky Notes (`.xp-sticky`)

Yellow sticky notes: `background: #FFED6F` → `#FFE94A` gradient, `border: 1px solid #d4b600`.
Header (`.xp-sticky-header`): uses `var(--note-accent, #f0c000)` CSS custom property — can be overridden per-note for colour variety.
