---
name: Project Architecture
description: Codebase structure after professional reconstruction — IDesktopContext pattern and feature module system.
---

# Project Architecture (post-reconstruction)

## Directory layout

```
packages/client/src/
├── types/desktop.ts        ← WinState, StickyNote, IDesktopContext interface
├── features/               ← One file per self-contained app/feature
│   └── WhoYouPlay.ts       ← Reference implementation
├── scenes/                 ← Phaser scenes only (no dead files)
│   └── WinXPDesktop.ts     ← Desktop orchestrator (~1400 lines)
├── utils/                  ← Pure utilities (no UI logic)
└── winxp.css               ← All XP theme CSS (~2200 lines)
```

## IDesktopContext pattern

Feature modules receive the desktop through `IDesktopContext` (structural typing — no explicit `implements` needed). Key members exposed by WinXPDesktop:

- `overlay`, `wins`, `tbBtns` — public properties
- `nextZ()` — public method, increments internal z-index counter
- Window lifecycle: `bringFront`, `makeDraggable`, `positionWin`, `closeWin`, `minimizeWin`, `restoreWin`, `toggleMax`
- Taskbar: `makeTbBtn`, `trackRecent`

## Adding a new app

See `.agents/skills/xp-app-integration/SKILL.md` — canonical step-by-step guide with code templates.

**Why:** Putting new apps in `features/` keeps WinXPDesktop.ts focused on orchestration only. The IDesktopContext interface makes the dependency contract explicit and mockable.

## Dead files removed

`Game.ts`, `Background.ts`, `MainMenu.ts` — none were registered in `main.ts`. Removed to avoid confusion.
