'use strict'

/**
 * Update awareness for the DeepSeek Harness backend.
 *
 * The shell runs the backend through `npx --yes @deepseek-ai/dsh web`, and npx
 * resolves the latest published version on every launch — so a new release on
 * the npm registry is picked up automatically on the next backend start. This
 * module only makes that fact *visible*: it reads the version actually cached
 * by npx, queries the registry for the latest one, and compares them.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Version comparison (minimal semver: major.minor.patch[-prerelease])
// ---------------------------------------------------------------------------

function parseParts(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(version).trim())
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] }
}

function comparePre(a, b) {
  if (a === undefined && b === undefined) return 0
  if (a === undefined) return 1 // release > prerelease
  if (b === undefined) return -1
  const pa = a.split('.')
  const pb = b.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (i >= pa.length) return -1
    if (i >= pb.length) return 1
    const x = /^\d+$/.test(pa[i]) ? Number(pa[i]) : pa[i]
    const y = /^\d+$/.test(pb[i]) ? Number(pb[i]) : pb[i]
    if (typeof x === 'number' && typeof y === 'string') return -1 // numeric < alpha
    if (typeof x === 'string' && typeof y === 'number') return 1
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}

/**
 * Compare two semver-ish strings. Returns -1 / 0 / 1, or `null` when either
 * input is not a valid version.
 */
export function compareVersions(a, b) {
  const pa = parseParts(a)
  const pb = parseParts(b)
  if (!pa || !pb) return null
  for (const key of ['major', 'minor', 'patch']) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1
  }
  return comparePre(pa.pre, pb.pre)
}

// ---------------------------------------------------------------------------
// Cached (running) version — what npx has installed and will run
// ---------------------------------------------------------------------------

export function npxCacheRoots(platform = process.platform, home = os.homedir(), env = process.env) {
  if (platform === 'win32') {
    return [
      env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'npm-cache', '_npx') : null,
      env.APPDATA ? path.join(env.APPDATA, 'npm-cache', '_npx') : null,
    ].filter(Boolean)
  }
  return [path.join(home, '.npm', '_npx')]
}

export function readCachedDshVersions(cacheRoots) {
  const versions = new Set()
  for (const root of cacheRoots) {
    let hashes = []
    try {
      hashes = fs.readdirSync(root)
    } catch {
      continue
    }
    for (const hash of hashes) {
      try {
        const pkgPath = path.join(root, hash, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        if (typeof pkg.version === 'string' && parseParts(pkg.version)) versions.add(pkg.version)
      } catch {
        /* not a dsh cache entry */
      }
    }
  }
  return [...versions]
}

export function latestCachedDshVersion(cacheRoots) {
  return readCachedDshVersions(cacheRoots).sort(compareVersions).at(-1) ?? null
}

// ---------------------------------------------------------------------------
// Latest published version — from the npm registry
// ---------------------------------------------------------------------------

export async function fetchLatestDshVersion({
  fetchFn = globalThis.fetch,
  registryUrl = 'https://registry.npmjs.org/@deepseek-ai/dsh/latest',
  timeoutMs = 5000,
} = {}) {
  try {
    const res = await fetchFn(registryUrl, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const json = await res.json()
    return typeof json?.version === 'string' && parseParts(json.version) ? json.version : null
  } catch {
    return null // offline or registry hiccup — never block the app on this
  }
}
