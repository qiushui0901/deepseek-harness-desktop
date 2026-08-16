<h1 align="center">
  <img src="assets/icon.png" width="72" alt="DeepSeek Harness Desktop logo" />
  <br />
  DeepSeek Harness Desktop
</h1>

<p align="center">
  A minimal, local-first, cross-platform desktop shell for
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>.
</p>

<p align="center">
  <strong>English</strong> · <a href="README.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/qiushui0901/deepseek-harness-desktop?style=flat-square&color=171513" /></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-171513.svg?style=flat-square" /></a>
  <a href="https://github.com/qiushui0901/deepseek-harness-desktop/actions/workflows/release.yml"><img alt="Release build" src="https://github.com/qiushui0901/deepseek-harness-desktop/actions/workflows/release.yml/badge.svg" /></a>
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-171513.svg?style=flat-square" />
  <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-171513.svg?style=flat-square" />
  <img alt="Linux" src="https://img.shields.io/badge/Linux-x64-171513.svg?style=flat-square" />
</p>

DeepSeek Harness Desktop packages the official DeepSeek Harness Web experience as a standalone desktop application. It removes the need to start the CLI manually or manage local ports while preserving the full Harness interface.

This project focuses on desktop hosting. It does not fork, modify, inject into, or reimplement the Harness UI. Models, sessions, settings, plugins, and agent capabilities remain provided by the official `@deepseek-ai/dsh` package.

> [!IMPORTANT]
> This is an unofficial community wrapper and an early-stage project. The macOS builds are not Apple-notarized, and the Windows builds are not commercially code-signed. The app starts the Harness backend through `npx`, so **Node.js ≥ 18 is required** on the machine that runs it.

## Download

| Platform | Architecture | Package | Download |
| --- | --- | --- | --- |
| macOS | Apple Silicon | DMG | [Download for Apple Silicon](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-arm64.dmg) |
| macOS | Intel | DMG | [Download for Intel Mac](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-x64.dmg) |
| Windows | x64 | Setup installer | [Download Windows installer](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-windows-x64.exe) |
| Windows | x64 | Portable ZIP | [Download Windows ZIP](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-windows-x64.zip) |
| Linux | x64 | AppImage | [Download AppImage](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-linux-x86_64.AppImage) |
| Debian / Ubuntu | x64 | deb | [Download deb](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-linux-amd64.deb) |

