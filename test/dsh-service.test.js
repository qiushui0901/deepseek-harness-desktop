import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {
  loadConfig,
  parseArgsString,
  resolveCommand,
  probePort,
  waitForPort,
  DEFAULT_PORT,
  DEFAULT_STARTUP_TIMEOUT_MS,
} from '../src/dsh-service.js'

function tmpConfig(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-config-'))
  fs.writeFileSync(path.join(dir, 'config.json'), content)
  return dir
}

test('parseArgsString splits on whitespace and drops empties', () => {
  assert.deepEqual(parseArgsString('--yes @deepseek-ai/dsh web --port 3080'), [
    '--yes',
    '@deepseek-ai/dsh',
    'web',
    '--port',
    '3080',
  ])
  assert.deepEqual(parseArgsString('  a   b  '), ['a', 'b'])
})

test('loadConfig uses defaults when no file and no env', () => {
  const cfg = loadConfig({ userDataDir: tmpConfig('{}'), env: {} })
  assert.equal(cfg.port, DEFAULT_PORT)
  assert.equal(cfg.command, 'npx')
  assert.deepEqual(cfg.args, ['--yes', '@deepseek-ai/dsh', 'web', '--port', String(DEFAULT_PORT)])
  assert.equal(cfg.autoStart, true)
  assert.equal(cfg.shutdownOnQuit, true)
  assert.equal(cfg.startupTimeoutMs, DEFAULT_STARTUP_TIMEOUT_MS)
  assert.equal(cfg.cwd, undefined)
})

test('loadConfig honors config file values', () => {
  const dir = tmpConfig(
    JSON.stringify({
      port: 4000,
      command: 'pnpm',
      args: ['dsh', 'web', '--port', '4000'],
      cwd: '/opt/harness',
      autoStart: false,
      shutdownOnQuit: false,
    }),
  )
  const cfg = loadConfig({ userDataDir: dir, env: {} })
  assert.equal(cfg.port, 4000)
  assert.equal(cfg.command, 'pnpm')
  assert.deepEqual(cfg.args, ['dsh', 'web', '--port', '4000'])
  assert.equal(cfg.cwd, '/opt/harness')
  assert.equal(cfg.autoStart, false)
  assert.equal(cfg.shutdownOnQuit, false)
})

test('loadConfig env beats config file', () => {
  const dir = tmpConfig(JSON.stringify({ port: 4000, command: 'pnpm' }))
  const cfg = loadConfig({
    userDataDir: dir,
    env: { DSH_DESKTOP_PORT: '5000', DSH_DESKTOP_COMMAND: 'yarn', DSH_DESKTOP_ARGS: 'a b c' },
  })
  assert.equal(cfg.port, 5000)
  assert.equal(cfg.command, 'yarn')
  assert.deepEqual(cfg.args, ['a', 'b', 'c'])
})

test('loadConfig tolerates a missing config file', () => {
  const cfg = loadConfig({ userDataDir: path.join(os.tmpdir(), 'does-not-exist-xyz'), env: {} })
  assert.equal(cfg.port, DEFAULT_PORT)
})

test('resolveCommand appends .cmd for bare names on win32 only', () => {
  assert.equal(resolveCommand('npx', 'win32'), 'npx.cmd')
  assert.equal(resolveCommand('pnpm', 'win32'), 'pnpm.cmd')
  assert.equal(resolveCommand('C:\\tools\\dsh.exe', 'win32'), 'C:\\tools\\dsh.exe')
  assert.equal(resolveCommand('npx', 'darwin'), 'npx')
  assert.equal(resolveCommand('npx', 'linux'), 'npx')
})

test('probePort reports a listening local server and a closed port', async () => {
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    assert.equal(await probePort(port, 500), true)
    assert.equal(await probePort(1, 200), false) // privileged port, nothing listens
  } finally {
    server.close()
  }
})

test('waitForPort resolves true once a server appears', async () => {
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    assert.equal(await waitForPort(port, 2000, 50), true)
  } finally {
    server.close()
  }
})

test('waitForPort times out on a closed port', async () => {
  assert.equal(await waitForPort(1, 300, 50), false)
})
