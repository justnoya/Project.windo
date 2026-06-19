# WinXP Activity — Discord Embedded App

A Windows XP-themed multiplayer Activity for Discord, built with Phaser 3,
Colyseus WebSockets, and a hand-crafted DOM overlay that faithfully recreates
the Luna theme.

## User preferences

- Keep code clean and modular — new features go in `packages/client/src/features/`
- No unnecessary files, folders, or dead code
- Comments should explain *why*, not just *what*

---

## Architecture

```
/
├── packages/
│   ├── client/                   Vite + TypeScript + Phaser 3 (deployed to Vercel)
│   │   └── src/
│   │       ├── main.ts           Entry point — Discord SDK init + Phaser config
│   │       ├── winxp.css         Windows XP Luna theme (~2 200 lines)
│   │       ├── XPIcons.ts        Inline SVG paths for XP-style icons
│   │       ├── FileExplorer.ts   XP File Explorer window component
│   │       ├── fileSystem.ts     Virtual file system backed by localStorage
│   │       │
│   │       ├── types/
│   │       │   └── desktop.ts    WinState, StickyNote, IDesktopContext interface
│   │       │
│   │       ├── features/         Self-contained feature modules
│   │       │   └── WhoYouPlay.ts 4-phase psychological quiz app
│   │       │
│   │       ├── scenes/           Phaser scenes (one per screen/state)
│   │       │   ├── Boot.ts       Loads the 'bliss' background texture
│   │       │   ├── SplashScreen  "Made by The Director" intro
│   │       │   ├── Preloader.ts  XP-style loading bar
│   │       │   ├── LoginScreen   Discord OAuth + username entry
│   │       │   ├── GameMenu.ts   Single player / Multiplayer selection
│   │       │   ├── MultiplayerLobby.ts  Colyseus room join + waiting room
│   │       │   └── WinXPDesktop.ts  Main scene — desktop, taskbar, all windows
│   │       │
│   │       └── utils/
│   │           ├── discordSDK.ts  Discord Embedded App SDK wrapper
│   │           ├── gameState.ts   Global singleton (mode + room reference)
│   │           ├── serverConnect.ts  Colyseus endpoint resolver
│   │           ├── SoundManager.ts  UI sound effects controller
│   │           ├── ScaleFlow.ts   Phaser camera scaling / responsive helper
│   │           └── XScene.ts      Base Phaser scene with auto-scaling
│   │
│   └── server/                   Colyseus + Express (hosted on Pterodactyl Panel)
│       └── src/
│           ├── server.ts          Express + Colyseus setup, health endpoint
│           ├── rooms/
│           │   └── GameRoom.ts    Main room — presence, cursor, chat, sticky notes
│           └── schemas/
│               └── GameState.ts   Colyseus schema (player state)
│
├── api/
│   └── token.js                  Vercel serverless function — Discord token exchange
└── vercel.json                   Vercel deployment config
```

---

## How the Desktop Works

`WinXPDesktop` is the main Phaser scene. It manages:

- **DOM overlay** — a full-screen `div.xp-overlay` layered above the Phaser canvas
- **Window registry** — `wins: Map<string, WinState>` tracks every open window
- **Taskbar** — `tbBtns: Map<string, HTMLElement>` tracks every taskbar button
- **IDesktopContext** — a public interface (`src/types/desktop.ts`) that feature modules use to open windows, manage taskbar buttons, etc. without needing to know the full desktop internals

### Adding a new XP app

See the **`xp-app-integration`** skill in `.agents/skills/` for the complete step-by-step guide with code templates.

Short version:
1. Create `src/features/YourFeature.ts` — class that takes `IDesktopContext`
2. Add `private yourFeature!: YourFeature;` to `WinXPDesktop`
3. Init in `create()`: `this.yourFeature = new YourFeature(this);`
4. Add a desktop icon in `buildDesktopIcons()`
5. Add styles to `winxp.css`

---

## Running Locally

```bash
# Install all packages
pnpm install

# Start the client dev server (port 5173)
cd packages/client && npm run dev

# Start the Colyseus server (port 2567)
cd packages/server && npm run dev
```

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `DISCORD_CLIENT_ID` | client `.env` | Discord app client ID |
| `DISCORD_CLIENT_SECRET` | server `.env` | OAuth token exchange |
| `VITE_SERVER_URL` | client `.env` | Override Colyseus server URL |

See `example.env` for a template.

## Deployment

- **Client** → Vercel (auto-deploys from main). The `api/token.js` serverless function handles Discord OAuth.
- **Server** → Pterodactyl Panel at `goatpanel.duckdns.org:3002`. Node 20 with `--ignore-engines` flag (server targets Node 22 but runs on 20).
