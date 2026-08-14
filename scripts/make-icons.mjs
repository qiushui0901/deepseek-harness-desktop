// Generate all icon formats from the whale artwork (assets/whale.svg):
//   assets/icon.svg  — composed macOS-style icon (rounded rect + centered whale)
//   assets/icon.png  — 1024px render
//   assets/icon.icns — macOS icon
//   assets/icon.ico  — Windows icon (embedded PNG entries)
//
// Renderer: sips (ImageIO) preserves transparency — qlmanage forces an opaque
// background, which would fill in the rounded corners. After rendering, the
// whale's pixel bbox is measured and the placement is corrected until the
// artwork is optically centered. Run via `npm run icons`.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'assets')
const whaleSvg = path.join(assets, 'whale.svg')
const iconSvg = path.join(assets, 'icon.svg')
const png = path.join(assets, 'icon.png')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-icons-'))

function sh(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' })
}

// ---------------------------------------------------------------------------
// Path bbox (approximate: includes control points, good enough for layout)
// ---------------------------------------------------------------------------

function pathBBox(d) {
  const tokens = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g
  let m
  while ((m = re.exec(d))) tokens.push(m[1] ?? parseFloat(m[2]))
  const paramCount = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let x = 0, y = 0
  const record = (px, py) => {
    if (px < minX) minX = px
    if (py < minY) minY = py
    if (px > maxX) maxX = px
    if (py > maxY) maxY = py
  }
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (typeof t !== 'string') throw new Error('unexpected bare number at ' + i)
    const abs = t.toUpperCase()
    const rel = t !== abs && abs !== 'Z'
    if (abs === 'Z') { i++; continue }
    const n = paramCount[abs]
    const nums = tokens.slice(i + 1, i + 1 + n)
    if (nums.length < n || nums.some((v) => typeof v !== 'number')) break
    const num = (k) => (rel ? (k % 2 === 0 ? x : y) : 0) + nums[k]
    if (abs === 'H') { x = num(0); record(x, y) }
    else if (abs === 'V') { y = num(0); record(x, y) }
    else if (abs === 'A') { x = num(5); y = num(6); record(x, y) }
    else {
      for (let k = 0; k < n; k += 2) record(num(k), num(k + 1))
      if (n >= 2) { x = num(n - 2); y = num(n - 1) }
    }
    i += 1 + n
    while (i < tokens.length && typeof tokens[i] === 'number' && abs !== 'Z') {
      const rn = paramCount[abs]
      const rnums = tokens.slice(i, i + rn)
      if (rnums.length < rn || rnums.some((v) => typeof v !== 'number')) break
      const rnum = (k) => (rel ? (k % 2 === 0 ? x : y) : 0) + rnums[k]
      if (abs === 'H') { x = rnum(0); record(x, y) }
      else if (abs === 'V') { y = rnum(0); record(x, y) }
      else if (abs === 'A') { x = rnum(5); y = rnum(6); record(x, y) }
      else {
        for (let k = 0; k < rn; k += 2) record(rnum(k), rnum(k + 1))
        if (rn >= 2) { x = rnum(rn - 2); y = rnum(rn - 1) }
      }
      i += rn
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// ---------------------------------------------------------------------------
// PNG decode (for the optical-centering pass)
// ---------------------------------------------------------------------------

function decodePng(file) {
  const buf = fs.readFileSync(file)
  const chunks = {}
  {
    let off = 8
    const parts = {}
    while (off < buf.length) {
      const len = buf.readUInt32BE(off)
      const type = buf.toString('ascii', off + 4, off + 8)
      ;(parts[type] ||= []).push(buf.subarray(off + 8, off + 8 + len))
      off += 12 + len
    }
    for (const [type, list] of Object.entries(parts)) chunks[type] = Buffer.concat(list)
  }
  const width = chunks.IHDR.readUInt32BE(0)
  const height = chunks.IHDR.readUInt32BE(4)
  const bpp = 4
  const stride = width * bpp
  const idat = zlib.inflateSync(chunks.IDAT)
  const out = Buffer.alloc(height * stride)
  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = idat[pos++]
    const row = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const raw = idat[pos + x]
      const a = x >= bpp ? row[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      let v = raw
      if (filter === 1) v = raw + a
      else if (filter === 2) v = raw + b
      else if (filter === 3) v = raw + Math.floor((a + b) / 2)
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      row[x] = v & 0xff
    }
    pos += stride
  }
  return { width, height, out, stride, bpp }
}

function darkPixelBBox(png) {
  const { width, height, out, stride, bpp } = png
  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * bpp
      if (out[i + 3] > 16 && out[i] < 100 && out[i + 1] < 100 && out[i + 2] < 100) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

// ---------------------------------------------------------------------------
// Compose the icon
// ---------------------------------------------------------------------------

const whaleSource = fs.readFileSync(whaleSvg, 'utf8')
const d = whaleSource.match(/\sd="([^"]*)"/)[1]
const art = pathBBox(d)
console.log(`whale art bbox: x ${art.x.toFixed(2)}..${(art.x + art.w).toFixed(2)}, y ${art.y.toFixed(2)}..${(art.y + art.h).toFixed(2)}`)

// Apple icon grid: 1024 canvas, rounded rect at (100,100) 824x824, rx 185.
// The whale is wide-and-short, so width constrains the scale.
const RECT = { x: 100, y: 100, size: 824, rx: 185 }
const MARGIN = 80
const scale = (RECT.size - MARGIN * 2) / art.w

function composeIcon(dx, dy) {
  const tx = 512 - (art.x + art.w / 2) * scale + dx
  const ty = 512 - (art.y + art.h / 2) * scale + dy
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
	<rect x="${RECT.x}" y="${RECT.y}" width="${RECT.size}" height="${RECT.size}" rx="${RECT.rx}" fill="#ffffff"/>
	<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(6)})">
		<path d="${d}"/>
	</g>
