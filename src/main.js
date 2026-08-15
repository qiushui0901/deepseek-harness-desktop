'use strict'

/**
 * dsh-desktop main process — a thin desktop shell for the DeepSeek Harness
 * Web UI.
 *
 * Behavior:
 *   1. Probe 127.0.0.1:<port> (default 3080). If something already listens,
 *      attach to it and do NOT start a backend.
 *   2. Otherwise spawn the configured backend command (default:
 *      `npx --yes @deepseek-ai/dsh web --port <port>`) and wait for readiness.
 *   3. Load the Web UI in a native window.
 *   4. On quit, shut down the backend we spawned (never one we attached to).
 *
 * `--smoke` runs headless-ish: quits right after the page finishes loading and
 * prints SMOKE_OK (used to verify the shell end to end on CI).
 */

import { app, Menu, dialog, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMainWindow, getMainWindow, focusMainWindow } from './window-lifecycle.js'
import { createWindowOptions } from './window-options.js'
import {
  loadConfig,
  probeHarness,
  waitForHarness,
  spawnBackend,
  stopBackend,
  resolveCommandPath,
  withTimeout,
  backendLogPath,
} from './dsh-service.js'
import { loadErrorPage } from './error-page.js'
import { fetchLatestDshVersion, latestCachedDshVersion, npxCacheRoots, resolveUpdateState } from './updates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_TITLE = 'DeepSeek Harness Desktop'
const APP_URL = () => `http://127.0.0.1:${cfg.port}`

let cfg = null
let backend = null // { proc, spawnedByUs }
let quitting = false

// Surface silent failures: log anything uncaught instead of hanging or dying
// without output (especially on CI smoke runs).
process.on('uncaughtException', (err) => {
  console.error('[dsh-desktop] uncaughtException:', err)
  app.exit(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('[dsh-desktop] unhandledRejection:', reason)
})

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------

function onBackendSpawnError(err) {
  console.error('[dsh-desktop] backend spawn error:', err)
  if (process.argv.includes('--smoke')) {
    console.error('[dsh-desktop] smoke: backend spawn failed')
    app.exit(1)
    return
  }
  const win = getMainWindow()
  if (!quitting && win && !win.isDestroyed()) {
    loadErrorPage(win, {
      appTitle: APP_TITLE,
      title: '无法启动后端进程',
      message:
        `启动 ${cfg.command} 失败：${err.message}` +
        '\n\n请确认已安装 Node.js（Windows 下 npx 来自 Node.js），' +
        '或检查 config.json 中的 command / cwd 配置。',
      retryUrl: APP_URL(),
    })
  }
}

function onBackendExit(code, signal) {
  if (quitting) return
  if (process.argv.includes('--smoke')) {
    // Never block CI smoke runs on a modal dialog.
    console.error(`[dsh-desktop] backend exited during smoke (code=${code}, signal=${signal})`)
    return
  }
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      title: '后端服务已退出',
      message: `DeepSeek Harness 后端进程已退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）。`,
      detail: `命令：${cfg.command} ${cfg.args.join(' ')}\n日志：${backendLogPath(app.getPath('userData'))}`,
      buttons: ['重启服务', '退出'],
      defaultId: 0,
      cancelId: 1,
    })
    if (choice === 0) {
      backend = null
      // Wait for the new backend and explicitly reload the page instead of
      // hoping the old page reconnects on its own.
      startBackend().then((ok) => {
        if (ok && !quitting && !win.isDestroyed()) win.loadURL(APP_URL())
      })
    } else {
      app.quit()
    }
  }
}

