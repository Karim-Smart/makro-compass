/**
 * Génère l'icône app de maKro Compass (256x256 PNG).
 * Dessine un compas doré (#C89B3C) sur fond bleu-void (#010A13) :
 *   - Cercle extérieur doré
 *   - Aiguille nord (or) + sud (argent)
 *   - Point central blanc
 *   - Points cardinaux N/S/E/W en petits dots
 *
 * Usage : node scripts/generate-app-icon.cjs
 */

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// ─── CRC32 ────────────────────────────────────────────────────────────────────

function makeCRCTable() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  return table
}

const CRC_TABLE = makeCRCTable()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

// ─── PNG builder (RGBA) ───────────────────────────────────────────────────────

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf])
}

function buildPNG(width, height, rgbaPixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type: RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  const rowBytes = width * 4
  const scanlines = Buffer.alloc(height * (1 + rowBytes))
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + rowBytes)] = 0 // filter: None
    rgbaPixels.copy(scanlines, y * (1 + rowBytes) + 1, y * rowBytes, (y + 1) * rowBytes)
  }

  const idat = zlib.deflateSync(scanlines, { level: 9 })

  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

const W = 256, H = 256
const pixels = Buffer.alloc(W * H * 4)

function setPixel(x, y, r, g, b, a = 255) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const i = (y * W + x) * 4
  // Alpha blending
  if (a < 255 && pixels[i + 3] > 0) {
    const srcA = a / 255
    const dstA = pixels[i + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA)
    pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA)
    pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA)
    pixels[i + 3] = Math.round(outA * 255)
  } else {
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a
  }
}

function fillAll(r, g, b, a = 255) {
  for (let i = 0; i < W * H; i++) {
    pixels[i * 4] = r; pixels[i * 4 + 1] = g; pixels[i * 4 + 2] = b; pixels[i * 4 + 3] = a
  }
}

function drawCircle(cx, cy, radius, r, g, b, a = 255, thickness = 1) {
  for (let angle = 0; angle < 360; angle += 0.2) {
    const rad = (angle * Math.PI) / 180
    for (let t = -thickness / 2; t <= thickness / 2; t += 0.5) {
      const px = cx + (radius + t) * Math.cos(rad)
      const py = cy + (radius + t) * Math.sin(rad)
      setPixel(px, py, r, g, b, a)
    }
  }
}

function drawFilledCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) {
        setPixel(cx + x, cy + y, r, g, b, a)
      }
    }
  }
}

function drawLine(x0, y0, x1, y1, r, g, b, a = 255, thickness = 1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.ceil(len * 2)
  const nx = -dy / len  // normal
  const ny = dx / len
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const px = x0 + dx * t
    const py = y0 + dy * t
    for (let w = -thickness / 2; w <= thickness / 2; w += 0.5) {
      setPixel(px + nx * w, py + ny * w, r, g, b, a)
    }
  }
}

function drawTriangle(x0, y0, x1, y1, x2, y2, r, g, b, a = 255) {
  const minX = Math.floor(Math.min(x0, x1, x2))
  const maxX = Math.ceil(Math.max(x0, x1, x2))
  const minY = Math.floor(Math.min(y0, y1, y2))
  const maxY = Math.ceil(Math.max(y0, y1, y2))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Barycentric coordinates
      const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
      if (Math.abs(d) < 0.001) continue
      const wa = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d
      const wb = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d
      const wc = 1 - wa - wb
      if (wa >= 0 && wb >= 0 && wc >= 0) {
        setPixel(x, y, r, g, b, a)
      }
    }
  }
}

// ─── Couleurs ────────────────────────────────────────────────────────────────

const BG    = [0x01, 0x0A, 0x13]    // blue-void
const GOLD  = [0xC8, 0x9B, 0x3C]    // or hextech
const GOLDD = [0x78, 0x5A, 0x28]    // or sombre
const GOLDL = [0xF0, 0xE6, 0xD2]    // or clair
const SILVER = [0xA0, 0xA7, 0xB4]   // argent
const WHITE = [0xFF, 0xFF, 0xF0]    // blanc cassé

