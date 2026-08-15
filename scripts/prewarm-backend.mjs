// Pre-warm the DeepSeek Harness backend before a packaged smoke test.
// CI runners (especially Windows, where Defender scans every file on first
// access) can take 10+ minutes to cold-start `dsh web` through npx — which
// blows the smoke test's startup budget. This script starts the backend once
// on a scratch port, waits for readiness, and kills it, so the subsequent
// packaged-app spawn reuses warm caches and starts in seconds.
import { spawn } from 'node:child_process'
import process from 'node:process'

const PORT = Number(process.env.PREWARM_PORT ?? 39999)
const READY_TIMEOUT_MS = 600_000

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(npx, ['--yes', '@deepseek-ai/dsh', 'web', '--port', String(PORT)], {
  stdio: 'ignore',
})

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

async function probe() {
  try {
    const res = await withTimeout(
      fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(3000), redirect: 'manual' }),
      5000,
    )
    if (res.ok) return true
  } catch {
    /* not ready yet */
  }
  return false
}

function killChild() {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      child.kill()
    }
  } else {
    child.kill('SIGTERM')
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }, 3000).unref()
  }
}

const started = Date.now()
async function poll() {
  if (await probe()) {
    console.log(`prewarm: backend ready on ${PORT}`)
    killChild()
    setTimeout(() => process.exit(0), 4000).unref()
    return
  }
  if (Date.now() - started > READY_TIMEOUT_MS) {
    console.error(`prewarm: backend not ready within ${READY_TIMEOUT_MS / 1000}s`)
    killChild()
    process.exit(1)
  }
  setTimeout(poll, 2000)
}

child.on('error', (err) => {
  console.error('prewarm: spawn failed:', err.message)
  process.exit(1)
})

poll()
