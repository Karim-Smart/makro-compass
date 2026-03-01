/**
 * Génère l'icône systray de maKro Compass (16x16 PNG).
 * Dessine une rose des vents (croix + losange) en or #C89B3C sur fond #1A1A2E.
 *
 * Usage : node scripts/generate-tray-icon.js
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

// ─── PNG builder ──────────────────────────────────────────────────────────────

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf])
}

function buildPNG(width, height, rgbPixels) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // Scanlines avec byte de filtre 0 (None) en tête de chaque ligne
  const scanlines = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 3)] = 0 // filter type None
    rgbPixels.copy(scanlines, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3)
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

// ─── Dessin de l'icône ────────────────────────────────────────────────────────

const W = 16, H = 16

// Couleurs
const BG  = [0x1A, 0x1A, 0x2E]  // fond dark bleu-nuit
const GOLD = [0xC8, 0x9B, 0x3C] // or maKro
const WHT  = [0xFF, 0xFF, 0xE0] // blanc cassé (centre)

const pixels = Buffer.alloc(W * H * 3)

function fill(r, g, b) {
  for (let i = 0; i < W * H; i++) {
    pixels[i * 3] = r; pixels[i * 3 + 1] = g; pixels[i * 3 + 2] = b
  }
}

function setPixel(x, y, [r, g, b]) {
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const i = (y * W + x) * 3
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b
}

// Fond
fill(...BG)

// Croix centrale (colonne 7-8, lignes 0-15 et lignes 7-8, colonnes 0-15)
for (let i = 0; i < 16; i++) {
  setPixel(7, i, GOLD)
  setPixel(8, i, GOLD)
  setPixel(i, 7, GOLD)
  setPixel(i, 8, GOLD)
}

// Losange extérieur (diagonales)
const diamondPts = [
  [7,0],[8,0],
  [5,2],[6,2],[9,2],[10,2],
  [3,4],[4,4],[11,4],[12,4],
  [1,6],[2,6],[13,6],[14,6],
  [1,9],[2,9],[13,9],[14,9],
  [3,11],[4,11],[11,11],[12,11],
  [5,13],[6,13],[9,13],[10,13],
  [7,15],[8,15],
]
for (const [x, y] of diamondPts) setPixel(x, y, GOLD)

// Centre blanc (point de visée)
setPixel(7, 7, WHT)
setPixel(8, 7, WHT)
setPixel(7, 8, WHT)
setPixel(8, 8, WHT)

// ─── Export ───────────────────────────────────────────────────────────────────

const outPath = path.join(__dirname, '../resources/tray-icon.png')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, buildPNG(W, H, pixels))
console.log(`✓ Icône tray générée : ${outPath}`)
