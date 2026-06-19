---
name: WYP Feature
description: Who You Play — psychological quiz app added to WinXP desktop.
---

# WYP Feature Implementation

**What:** Single-player psychological quiz (no multiplayer). Opens as an XP window from desktop icon.

**Phase escalation:** 1=Icebreaker (XP blue), 2=Getting Personal (darker blue), 3=The Deep End (dark/purple/glitch), 4=It Knows You (black/red/blood).

**8 Questions:** mix of choice (radio buttons) and input (textarea). 2 per phase.

**4 Results:** Ghost 👻, Performer 🎭, Absorber 🕳️, Signal ⚡.

**Why single-player:** The new WYP is a personal reflection quiz (wyp.exe repo style), not a multiplayer character-guessing game. No server messages needed.

**Key files:**
- Constants + methods in `WinXPDesktop.ts` (before FILE EXPLORER section)
- Icon: `packages/client/public/wyp-icon.svg`
- CSS: end of `packages/client/src/winxp.css`

**How to apply:** When re-adding or modifying WYP, check `wyp_render` for inline styles (phase-driven), `wyp_startTimers` for glitch/flicker (phases 3-4), and `WYP_PHASE_CONFIG` for all visual theming.
