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
  probePort,
  waitForPort,
  spawnBackend,
  stopBackend,
  resolveCommandPath,
  backendLogPath,
} from './dsh-service.js'
import { loadErrorPage } from './error-page.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_TITLE = 'DeepSeek Harness Desktop'
const APP_URL = () => `http://127.0.0.1:${cfg.port}`

let cfg = null
let backend = null // { proc, spawnedByUs }
let quitting = false

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------

function onBackendSpawnError(err) {
  console.error('[dsh-desktop] backend spawn error:', err)
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
      startBackend()
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
  const ok = await waitForPort(cfg.port, cfg.startupTimeoutMs)
  if (!ok && !quitting) {
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
  win.loadURL(APP_URL())
  if (process.argv.includes('--smoke')) {
    win.webContents.once('did-finish-load', () => {
      console.log('[dsh-desktop] SMOKE_OK', win.webContents.getURL())
      quitting = true
      stopBackend(backend?.proc) // deterministic cleanup for smoke runs
      app.exit(0) // force exit: skips any page-level close interception
    })
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
    {
      label: '窗口',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { role: 'toggleDevTools' },
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

    // Attach to an already-running instance (e.g. user started `dsh web` by hand)
    if (await probePort(cfg.port)) {
      loadApp()
      return
    }
    // Otherwise start the backend ourselves
    if (cfg.autoStart) {
      const ok = await startBackend()
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
