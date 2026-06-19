# Animations & Transitions

## Principles

1. XP is snappy — most transitions are `0.05s–0.2s`. Nothing slow and floaty.
2. Button state changes (`hover`, `active`) use `transition: background 0.05s` — nearly instant.
3. Window open/close use no CSS animation — they appear/disappear instantly (matching real XP behavior). The exception is feature-specific dramatic windows (WYP quiz) which may fade.
4. Do not use `ease-in-out` for standard chrome — use `ease` or linear. Reserve `cubic-bezier(0.22,1,0.36,1)` for slide-in entry animations only.

---

## Standard Transitions (copy-paste these)

### Button hover (nearly instant — XP feel)
```css
transition: background 0.05s;
```

### Taskbar button
```css
/* no transition needed — XP taskbar buttons snap */
```

### Login/lobby card entry (slide up + scale)
```css
animation: loginCardIn 0.55s cubic-bezier(0.22,1,0.36,1) 0.25s both;

@keyframes loginCardIn {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

### Text slide-in (splash, preloader)
```css
animation: splashSlideIn 0.8s cubic-bezier(0.22,1,0.36,1) 0.4s forwards;

@keyframes splashSlideIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Sticky note pop-in
```css
animation: noteIn 0.2s cubic-bezier(0.22,1,0.36,1) both;

@keyframes noteIn {
  from { opacity: 0; transform: scale(0.82) rotate(-4deg); }
  to   { opacity: 1; transform: scale(1) rotate(0deg); }
}
```

### Lobby slot fill (multiplayer player appears)
```css
animation: lobbySlotIn 0.35s cubic-bezier(0.22,1,0.36,1) both;

@keyframes lobbySlotIn {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
```

### Preloader logo appear
```css
animation: preLogoIn 1s cubic-bezier(0.22,1,0.36,1) 0.2s both;

@keyframes preLogoIn {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
```

### Fade in + slide up (general purpose)
```css
animation: gmFadeIn 0.6s ease both;

@keyframes gmFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Cursor Position (Multiplayer)
```css
.xp-cursor {
  transition: left 0.055s linear, top 0.055s linear;
  will-change: left, top;
}
```
Very short linear transition for smooth but low-latency cursor following.

---

## Blinking / Pulsing

### Cursor blink (splash, preloader)
```css
@keyframes splashBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
animation: splashBlink 0.8s step-end infinite;
```
Use `step-end` for authentic digital blink (not fade).

### Game menu subtitle blink
```css
@keyframes gmBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
animation: gmBlink 1.4s step-end infinite;
```

### Logo pulse (game menu Discord icon)
```css
@keyframes gmPulse {
  0%, 100% { box-shadow: 0 0 30px rgba(88,101,242,0.6), 0 0 60px rgba(88,101,242,0.2); }
  50%       { box-shadow: 0 0 40px rgba(88,101,242,0.9), 0 0 80px rgba(88,101,242,0.35); }
}
animation: gmPulse 2.4s ease-in-out infinite;
```

### Miscord horror pulse (red glow)
```css
@keyframes mxp-pulse-red {
  0%, 100% { box-shadow: 0 0 4px #cc000077; opacity: 1; }
  50%       { box-shadow: 0 0 9px #cc0000bb; opacity: 0.6; }
}
```

### Miscord flicker (horror lights)
```css
@keyframes mxp-flicker {
  0%, 38%, 40%, 100% { opacity: 1; }
  39%  { opacity: 0.82; }
  78%, 80% { opacity: 1; }
  79%  { opacity: 0.9; }
}
animation: mxp-flicker 9s infinite;
```

---

## Glitch Effects (WYP / horror contexts only)

### Text glitch (RGB split)
```css
@keyframes splashGlitch {
  0%, 90%, 100% {
    text-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 20px rgba(100,160,255,0.6), 2px 2px 0 #1a3a8a;
    transform: translate(0);
  }
  91% { text-shadow: -3px 0 #ff3c3c, 3px 0 #3cffee; transform: translate(-2px, 0); }
  92% { text-shadow: 3px 0 #ff3c3c, -3px 0 #3cffee; transform: translate(2px, 0); }
  93% { text-shadow: 0 0 8px rgba(255,255,255,0.8); transform: translate(0); }
}
```
Glitch fires rarely (91-93% keyframes) — most of the time it is clean.

### Scanlines overlay (WYP deep phases, game menu, lobby)
```css
background: repeating-linear-gradient(
  0deg,
  transparent, transparent 2px,
  rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px
);
pointer-events: none;
position: absolute;
inset: 0;
z-index: 1;
```

### Scrolling scanlines (splash screen)
```css
animation: scanroll 8s linear infinite;

@keyframes scanroll {
  from { background-position: 0 0; }
  to   { background-position: 0 100px; }
}
```

---

## Notification Slide (Miscord)

```css
@keyframes mxp-notify-in  {
  from { transform: translateX(110%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
@keyframes mxp-notify-out {
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(110%); opacity: 0; }
}
animation: mxp-notify-in 0.22s ease;
```

---

## WYP Quiz Content Fade

```css
@keyframes wyp-fadein {
  from { opacity: 0; transform: scale(1.03); }
  to   { opacity: 1; transform: scale(1); }
}
```
Used when quiz phase changes to transition content.

---

## What NOT to Animate

- Window open/close — instant (no animation, matches real XP)
- Start menu open/close — instant (`display: none` → `display: block`)
- Context menu appear — instant
- Hover color changes on menus/items — instant (no transition)
- File item selection — instant

Real Windows XP has very few animations. Snap and click feel is part of the identity.