const CX = 128, CY = 128

// ─── Dessin ──────────────────────────────────────────────────────────────────

// Fond transparent
fillAll(0, 0, 0, 0)

// Fond circulaire bleu-void
drawFilledCircle(CX, CY, 120, ...BG)

// Cercle extérieur doré (double)
drawCircle(CX, CY, 118, ...GOLD, 255, 3)
drawCircle(CX, CY, 112, ...GOLDD, 180, 2)

// Cercle intérieur fin
drawCircle(CX, CY, 85, ...GOLDD, 100, 1)

// Graduations cardinales (N, S, E, W) — petits traits dorés
for (let angle = 0; angle < 360; angle += 90) {
  const rad = (angle * Math.PI) / 180
  const x0 = CX + 85 * Math.cos(rad)
  const y0 = CY + 85 * Math.sin(rad)
  const x1 = CX + 112 * Math.cos(rad)
  const y1 = CY + 112 * Math.sin(rad)
  drawLine(x0, y0, x1, y1, ...GOLD, 255, 3)
}

// Graduations inter-cardinales — traits plus fins
for (let angle = 45; angle < 360; angle += 90) {
  const rad = (angle * Math.PI) / 180
  const x0 = CX + 90 * Math.cos(rad)
  const y0 = CY + 90 * Math.sin(rad)
  const x1 = CX + 108 * Math.cos(rad)
  const y1 = CY + 108 * Math.sin(rad)
  drawLine(x0, y0, x1, y1, ...GOLDD, 200, 2)
}

// Petites graduations (tous les 15°)
for (let angle = 0; angle < 360; angle += 15) {
  if (angle % 45 === 0) continue // déjà dessinées
  const rad = (angle * Math.PI) / 180
  const x0 = CX + 95 * Math.cos(rad)
  const y0 = CY + 95 * Math.sin(rad)
  const x1 = CX + 105 * Math.cos(rad)
  const y1 = CY + 105 * Math.sin(rad)
  drawLine(x0, y0, x1, y1, ...GOLDD, 120, 1)
}

// Aiguille NORD (triangle doré pointant vers le haut)
drawTriangle(
  CX, CY - 80,     // pointe nord
  CX - 12, CY,     // base gauche
  CX + 12, CY,     // base droite
  ...GOLD
)
// Highlight plus clair sur la moitié droite
drawTriangle(
  CX, CY - 80,
  CX, CY,
  CX + 12, CY,
  ...GOLDL, 120
)

// Aiguille SUD (triangle argent pointant vers le bas)
drawTriangle(
  CX, CY + 80,     // pointe sud
  CX - 12, CY,     // base gauche
  CX + 12, CY,     // base droite
  ...SILVER
)
// Ombre sur la moitié gauche
drawTriangle(
  CX, CY + 80,
  CX - 12, CY,
  CX, CY,
  ...GOLDD, 100
)

// Cercle central (moyeu du compas)
drawFilledCircle(CX, CY, 8, ...GOLD)
drawFilledCircle(CX, CY, 5, ...WHITE)
drawCircle(CX, CY, 8, ...GOLDD, 255, 1)

// Petit losange central de précision
drawFilledCircle(CX, CY, 3, ...GOLD)

// Dots cardinaux (petits cercles dorés aux 4 points)
const cardinalDist = 100
const cardinalPts = [
  [CX, CY - cardinalDist],  // N
  [CX, CY + cardinalDist],  // S
  [CX + cardinalDist, CY],  // E
  [CX - cardinalDist, CY],  // W
]
for (const [x, y] of cardinalPts) {
  drawFilledCircle(x, y, 4, ...GOLD)
}

// ─── Export ──────────────────────────────────────────────────────────────────

const outPath = path.join(__dirname, '../resources/icon.png')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, buildPNG(W, H, pixels))
console.log(`\u2713 Ic\u00f4ne app g\u00e9n\u00e9r\u00e9e : ${outPath} (${W}x${H})`)
