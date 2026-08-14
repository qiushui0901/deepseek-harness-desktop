'use strict'

/**
 * dsh-service — DeepSeek Harness backend lifecycle for the desktop shell.
 *
 * The shell never runs the Harness itself: it either attaches to an instance
 * already listening on 127.0.0.1:<port>, or starts one via a configurable
 * command (default: `npx --yes @deepseek-ai/dsh web --port <port>`), waits for
 * readiness, and stops the child (and only the child it started) on quit.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

export const DEFAULT_PORT = 3080
export const PROBE_TIMEOUT_MS = 800
export const DEFAULT_STARTUP_TIMEOUT_MS = 180_000 // first `npx` run downloads the package
export const POLL_INTERVAL_MS = 500

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function parseArgsString(str) {
  return String(str).split(/\s+/).filter(Boolean)
}

/**
 * Load the shell configuration. Precedence: environment > config file
 * (<userData>/config.json) > defaults. `overrides` is a last-resort test hook.
 */
export function loadConfig({ userDataDir, env = process.env, overrides = {} } = {}) {
  const file = {}
  try {
    Object.assign(file, JSON.parse(fs.readFileSync(path.join(userDataDir, 'config.json'), 'utf8')))
  } catch {
    /* use defaults */
  }
  const port = Number(env.DSH_DESKTOP_PORT ?? file.port ?? overrides.port ?? DEFAULT_PORT)
  const fileArgs = file.args
  const argsSource =
    env.DSH_DESKTOP_ARGS ??
    (Array.isArray(fileArgs) ? fileArgs : fileArgs ? JSON.stringify(fileArgs) : null) ??
    `--yes @deepseek-ai/dsh web --port ${port}`
  return {
    port,
    command: env.DSH_DESKTOP_COMMAND ?? file.command ?? overrides.command ?? 'npx',
    args: Array.isArray(argsSource) ? argsSource : parseArgsString(argsSource),
    cwd: env.DSH_DESKTOP_CWD ?? file.cwd ?? undefined,
    autoStart: file.autoStart !== false,
    shutdownOnQuit: file.shutdownOnQuit !== false,
    startupTimeoutMs: Number(
      env.DSH_DESKTOP_STARTUP_TIMEOUT_MS ?? file.startupTimeoutMs ?? overrides.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
    ),
  }
}

// ---------------------------------------------------------------------------
// Port probing
// ---------------------------------------------------------------------------

export function probePort(port, timeout = PROBE_TIMEOUT_MS) {
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

export function waitForPort(port, timeoutMs, intervalMs = POLL_INTERVAL_MS) {
  const start = Date.now()
  return new Promise((resolve) => {
    const tick = async () => {
      if (await probePort(port)) return resolve(true)
      if (Date.now() - start > timeoutMs) return resolve(false)
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}

// ---------------------------------------------------------------------------
// Backend process
// ---------------------------------------------------------------------------

export function backendLogPath(userDataDir) {
  const p = path.join(userDataDir, 'logs', 'backend.log')
  fs.mkdirSync(path.dirname(p), { recursive: true })
  return p
}

/**
 * Windows: bare names like `npx` resolve to npx.cmd, which spawn() cannot find
 * without a shell. Append .cmd for bare command names on win32.
 */
export function resolveCommand(cmd, platform = process.platform) {
  if (platform !== 'win32') return cmd
  if (!path.isAbsolute(cmd) && !cmd.includes('\\') && !cmd.includes('.')) {
    return cmd + '.cmd'
  }
  return cmd
}

export function spawnBackend(cfg, { logPath, onSpawnError, onExit }) {
  const log = fs.createWriteStream(logPath, { flags: 'a' })
  const proc = spawn(resolveCommand(cfg.command), cfg.args, {
    cwd: cfg.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.pipe(log)
  proc.stderr.pipe(log)
  proc.on('error', (err) => {
    log.end()
    onSpawnError?.(err)
  })
  proc.on('exit', (code, signal) => {
    log.end()
    onExit?.(code, signal)
  })
  return proc
}

export function stopBackend(proc, platform = process.platform) {
  if (!proc || proc.killed) return
  if (platform === 'win32') {
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
