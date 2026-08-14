import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  compareVersions,
  npxCacheRoots,
  readCachedDshVersions,
  latestCachedDshVersion,
  fetchLatestDshVersion,
} from '../src/updates.js'

test('compareVersions handles patch and minor bumps', () => {
  assert.equal(compareVersions('0.1.0', '0.1.1'), -1)
  assert.equal(compareVersions('0.1.1', '0.1.0'), 1)
  assert.equal(compareVersions('1.0.0', '0.9.9'), 1)
  assert.equal(compareVersions('0.1.0', '0.1.0'), 0)
})

test('compareVersions treats prereleases as lower than releases', () => {
  assert.equal(compareVersions('0.1.0-rc.6', '0.1.0'), -1)
  assert.equal(compareVersions('0.1.0', '0.1.0-rc.6'), 1)
  assert.equal(compareVersions('0.1.0-rc.6', '0.1.0-rc.7'), -1)
  assert.equal(compareVersions('0.1.0-rc.7', '0.1.0-rc.6'), 1)
  assert.equal(compareVersions('0.1.0-rc.10', '0.1.0-rc.9'), 1) // numeric, not lexical
})

test('compareVersions rejects invalid inputs', () => {
  assert.equal(compareVersions('not-a-version', '0.1.0'), null)
  assert.equal(compareVersions('0.1.0', 'v0.1.0'), null)
})

function makeCache(home, hashes) {
  for (const [hash, version] of Object.entries(hashes)) {
    const dir = path.join(home, '.npm', '_npx', hash, 'node_modules', '@deepseek-ai', 'dsh')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', version }))
  }
}

test('readCachedDshVersions collects versions from npx cache hashes', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-cache-'))
  makeCache(home, { aaaa: '0.1.0-rc.5', bbbb: '0.1.0-rc.6' })
  const roots = npxCacheRoots('darwin', home, {})
  assert.deepEqual(readCachedDshVersions(roots).sort(), ['0.1.0-rc.5', '0.1.0-rc.6'])
  assert.equal(latestCachedDshVersion(roots), '0.1.0-rc.6')
})

test('readCachedDshVersions ignores missing or foreign entries', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-cache-'))
  fs.mkdirSync(path.join(home, '.npm', '_npx', 'cccc', 'node_modules', 'other'), { recursive: true })
  fs.writeFileSync(path.join(home, '.npm', '_npx', 'cccc', 'node_modules', 'other', 'package.json'), JSON.stringify({ version: '9.9.9' }))
  const roots = npxCacheRoots('darwin', home, {})
  assert.deepEqual(readCachedDshVersions(roots), [])
  assert.equal(latestCachedDshVersion(roots), null)
})

test('npxCacheRoots points at the npm cache on every platform', () => {
  assert.deepEqual(npxCacheRoots('darwin', '/home/user', {}), [path.join('/home/user', '.npm', '_npx')])
  assert.deepEqual(npxCacheRoots('linux', '/home/user', {}), [path.join('/home/user', '.npm', '_npx')])
  const local = 'C:\\Users\\u\\AppData\\Local'
  const roaming = 'C:\\Users\\u\\AppData\\Roaming'
  const roots = npxCacheRoots('win32', 'C:\\Users\\u', { LOCALAPPDATA: local, APPDATA: roaming })
  assert.deepEqual(roots, [path.join(local, 'npm-cache', '_npx'), path.join(roaming, 'npm-cache', '_npx')])
})

test('fetchLatestDshVersion returns the registry version', async () => {
  const fetchFn = async () => ({ ok: true, json: async () => ({ version: '0.2.0' }) })
  assert.equal(await fetchLatestDshVersion({ fetchFn }), '0.2.0')
})

test('fetchLatestDshVersion fails soft on errors, bad status and bad payloads', async () => {
  assert.equal(await fetchLatestDshVersion({ fetchFn: async () => { throw new Error('offline') } }), null)
  assert.equal(await fetchLatestDshVersion({ fetchFn: async () => ({ ok: false, status: 404 }) }), null)
  assert.equal(await fetchLatestDshVersion({ fetchFn: async () => ({ ok: true, json: async () => ({}) }) }), null)
  assert.equal(await fetchLatestDshVersion({ fetchFn: async () => ({ ok: true, json: async () => ({ version: 'bogus' }) }) }), null)
})
