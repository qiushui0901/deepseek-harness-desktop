import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {
  loadConfig,
  parseArgsString,
  resolveCommand,
  resolveCommandPath,
  probePort,
  waitForPort,
  probeHarness,
  waitForHarness,
  DEFAULT_PORT,
  DEFAULT_STARTUP_TIMEOUT_MS,
} from '../src/dsh-service.js'

function tmpConfig(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-config-'))
  fs.writeFileSync(path.join(dir, 'config.json'), content)
  return dir
}

function makeExecutable(dir, name) {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name)
  fs.writeFileSync(file, '#!/bin/sh\nexit 0\n')
  fs.chmodSync(file, 0o755)
  return file
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

test('resolveCommandPath finds executables under nvm even with empty PATH', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-home-'))
  const bin = path.join(home, '.nvm', 'versions', 'node', 'v99.0.0', 'bin')
  makeExecutable(bin, 'npx')
  const resolved = resolveCommandPath('npx', { platform: 'darwin', pathEnv: '/usr/bin:/bin', home })
  assert.equal(resolved.command, path.join(bin, 'npx'))
  assert.equal(resolved.pathEnv, bin)
})

test('resolveCommandPath searches PATH entries first', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-bin-'))
  makeExecutable(dir, 'dsh')
  const resolved = resolveCommandPath('dsh', { platform: 'darwin', pathEnv: dir })
  assert.equal(resolved.command, path.join(dir, 'dsh'))
})

test('resolveCommandPath returns null when nothing matches', () => {
  assert.equal(resolveCommandPath('no-such-command-xyz', { platform: 'darwin', pathEnv: '/usr/bin' }), null)
})

test('resolveCommandPath keeps absolute commands untouched', () => {
  assert.deepEqual(resolveCommandPath('/opt/custom/dsh', { platform: 'darwin' }), {
    command: '/opt/custom/dsh',
    pathEnv: null,
  })
})

test('resolveCommandPath finds .cmd shims on win32', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-win-'))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'npx.cmd'), '@echo off\r\n')
  const resolved = resolveCommandPath('npx', { platform: 'win32', pathEnv: dir })
  assert.equal(resolved.command, path.join(dir, 'npx.cmd'))
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

// ---------------------------------------------------------------------------
// probeHarness / waitForHarness (HTTP health check)
// ---------------------------------------------------------------------------

function startHttpServer(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

test('probeHarness accepts a response carrying the __DSH_BOOT__ marker', async () => {
  const { server, port } = await startHttpServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<!doctype html><script>window.__DSH_BOOT__ = {"rev":"abc"}</script>')
  })
  try {
    assert.deepEqual(await probeHarness(port, 1000), { ok: true, reason: 'harness' })
  } finally {
    server.close()
  }
})

test('probeHarness rejects foreign services that answer without the marker', async () => {
  const { server, port } = await startHttpServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('hello from some other local service')
  })
  try {
    assert.deepEqual(await probeHarness(port, 1000), { ok: false, reason: 'not-harness' })
  } finally {
    server.close()
  }
})

test('probeHarness reports http-error for non-2xx answers', async () => {
  const { server, port } = await startHttpServer((_req, res) => {
    res.writeHead(503)
    res.end('down')
  })
  try {
    assert.deepEqual(await probeHarness(port, 1000), { ok: false, reason: 'http-error' })
  } finally {
    server.close()
  }
})

test('probeHarness reports no-listener on a closed port', async () => {
  assert.deepEqual(await probeHarness(1, 1000), { ok: false, reason: 'no-listener' })
})

test('waitForHarness resolves once the Harness marker appears', async () => {
  let harness = false
  const { server, port } = await startHttpServer((_req, res) => {
    res.writeHead(200)
    res.end(harness ? '<script>window.__DSH_BOOT__ = {}</script>' : 'starting…')
  })
  try {
    const waiting = waitForHarness(port, 2000, 50)
    setTimeout(() => {
      harness = true
    }, 120)
    assert.equal(await waiting, true)
  } finally {
    server.close()
  }
})

test('waitForHarness times out when only a foreign service answers', async () => {
  const { server, port } = await startHttpServer((_req, res) => {
    res.writeHead(200)
    res.end('not harness')
  })
  try {
    assert.equal(await waitForHarness(port, 300, 50), false)
  } finally {
    server.close()
  }
})