async function startBackend() {
  // Resolve the command to an absolute path so Finder/Explorer launches (which
  // have a minimal PATH) can still find npx under nvm / Homebrew / Node.js dirs.
  const resolved = resolveCommandPath(cfg.command)
  backend = {
    proc: spawnBackend(cfg, {
      command: resolved?.command,
      pathEnv: resolved?.pathEnv ?? null,
      logPath: backendLogPath(app.getPath('userData')),
      onSpawnError: onBackendSpawnError,
      onExit: onBackendExit,
    }),
    spawnedByUs: true,
  }
  let polls = 0
  const ok = await waitForHarness(cfg.port, cfg.startupTimeoutMs, undefined, () => {
    if (process.argv.includes('--smoke') && ++polls % 60 === 0) {
      console.log(`[dsh-desktop] smoke: still waiting for backend (${Math.round((polls * 500) / 1000)}s)`)
    }
  })
  if (!ok && !quitting) {
    if (process.argv.includes('--smoke')) {
      console.error(`[dsh-desktop] smoke: backend not ready on port ${cfg.port} within ${cfg.startupTimeoutMs}ms`)
      app.exit(1)
      return false
    }
    loadErrorPage(getMainWindow(), {
      appTitle: APP_TITLE,
      title: '后端服务未能启动',
      message:
        `端口 ${cfg.port} 在 ${Math.round(cfg.startupTimeoutMs / 1000)}s 内未就绪。` +
        `\n命令：${cfg.command} ${cfg.args.join(' ')}` +
        `\n日志：${backendLogPath(app.getPath('userData'))}` +
        '\n\n可点击“重试”再试一次；或关闭应用后手动运行 dsh web。',
      retryUrl: APP_URL(),
    })
    return false
  }
  return ok
}

// ---------------------------------------------------------------------------
// Windows / pages
// ---------------------------------------------------------------------------

function createAppWindow() {
  return createMainWindow(createWindowOptions(), {
    splashFile: path.join(__dirname, 'startup.html'),
    allowedOrigin: APP_URL(), // only same-origin page navigations stay in-window
    onFailLoad: (_e, code, desc, url) => {
      if (url.startsWith('file:')) return // ignore splash/error page failures
      loadErrorPage(getMainWindow(), {
        appTitle: APP_TITLE,
        title: '页面加载失败',
        message:
          `无法加载 ${url}\n(${code}: ${desc})` +
          '\n\n可能原因：后端服务未运行或已退出。\n可点击“重试”，或关闭应用后手动运行 dsh web。',
        retryUrl: APP_URL(),
      })
    },
  })
}

function loadApp() {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  if (process.argv.includes('--smoke')) console.log('[dsh-desktop] smoke: loading', APP_URL())
  win.loadURL(APP_URL())
  // Update awareness: npx resolves the latest @deepseek-ai/dsh on every backend
  // start, so a new npm release is picked up on the next restart. Check the
  // registry quietly after the UI settles and notify if a newer version exists.
  if (cfg.updateNotifications && !process.argv.includes('--smoke')) {
    setTimeout(() => checkForUpdates({ manual: false }), 4000)
  }
}

// ---------------------------------------------------------------------------
// Update check
// ---------------------------------------------------------------------------

