'use strict'

/**
 * dsh-desktop — a thin desktop shell for the DeepSeek Harness Web UI.
 *
 * Behavior:
 *   1. Probe 127.0.0.1:<port> (default 3080). If something already listens,
 *      attach to it and do NOT start a backend.
 *   2. Otherwise spawn the configured backend command (default:
 *      `npx --yes @deepseek-ai/dsh web --port <port>`) and wait for the port.
 *   3. Load the Web UI in a native window.
 *   4. On quit, shut down the backend we spawned (never one we attached to).
 *
 * Config: <userData>/config.json (see README), overridable via env:
 *   DSH_DESKTOP_PORT, DSH_DESKTOP_COMMAND, DSH_DESKTOP_ARGS,
 *   DSH_DESKTOP_CWD, DSH_DESKTOP_STARTUP_TIMEOUT_MS
 *
 * `--smoke` runs headless-ish: quits right after the page finishes loading and
 * prints SMOKE_OK (used to verify the shell end to end).
 */

const { app, BrowserWindow, Menu, dialog, shell } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')

const DEFAULT_PORT = 3080
const PROBE_TIMEOUT_MS = 800
const DEFAULT_STARTUP_TIMEOUT_MS = 180_000 // first `npx` run downloads the package
const POLL_INTERVAL_MS = 500

const APP_URL = () => `http://127.0.0.1:${cfg.port}`
const APP_TITLE = 'DeepSeek Harness Desktop'

let cfg = null
let mainWindow = null
let backend = null // { proc, spawnedByUs }
let quitting = false

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadConfig() {
  const cfgPath = path.join(app.getPath('userData'), 'config.json')
  let file = {}
  try {
    file = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  } catch {
    /* use defaults */
  }
  const port = Number(process.env.DSH_DESKTOP_PORT ?? file.port ?? DEFAULT_PORT)
  const args = (
    process.env.DSH_DESKTOP_ARGS ??
    (file.args ? JSON.stringify(file.args) : null) ??
    '--yes @deepseek-ai/dsh web --port ' + port
  ).split(/\s+/).filter(Boolean)
  return {
    port,
    command: process.env.DSH_DESKTOP_COMMAND ?? file.command ?? 'npx',
    args,
    cwd: process.env.DSH_DESKTOP_CWD ?? file.cwd ?? undefined,
    autoStart: file.autoStart !== false,
    shutdownOnQuit: file.shutdownOnQuit !== false,
    startupTimeoutMs: Number(
      process.env.DSH_DESKTOP_STARTUP_TIMEOUT_MS ??
        file.startupTimeoutMs ??
        DEFAULT_STARTUP_TIMEOUT_MS,
    ),
    cfgPath,
  }
}

// ---------------------------------------------------------------------------
// Port probing / backend lifecycle
// ---------------------------------------------------------------------------

function probePort(port, timeout = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port }, () => {
      sock.destroy()
      resolve(true)
    })
    sock.on('error', () => resolve(false))
    sock.setTimeout(timeout, () => {
      sock.destroy()
      resolve(false)
    })
  })
}

function waitForPort(port, timeoutMs) {
  const start = Date.now()
  return new Promise((resolve) => {
    const tick = async () => {
      if (await probePort(port)) return resolve(true)
      if (Date.now() - start > timeoutMs) return resolve(false)
      setTimeout(tick, POLL_INTERVAL_MS)
    }
    tick()
  })
}

function backendLogPath() {
  const p = path.join(app.getPath('userData'), 'logs', 'backend.log')
  fs.mkdirSync(path.dirname(p), { recursive: true })
  return p
}

// Windows: bare names like `npx` resolve to npx.cmd, which spawn() cannot find
// without a shell. Append .cmd for bare command names on win32.
function resolveCommand(cmd) {
  if (process.platform !== 'win32') return cmd
  if (!path.isAbsolute(cmd) && !cmd.includes('\\') && !cmd.includes('.')) {
    return cmd + '.cmd'
  }
  return cmd
}

