# ButterSwitch

Audio cues for browser events. ButterSwitch plays short sounds when things happen in your browser: a tab opens, a download finishes, a page loads. The primary audience is screen-reader users, where visual cues for these events are easy to miss. Sighted users can use it for ambient feedback without watching the screen.

## Install

- Chrome, Chromium, Edge, Brave: [ButterSwitch on the Chrome Web Store](https://chromewebstore.google.com/detail/butterswitch/mklgnoddcbikoenjlfmdghigeapfeijk)
- Firefox: [ButterSwitch on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/butterswitch/)

Both store versions auto-update. For testing pre-release builds, [GitHub Releases](https://github.com/akash07k/butterswitch/releases) attaches Chrome and Firefox zips per release. Chrome: load unpacked via `chrome://extensions` developer mode. Firefox: temporary load via `about:debugging`. Sideloads do not auto-update.

Store-listing copy lives in [`extension/store-listing/`](./extension/store-listing/).

## What it does

64 browser events across three tiers: 25 essential (on by default), 37 useful (opt-in), and 2 advanced (power users). Every event has its own enable toggle, volume slider, pitch slider, and preview button.

The Pulse sound theme ships built in. Adding new themes is supported; the format is in [`docs/sound-themes.md`](./docs/sound-themes.md).

A global cooldown (~150 ms) prevents cascading sounds from a single user action. Per-event debounce handles rapid-fire duplicates. Higher-priority events can preempt lower-priority cues already in the cooldown window.

Keyboard shortcuts: Alt+M to toggle mute, Alt+Shift+O to open options (both global). Inside the options page: Alt+T cycles themes, Shift+? reads a help announcement.

## Privacy

No telemetry. No analytics. No crash reports. No accounts. No third-party services or CDN fetches. All settings stored in `browser.storage.local`, never leaving your machine.

The optional log viewer for development runs only on `localhost:8089` and is off by default.

## Project links

- [`CHANGELOG.md`](./CHANGELOG.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`LICENSE.md`](./LICENSE.md) — AGPL-3.0
- [`docs/`](./docs/) — architecture and design docs; see [`docs/README.md`](./docs/README.md) for the index
- [GitHub Issues](https://github.com/akash07k/butterswitch/issues)
- [GitHub Releases](https://github.com/akash07k/butterswitch/releases)

## Developer setup

Requires Node.js 20 or later and pnpm 10 or later.

```sh
git clone https://github.com/akash07k/butterswitch.git
cd butterswitch
pnpm setup
```

`pnpm setup` runs install with `--ignore-scripts`, builds the logger workspace, then runs `wxt prepare`. After that, plain `pnpm install` is enough on dependency bumps.

### Daily commands

```sh
cd extension
pnpm dev           # Chrome dev server (HMR)
pnpm dev:firefox   # Firefox dev server
```

```sh
# from anywhere in the repo:
pnpm typecheck
pnpm lint
pnpm lint:md
pnpm test
```

The pre-push hook runs typecheck, lint, lint:md, and test in parallel.

### Releases

```sh
pnpm release:dry           # preview the next bump and CHANGELOG entry
pnpm release               # bump, write CHANGELOG, signed commit + tag
git push --follow-tags origin main
```

The tag push fires `.github/workflows/release.yml`, which runs the gates again and submits to both stores. The workflow also creates a GitHub Release with the Chrome zip, Firefox zip, and sources zip attached.

### Log server

```sh
pnpm log-server:dev
```

Then enable log streaming in the extension's options page (Logging tab). The viewer is at <http://localhost:8089>.

## Architecture

pnpm monorepo with three packages:

- `extension/` — the WXT browser extension (the product)
- `packages/logger/` — `@butterswitch/logger`, structured logger used by the extension
- `packages/log-server/` — `@butterswitch/log-server`, dev-only WebSocket sink and React viewer

The extension uses a module-system with lifecycle stages (initialize, activate, deactivate, dispose). Modules talk via a message bus and never import each other directly. The sound engine module is the only module so far.

Audio is browser-specific: Chrome uses an offscreen document (service workers have no DOM); Firefox plays directly in the background page. Both delegate to a shared `HowlerPlayer`.

See [`docs/architecture.md`](./docs/architecture.md) for the full layout.

## Browser support

Chrome 140 or later. Firefox 142 or later.

## License

[AGPL-3.0-only](./LICENSE.md)