All current and historical packages are available on the [GitHub Releases page](https://github.com/qiushui0901/deepseek-harness-desktop/releases).

## Why this project exists

DeepSeek Harness already provides the complete agent runtime and Web UI. This project supplies the host capabilities required for a desktop product:

- Start and stop the local Harness service automatically
- Attach to a Harness instance you already started by hand
- Wait for Harness readiness before displaying the window
- Provide a single-instance desktop window and safe external navigation
- Enable sandboxing, `contextIsolation`, and navigation restrictions
- Package installable releases for macOS, Windows, and Linux

## Features

- Opens the official Harness interface as soon as the local service is ready
- Shows a lightweight loading screen while the local Harness service starts
- Attaches to an already-running `dsh web` instead of starting a second backend
- Preserves the complete settings, models, sessions, plugins, and agent experience
- Gracefully terminates the Harness child process (and its process tree on Windows) on exit
- Offers to restart the backend when it crashes; backend logs are one menu click away
- Listens only on `127.0.0.1`
- Provides a Windows x64 installer and portable ZIP
- Provides Linux x64 AppImage and deb packages

## Requirements

- **Node.js ≥ 18** — the app starts the official Harness backend via `npx --yes @deepseek-ai/dsh web` (first launch downloads the package).

## Installation

### macOS

The macOS builds are ad-hoc signed but not Apple-notarized. On first launch:

1. Open the DMG and drag **DeepSeek Harness Desktop** into **Applications**.
2. Try to open the app; if macOS blocks it, click **Done**.
3. Open **System Settings → Privacy & Security**.
4. Find DeepSeek Harness Desktop in the **Security** section and click **Open Anyway**.
5. Confirm by clicking **Open** once more.

This confirmation is normally required only once.

### Windows

The Windows installer is not commercially code-signed. If Microsoft Defender SmartScreen appears:

1. Click **More info**.
2. Click **Run anyway**.
3. Complete the setup wizard.

### Linux

- AppImage: run `chmod +x DeepSeek-Harness-Desktop-*.AppImage`, then launch it directly.
- Debian / Ubuntu: open the deb with the system software installer, or run `sudo apt install ./DeepSeek-Harness-Desktop-*.deb`.

## Updates

**Backend (DeepSeek Harness)**: the backend is started with
`npx --yes @deepseek-ai/dsh web`, and npx resolves the **latest published
version** from the npm registry on every launch — so as soon as upstream
publishes a new release to npm, the next backend start is the new version, no
action needed.

To make updates visible, the app quietly queries the registry after startup
and compares it with the locally cached version:

- Newer version found → dialog offering **Update now** (restarts the backend,
  which pulls the new version) or **Later**
- Menu **Window → Check for Updates…** runs a manual check anytime
- Offline or registry failures are skipped silently

To **pin a version** (reproducible builds), set `dshVersion` in the config.

**The shell itself**: released through this repository's GitHub Releases
(pushing a `v*` tag triggers the CI build); watch the Releases page for
upgrades.

## Configuration

The shell reads `<userData>/config.json` — on macOS
`~/Library/Application Support/DeepSeek Harness Desktop/config.json`, on
Windows `%APPDATA%\DeepSeek Harness Desktop\config.json`. It is optional; all
keys have defaults:

```json
{
  "port": 3080,
  "command": "npx",
  "args": ["--yes", "@deepseek-ai/dsh", "web", "--port", "3080"],
  "cwd": "/path/to/deepseek-harness",
  "autoStart": true,
  "shutdownOnQuit": true,
  "updateNotifications": true,
  "idleReloadMinutes": 0,
  "dshVersion": "0.1.0-rc.6",
  "startupTimeoutMs": 180000
}
```

| Key | Meaning |
| --- | --- |
| `port` | Loopback port to probe and serve (default `3080`) |
| `command` / `args` / `cwd` | Backend launch command; point `cwd` at a local checkout to run `pnpm dsh web` instead of `npx` |
| `autoStart` | Start the backend when nothing listens (default `true`) |
| `shutdownOnQuit` | Stop the backend the app started when quitting (default `true`) |
| `updateNotifications` | Auto-check the npm registry after startup and notify (default `true`) |
| `idleReloadMinutes` | Reload the page after this many minutes of system idle when the backend is healthy (repairs half-open event connections; default `0` = off, opt in) |
| `dshVersion` | Pin the backend version (e.g. `0.1.0-rc.6`); unset = always follow the latest |
| `startupTimeoutMs` | How long to wait for readiness before showing an error |

Environment variables override the file:

| Variable | Overrides |
| --- | --- |
| `DSH_DESKTOP_PORT` | `port` |
| `DSH_DESKTOP_COMMAND` | `command` |
| `DSH_DESKTOP_ARGS` | `args` (space-separated string) |
| `DSH_DESKTOP_CWD` | `cwd` |
| `DSH_DESKTOP_DSH_VERSION` | `dshVersion` |
| `DSH_DESKTOP_IDLE_RELOAD_MINUTES` | `idleReloadMinutes` |
| `DSH_DESKTOP_STARTUP_TIMEOUT_MS` | `startupTimeoutMs` |

## Security model

- Harness binds only to `127.0.0.1`
- Node.js integration is disabled in the renderer
- `contextIsolation` and the Chromium sandbox are enabled
- New windows and cross-origin navigation open in the system browser
- Harness runs as a separate child process, not inside the app process

## Runtime architecture

```text
DeepSeek Harness Desktop
├── Electron Main
│   ├── Single-instance window
│   ├── Backend child-process lifecycle (probe → attach or spawn → wait)
│   ├── Loopback port readiness checks
│   └── Platform menu and external-link handling
│
├── Harness Child Process (spawned via npx, only if nothing listens)
│   └── @deepseek-ai/dsh web
│       └── http://127.0.0.1:<port>
│
└── Sandboxed BrowserWindow
    └── DeepSeek Harness Web UI
```

## Development

```sh
npm install
npm test                 # unit tests (node --test)
npm run smoke            # dev-mode smoke test (opens a window briefly)
npm run pack             # unpacked macOS .app
npm run smoke:packaged   # smoke-test the packaged app
npm run dist:mac:arm64   # macOS DMG + ZIP (arm64)
npm run dist:mac:x64     # macOS DMG + ZIP (x64)
npm run dist:win         # Windows installer + ZIP (x64)
npm run dist:linux       # Linux AppImage + deb (x64)
```

Releases are built automatically by GitHub Actions: pushing a `v*` tag builds
all platforms on their native runners, runs unit tests and a packaged-app
smoke test, and publishes the artifacts to the GitHub Release.

## Validation status

| Platform | Packaging | Packaged startup | Web UI |
| --- | --- | --- | --- |
| macOS Apple Silicon | DMG / ZIP | Passed | HTTP 200 |
| macOS Intel | DMG / ZIP | CI-verified | HTTP 200 |
| Windows x64 | NSIS / ZIP | CI-verified | HTTP 200 |
| Linux x64 | AppImage / deb | CI-verified | HTTP 200 |

Every release package is built on a matching GitHub-hosted runner and runs a
packaged-app smoke test before publication.

## Known limitations

- The backend is fetched via `npx` at first launch — requires Node.js and an internet connection (subsequent launches use the npx cache)
- Upstream DSH is a developer preview and may change rapidly
- Apple Developer ID signing and notarization are not integrated
- Commercial Windows code signing is not integrated, so SmartScreen may appear
- Windows ARM64 and Linux ARM64 packages are not currently provided
- Automatic updates are not integrated

## Upstream version and license

The desktop wrapper is available under the [MIT License](LICENSE). The bundled
DeepSeek Harness runtime is also MIT-licensed; its notice is preserved in
[`third-party-licenses/deepseek-harness-LICENSE`](third-party-licenses/deepseek-harness-LICENSE).

This project is not affiliated with or endorsed by DeepSeek. DeepSeek Harness
and related names belong to their respective owners. The application icon uses
the whale artwork from the upstream DeepSeek Harness Web favicon.
