// 生成番茄图标：tomato.png (256)、tomato-32.png (32)、tomato.ico
const fs = require('fs')
const zlib = require('zlib')

// ---------- CRC32 ----------
const T = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  T[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function png(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}
function ico(entries) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(entries.length, 4)
  const dirs = []
  let offset = 6 + 16 * entries.length
  for (const [size, buf] of entries) {
    const d = Buffer.alloc(16)
    d[0] = size >= 256 ? 0 : size
    d[1] = size >= 256 ? 0 : size
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(buf.length, 8)
    d.writeUInt32LE(offset, 12)
    offset += buf.length
    dirs.push(d)
  }
  return Buffer.concat([head, ...dirs, ...entries.map((e) => e[1])])
}

// ---------- 画番茄（4x4 超采样抗锯齿） ----------
function draw(size) {
  const buf = Buffer.alloc(size * size * 4)
  const SS = 4
  const cx = size * 0.50
  const cy = size * 0.62
  const rx = size * 0.44
  const ry = size * 0.33
  const hx0 = cx - rx * 0.42, hy0 = cy - ry * 0.52
  const hxr = rx * 0.30, hyr = ry * 0.24
  // 叶子三角形（相对坐标）
  const leafL = [[0.50, 0.18], [0.26, 0.03], [0.40, 0.24]]
  const leafR = [[0.53, 0.16], [0.76, 0.02], [0.64, 0.24]]
  const leafS = [[0.53, 0.16], [0.53, 0.04], [0.60, 0.13]]
  const inTri = (fx, fy, t) => {
    const [p1, p2, p3] = t.map((p) => [p[0] * size, p[1] * size])
    const d1 = [p2[0] - p1[0], p2[1] - p1[1]]
    const d2 = [p3[0] - p1[0], p3[1] - p1[1]]
    const v = [fx - p1[0], fy - p1[1]]
    const det = d1[0] * d2[1] - d1[1] * d2[0]
    const a = (v[0] * d2[1] - v[1] * d2[0]) / det
    const b = (d1[0] * v[1] - d1[1] * v[0]) / det
    return a >= 0 && b >= 0 && a + b <= 1
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0, A = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS
          const fy = y + (sy + 0.5) / SS
          let col = null
          if (inTri(fx, fy, leafL) || inTri(fx, fy, leafR)) col = [88, 172, 96]
          else if (inTri(fx, fy, leafS)) col = [120, 196, 116]
          else {
            const e = ((fx - cx) / rx) ** 2 + ((fy - cy) / ry) ** 2
            if (e <= 1) {
              col = e < 0.72 ? [231, 80, 82] : [203, 56, 62]
              const he = ((fx - hx0) / hxr) ** 2 + ((fy - hy0) / hyr) ** 2
              if (he <= 1) col = [252, 150, 150]
            }
          }
          if (col) { R += col[0]; G += col[1]; B += col[2]; A += 255 }
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      buf[i] = Math.round(R / n)
      buf[i + 1] = Math.round(G / n)
      buf[i + 2] = Math.round(B / n)
      buf[i + 3] = Math.round(A / n)
    }
  }
  return buf
}

fs.writeFileSync('tomato.png', png(256, 256, draw(256)))
fs.writeFileSync('tomato-32.png', png(32, 32, draw(32)))
fs.writeFileSync('tomato.ico', ico([[32, png(32, 32, draw(32))], [256, png(256, 256, draw(256))]]))
console.log('icons generated OK')