function spawnBackend() {
  const log = fs.createWriteStream(backendLogPath(), { flags: 'a' })
  const proc = spawn(resolveCommand(cfg.command), cfg.args, {
    cwd: cfg.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.pipe(log)
  proc.stderr.pipe(log)
  proc.on('error', (err) => {
    log.end()
    console.error('[dsh-desktop] backend spawn error:', err)
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      loadErrorPage(
        '无法启动后端进程',
        `启动 ${cfg.command} 失败：${err.message}` +
          '\n\n请确认已安装 Node.js（Windows 下 npx 来自 Node.js），' +
          '或检查 config.json 中的 command / cwd 配置。',
      )
    }
  })
  proc.on('exit', (code, signal) => {
    log.end()
    if (quitting) return
    if (mainWindow && !mainWindow.isDestroyed()) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: '后端服务已退出',
        message: `DeepSeek Harness 后端进程已退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）。`,
        detail: `命令：${cfg.command} ${cfg.args.join(' ')}\n日志：${backendLogPath()}`,
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
  })
  backend = { proc, spawnedByUs: true }
}

async function startBackend() {
  spawnBackend()
  const ok = await waitForPort(cfg.port, cfg.startupTimeoutMs)
  if (!ok && !quitting) {
    loadErrorPage(
      '后端服务未能启动',
      `端口 ${cfg.port} 在 ${Math.round(cfg.startupTimeoutMs / 1000)}s 内未就绪。` +
        `\n命令：${cfg.command} ${cfg.args.join(' ')}` +
        `\n日志：${backendLogPath()}` +
        '\n\n可点击“重试”再试一次；或关闭应用后手动运行 dsh web。',
    )
    return false
  }
  return ok
}

function stopBackend() {
  const b = backend
  backend = null
  if (!b || !b.spawnedByUs || !b.proc || b.proc.killed) return
  const proc = b.proc
  if (process.platform === 'win32') {
    // Kill the whole process tree (npx -> dsh); plain proc.kill() would orphan
    // the grandchild on Windows.
    try {
      const killer = spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
      killer.on('error', () => proc.kill())
    } catch {
      proc.kill()
    }
  } else {
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
    }, 3000).unref()
  }
}

// ---------------------------------------------------------------------------
// Windows / pages
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: APP_TITLE,
    backgroundColor: '#0e1116',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (url.startsWith('file:')) return // ignore splash/error page failures
    loadErrorPage(
      '页面加载失败',
      `无法加载 ${url}\n(${code}: ${desc})` +
        '\n\n可能原因：后端服务未运行或已退出。\n可点击“重试”，或关闭应用后手动运行 dsh web。',
    )
  })
  mainWindow.loadFile(path.join(__dirname, 'splash.html'))
}

function loadErrorPage(title, message) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${APP_TITLE} — 错误</title>
<style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0e1116;color:#e6edf3;font:14px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
  .box{max-width:640px;padding:32px;border:1px solid #2d333b;border-radius:12px;background:#161b22}
  h1{font-size:18px;margin:0 0 12px} p{white-space:pre-wrap;margin:0 0 20px;color:#9aa4b2}
  a{display:inline-block;color:#58a6ff;border:1px solid #58a6ff;border-radius:6px;padding:6px 16px;text-decoration:none}
  a:hover{background:#1f6feb22}
</style></head><body><div class="box">
  <h1>${title}</h1><p>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>
  <a href="${APP_URL()}">重试</a>
</div></body></html>`
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [{
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
        }]
      : []),
    {
      label: '窗口',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: '在浏览器中打开',
          click: () => shell.openExternal(APP_URL()),
        },
        {
          label: '打开后端日志',
          click: () => shell.openPath(backendLogPath()),
        },
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
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    app.setName(APP_TITLE)
    cfg = loadConfig()
    buildMenu()
    createWindow()

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
      loadErrorPage(
        '后端服务未运行',
        `端口 ${cfg.port} 没有服务在监听，且配置 autoStart=false。\n请先手动运行 dsh web，再打开本应用。`,
      )
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Deliberate: single-window desktop app — quitting on last window close also
  // stops a backend we spawned.
  app.on('window-all-closed', () => app.quit())

  app.on('before-quit', () => {
    quitting = true
    if (cfg && !cfg.shutdownOnQuit) return
    stopBackend()
  })
}

function loadApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadURL(APP_URL())
  if (process.argv.includes('--smoke')) {
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('[dsh-desktop] SMOKE_OK', mainWindow.webContents.getURL())
      quitting = true
      stopBackend() // deterministic cleanup for smoke runs
      app.exit(0) // force exit: skips any page-level close interception
    })
  }
}
