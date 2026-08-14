// Generate assets/icon.png from assets/icon.svg (macOS QuickLook rasterizer).
// Runs via `npm run icons`; only needed when the icon source changes.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const assets = path.join(root, 'assets')
const svg = path.join(assets, 'icon.svg')
const out = path.join(assets, 'icon.png')

fs.mkdirSync(assets, { recursive: true })
if (!fs.existsSync(svg)) {
  console.error('missing', svg)
  process.exit(1)
}

// qlmanage renders an SVG thumbnail at a given pixel size.
execFileSync('qlmanage', ['-t', '-s', '1024', '-o', assets, svg], { stdio: 'inherit' })
const rendered = path.join(assets, 'icon.svg.png')
if (!fs.existsSync(rendered)) {
  console.error('qlmanage did not produce', rendered)
  process.exit(1)
}
fs.renameSync(rendered, out)
console.log('wrote', out)
