// Smoke-test a packaged build: launch the packaged binary with `--smoke` and
// require SMOKE_OK + exit 0. Used locally and on CI (see .github/workflows).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCT = 'DeepSeek Harness Desktop'
const TIMEOUT_MS = 900_000 // cold npx installs of the dsh tree can take a while
const STARTUP_TIMEOUT_MS = 480_000

function defaultAppPath() {
  if (process.platform === 'win32') {
    return path.join(root, 'dist', 'win-unpacked', `${PRODUCT}.exe`)
  }
  if (process.platform === 'linux') {
    return path.join(root, 'dist', 'linux-unpacked', 'deepseek-harness-desktop')
  }
  const archDir = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
  return path.join(root, 'dist', archDir, `${PRODUCT}.app`, 'Contents', 'MacOS', PRODUCT)
}

const appPath = process.env.PACKAGED_APP_PATH ?? defaultAppPath()
if (!fs.existsSync(appPath)) {
  console.error(`packaged app not found: ${appPath}`)
  process.exit(1)
}

const child = spawn(appPath, ['--smoke'], {
  env: { ...process.env, DSH_DESKTOP_STARTUP_TIMEOUT_MS: String(STARTUP_TIMEOUT_MS) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
child.stdout.on('data', (chunk) => {
  output += chunk
  process.stdout.write(chunk)
})
child.stderr.on('data', (chunk) => {
  output += chunk
})

const timeout = setTimeout(() => {
  console.error(`packaged smoke timed out after ${TIMEOUT_MS / 1000}s`)
  child.kill('SIGKILL')
  process.exit(1)
}, TIMEOUT_MS)

child.on('exit', (code) => {
  clearTimeout(timeout)
  if (code === 0 && output.includes('SMOKE_OK')) {
    console.log(`packaged smoke: OK (${appPath})`)
    process.exit(0)
  }
  console.error(`packaged smoke FAILED: exit=${code}, SMOKE_OK=${output.includes('SMOKE_OK')}`)
  const tail = output.split('\n').slice(-30).join('\n')
  console.error('--- last app output ---\n' + tail + '\n------------------------')
  process.exit(1)
})
