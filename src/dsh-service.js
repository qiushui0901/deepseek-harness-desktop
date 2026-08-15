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
import os from 'node:os'
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
  const dshVersion = env.DSH_DESKTOP_DSH_VERSION ?? file.dshVersion ?? null
  const fileArgs = file.args
  const argsSource =
    env.DSH_DESKTOP_ARGS ??
    (Array.isArray(fileArgs) ? fileArgs : fileArgs ? JSON.stringify(fileArgs) : null) ??
    `--yes @deepseek-ai/dsh${dshVersion ? '@' + dshVersion : ''} web --port ${port}`
  return {
    port,
    command: env.DSH_DESKTOP_COMMAND ?? file.command ?? overrides.command ?? 'npx',
    args: Array.isArray(argsSource) ? argsSource : parseArgsString(argsSource),
    cwd: env.DSH_DESKTOP_CWD ?? file.cwd ?? undefined,
    autoStart: file.autoStart !== false,
    shutdownOnQuit: file.shutdownOnQuit !== false,
    updateNotifications: file.updateNotifications !== false,
    dshVersion,
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

export function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

/**
 * HTTP health check that identifies the DeepSeek Harness Web UI by its
 * characteristic `__DSH_BOOT__` marker, instead of treating any TCP listener
 * on the port as Harness. Returns:
 *   { ok: true, reason: 'harness' }            — Harness is serving
 *   { ok: false, reason: 'not-harness' }       — something responds, but not Harness
 *   { ok: false, reason: 'no-listener' }       — nothing is listening
 *   { ok: false, reason: 'http-error' }        — server answered non-2xx
 */
export async function probeHarness(port, timeoutMs = PROBE_TIMEOUT_MS) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return { ok: false, reason: 'http-error' }
    const body = await res.text()
    return body.includes('__DSH_BOOT__') ? { ok: true, reason: 'harness' } : { ok: false, reason: 'not-harness' }
  } catch (err) {
    const code = err?.cause?.code ?? err?.code
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENOTFOUND') {
      return { ok: false, reason: 'no-listener' }
    }
    if (err?.name === 'TimeoutError') {
      // A socket accepted the connection but never answered like Harness.
      return { ok: false, reason: 'not-harness' }
    }
    return { ok: false, reason: 'no-listener' }
  }
}

/**
 * Wait for the Harness backend to become ready. Polls with a plain TCP probe
 * (net.connect is bulletproof everywhere) and runs the HTTP identity check
 * exactly once, right after the port becomes reachable — undici `fetch` has
 * been observed to hang indefinitely on some Windows runners, so it must
 * never sit inside a polling loop. `onTick` fires on every poll for progress
 * logging (smoke runs).
 */
export function waitForHarness(port, timeoutMs, intervalMs = POLL_INTERVAL_MS, onTick) {
  const start = Date.now()
  let checked = false
  return new Promise((resolve) => {
    const tick = async () => {
      const up = await probePort(port)
      if (up && !checked) {
        checked = true
        const probe = await withTimeout(probeHarness(port), 2000).catch(() => ({ ok: false, reason: 'probe-error' }))
        if (probe.ok) return resolve(true)
        // Listener is up but not (yet) Harness — keep polling; no more HTTP
        // checks while it stays up.
      }
      onTick?.()
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

// Well-known install locations for Node.js tooling, searched when the app is
// launched from Finder/Explorer where PATH is minimal or empty.
function commonBinDirs(platform, home, env) {
  const dirs = []
  if (platform === 'win32') {
    if (env.APPDATA) dirs.push(path.join(env.APPDATA, 'npm'))
    if (env.ProgramFiles) dirs.push(path.join(env.ProgramFiles, 'nodejs'))
    if (env['ProgramFiles(x86)']) dirs.push(path.join(env['ProgramFiles(x86)'], 'nodejs'))
    if (env.LOCALAPPDATA) dirs.push(path.join(env.LOCALAPPDATA, 'Programs', 'nodejs'))
  } else {
    const nvmRoot = path.join(home, '.nvm', 'versions', 'node')
    try {
      for (const version of fs.readdirSync(nvmRoot)) {
        dirs.push(path.join(nvmRoot, version, 'bin'))
      }
    } catch {
      /* no nvm install */
    }
    if (platform === 'darwin') {
      dirs.push('/opt/homebrew/bin', '/opt/homebrew/opt/node/bin')
    }
    dirs.push('/usr/local/bin', '/usr/bin')
  }
  return dirs
}

/**
 * Resolve a bare command name to an absolute path, searching PATH first and
 * then well-known Node.js install locations. Returns `{ command, pathEnv }`
 * where `pathEnv` is the directory to prepend to the child's PATH (so scripts
 * like npx can also find `node`), or `null` when nothing was found.
 */
export function resolveCommandPath(cmd, { platform = process.platform, pathEnv = process.env.PATH, home = os.homedir(), env = process.env } = {}) {
  if (path.isAbsolute(cmd)) return { command: cmd, pathEnv: null }
  // On win32, never pick an extensionless file: Node ships `npx` (a POSIX sh
  // script), `npx.cmd` and `npx.exe` side by side, and only the latter two can
  // be spawned directly. Prefer .exe, then .cmd.
  const names = platform === 'win32' ? [`${cmd}.exe`, `${cmd}.cmd`] : [cmd]
  const dirs = [...(pathEnv || '').split(path.delimiter).filter(Boolean), ...commonBinDirs(platform, home, env)]
  const seen = new Set()
  for (const dir of dirs) {
    if (!dir || seen.has(dir)) continue
    seen.add(dir)
    for (const name of names) {
      const candidate = path.join(dir, name)
      try {
        if (!fs.existsSync(candidate)) continue
        if (platform !== 'win32') fs.accessSync(candidate, fs.constants.X_OK)
        return { command: candidate, pathEnv: dir }
      } catch {
        /* keep looking */
      }
    }
  }
  return null
}

export function spawnBackend(cfg, { command = resolveCommand(cfg.command), pathEnv = null, logPath, onSpawnError, onExit }) {
  const log = fs.createWriteStream(logPath, { flags: 'a' })
  const proc = spawn(command, cfg.args, {
    cwd: cfg.cwd,
    env: {
      ...process.env,
      ...(pathEnv ? { PATH: [pathEnv, process.env.PATH].filter(Boolean).join(path.delimiter) } : {}),
    },
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
    // `proc.killed` only means the signal was *sent*, not that the process
    // exited — so escalate to SIGKILL based on the exit state instead.
    const timer = setTimeout(() => {
      if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL')
    }, 3000)
    timer.unref()
    proc.once('exit', () => clearTimeout(timer))
  }
}
