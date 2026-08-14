// Generate all icon formats from assets/icon.svg:
//   icon.png (1024) · icon.icns (macOS) · icon.ico (Windows)
// Uses qlmanage (SVG rasterize), sips (resize) and iconutil (icns) — all
// built into macOS. Run via `npm run icons`.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'assets')
const svg = path.join(assets, 'icon.svg')
const png = path.join(assets, 'icon.png')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-icons-'))

function sh(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' })
}

if (!fs.existsSync(svg)) {
  console.error('missing', svg)
  process.exit(1)
}

// 1. Rasterize the 1024x1024 SVG. sips (ImageIO) preserves transparency —
//    qlmanage forces an opaque background, which would fill in rounded corners.
sh('sips', ['-s', 'format', 'png', svg, '--out', png])
const rendered = png
if (!fs.existsSync(rendered)) {
  console.error('sips did not produce', rendered)
  process.exit(1)
}
fs.copyFileSync(rendered, png)
console.log('wrote', png)

// 2. macOS .icns via iconset
const iconset = path.join(tmp, 'icon.iconset')
fs.mkdirSync(iconset, { recursive: true })
const sizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]
for (const [name, size] of sizes) {
  sh('sips', ['-z', String(size), String(size), png, '--out', path.join(iconset, name)])
}
const icns = path.join(assets, 'icon.icns')
sh('iconutil', ['-c', 'icns', iconset, '-o', icns])
console.log('wrote', icns)

// 3. Windows .ico with embedded PNG entries (16/32/48/64/128/256)
const icoSizes = [256, 128, 64, 48, 32, 16]
const entries = []
for (const size of icoSizes) {
  const out = path.join(tmp, `icon-${size}.png`)
  sh('sips', ['-z', String(size), String(size), png, '--out', out])
  entries.push({ size, data: fs.readFileSync(out) })
}
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(entries.length, 4)
const dir = Buffer.alloc(16 * entries.length)
let offset = 6 + 16 * entries.length
entries.forEach((entry, i) => {
  const b = dir.subarray(i * 16, i * 16 + 16)
  b.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0) // 0 means 256
  b.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1)
  b.writeUInt8(0, 2)
  b.writeUInt8(0, 3)
  b.writeUInt16LE(1, 4) // planes
  b.writeUInt16LE(32, 6) // bit count
  b.writeUInt32LE(entry.data.length, 8)
  b.writeUInt32LE(offset, 12)
  offset += entry.data.length
})
const ico = path.join(assets, 'icon.ico')
fs.writeFileSync(ico, Buffer.concat([header, dir, ...entries.map((e) => e.data)]))
console.log('wrote', ico)

fs.rmSync(tmp, { recursive: true, force: true })