</svg>
`
}

// Render + optical centering: shift the whale so its rendered pixel bbox is
// centered on the canvas (the path bbox is only approximate).
let dx = 0
let dy = 0
for (let pass = 0; pass < 3; pass++) {
  fs.writeFileSync(iconSvg, composeIcon(dx, dy))
  sh('sips', ['-s', 'format', 'png', iconSvg, '--out', png])
  const { cx, cy } = darkPixelBBox(decodePng(png))
  const shiftX = 512 - cx
  const shiftY = 512 - cy
  console.log(`pass ${pass}: whale center (${cx.toFixed(1)}, ${cy.toFixed(1)}) -> shift (${shiftX.toFixed(1)}, ${shiftY.toFixed(1)})`)
  if (Math.abs(shiftX) < 1.5 && Math.abs(shiftY) < 1.5) break
  dx += shiftX
  dy += shiftY
}
console.log('wrote', iconSvg)
console.log('wrote', png)

// ---------------------------------------------------------------------------
// macOS .icns via iconset
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Windows .ico with embedded PNG entries (16/32/48/64/128/256)
// ---------------------------------------------------------------------------

const icoSizes = [256, 128, 64, 48, 32, 16]
const entries = []
for (const size of icoSizes) {
  const out = path.join(tmp, `icon-${size}.png`)
  sh('sips', ['-z', String(size), String(size), png, '--out', out])
  entries.push({ size, data: fs.readFileSync(out) })
}
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(entries.length, 4)
const dir = Buffer.alloc(16 * entries.length)
let offset = 6 + 16 * entries.length
entries.forEach((entry, i) => {
  const b = dir.subarray(i * 16, i * 16 + 16)
  b.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0)
  b.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1)
  b.writeUInt8(0, 2)
  b.writeUInt8(0, 3)
  b.writeUInt16LE(1, 4)
  b.writeUInt16LE(32, 6)
  b.writeUInt32LE(entry.data.length, 8)
  b.writeUInt32LE(offset, 12)
  offset += entry.data.length
})
const ico = path.join(assets, 'icon.ico')
fs.writeFileSync(ico, Buffer.concat([header, dir, ...entries.map((e) => e.data)]))
console.log('wrote', ico)

fs.rmSync(tmp, { recursive: true, force: true })