async function checkForUpdates({ manual = false }) {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  // A custom backend command (e.g. a local checkout via command/cwd) is not
  // managed by npx, so registry updates do not apply to it.
  const customBackend = cfg.command !== 'npx' || cfg.cwd != null
  if (customBackend) {
    if (manual) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: '检查更新',
        message: '已配置自定义后端命令（config.json 中的 command/cwd），npm 更新检查不适用。',
      })
    }
    return
  }
  const [latest, cached] = await Promise.all([
    fetchLatestDshVersion(),
    Promise.resolve(latestCachedDshVersion(npxCacheRoots())),
  ])
  const state = resolveUpdateState({ latest, cached, pinned: cfg.dshVersion })
  if (state.kind === 'unknown') {
    if (manual) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: '检查更新',
        message: '无法获取 DeepSeek Harness 的最新版本信息（可能处于离线状态）。',
      })
    }
    return
  }
  if (state.kind === 'up-to-date') {
    if (manual) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: '检查更新',
        message: `已是最新版本：DeepSeek Harness ${state.latest}`,
      })
    }
    return
  }
  if (state.kind === 'pinned-older') {
    dialog.showMessageBox(win, {
      type: 'info',
      title: '已固定版本',
      message: `当前固定 DeepSeek Harness ${state.current}，最新版为 ${state.latest}。`,
      detail: '更新检查不会绕过固定版本。如需升级，请修改 config.json 中的 dshVersion（或删除该字段以跟随最新版），然后重新启动应用。',
      buttons: ['知道了'],
    })
    return
  }
  // update-available
  const choice = dialog.showMessageBoxSync(win, {
    type: 'info',
    title: '发现新版本',
    message: `DeepSeek Harness 有新版本可用：${state.latest}`,
    detail:
      `当前版本：${state.current}\n\n` +
      (backend?.spawnedByUs
        ? '点击「立即更新」将重启后端，下次启动时自动拉取新版本（网页会重新加载）。'
        : '当前后端不是由本应用启动的（外部实例），请重启该实例后重新打开应用。'),
    buttons: backend?.spawnedByUs ? ['立即更新', '稍后'] : ['知道了'],
    defaultId: 0,
    cancelId: 1,
  })
  if (choice === 0 && backend?.spawnedByUs) {
    stopBackend(backend.proc)
    backend = null
    const ok = await startBackend()
    if (ok && !quitting) win.loadURL(APP_URL())
  }
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    // Standard Edit menu — required for Cmd/Ctrl+C/V/X/A shortcuts to work at
    // all: Electron wires clipboard accelerators through menu roles.
    { role: 'editMenu' },
    {
      label: '窗口',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '检查更新…', click: () => checkForUpdates({ manual: true }) },
        { type: 'separator' },
        { label: '在浏览器中打开', click: () => shell.openExternal(APP_URL()) },
        { label: '打开后端日志', click: () => shell.openPath(backendLogPath(app.getPath('userData'))) },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)

  app.whenReady().then(async () => {
    app.setName(APP_TITLE)
    cfg = loadConfig({ userDataDir: app.getPath('userData') })
    buildMenu()
    createAppWindow()
    const smoke = process.argv.includes('--smoke')
    if (smoke) {
      // Attach early, but only accept the Harness app URL as success: the
      // splash (file:) and error pages (data:) must never settle the run.
      const win = getMainWindow()
      win.webContents.on('did-finish-load', () => {
        const url = win.webContents.getURL()
        if (!url.startsWith(`http://127.0.0.1:${cfg.port}`)) {
          if (url.startsWith('file:')) return // splash — keep waiting
          console.error('[dsh-desktop] smoke: unexpected page loaded:', url)
          app.exit(1)
          return
        }
        console.log('[dsh-desktop] SMOKE_OK', url)
        quitting = true
        stopBackend(backend?.proc) // deterministic cleanup for smoke runs
        app.exit(0) // force exit: skips any page-level close interception
      })
      console.log('[dsh-desktop] smoke: window created, probing', cfg.port)
    }

    // Attach to an already-running instance — but only if the HTTP response
    // proves it is actually the Harness Web UI (not just any TCP listener).
    // Bounded by withTimeout: a hung fetch must never stall startup.
    const probe = await withTimeout(probeHarness(cfg.port), 3000).catch(() => ({ ok: false, reason: 'error' }))
    if (smoke) console.log('[dsh-desktop] smoke: probe =', JSON.stringify(probe))
    if (probe.ok) {
      loadApp()
      return
    }
    if (probe.reason !== 'no-listener') {
      if (process.argv.includes('--smoke')) {
        console.error('[dsh-desktop] smoke: port occupied by a non-Harness service:', JSON.stringify(probe))
        app.exit(1)
        return
      }
      loadErrorPage(getMainWindow(), {
        appTitle: APP_TITLE,
        title: '端口被其他服务占用',
        message:
          `端口 ${cfg.port} 有服务在监听，但它没有返回 DeepSeek Harness 的特征响应。` +
          '\n\n请停止占用该端口的程序后重试，或在 config.json 中修改 port。',
        retryUrl: APP_URL(),
      })
      return
    }
    // Otherwise start the backend ourselves
    if (cfg.autoStart) {
      if (smoke) console.log('[dsh-desktop] smoke: no listener, spawning backend:', cfg.command, cfg.args.join(' '))
      const ok = await startBackend()
      if (smoke) console.log('[dsh-desktop] smoke: backend ready =', ok)
      if (ok && !quitting) loadApp()
    } else {
      loadErrorPage(getMainWindow(), {
        appTitle: APP_TITLE,
        title: '后端服务未运行',
        message: `端口 ${cfg.port} 没有服务在监听，且配置 autoStart=false。\n请先手动运行 dsh web，再打开本应用。`,
        retryUrl: APP_URL(),
      })
    }
  })

  app.on('activate', () => {
    if (!getMainWindow()) createAppWindow()
  })

  // Deliberate: single-window desktop app — quitting on last window close also
  // stops a backend we spawned.
  app.on('window-all-closed', () => app.quit())

  app.on('before-quit', () => {
    quitting = true
    if (cfg && !cfg.shutdownOnQuit) return
    stopBackend(backend?.proc)
    backend = null
  })
}
