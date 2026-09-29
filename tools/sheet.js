// Renders a contact sheet PNG of every character sprite (base + overlays).
// Usage: node tools/sheet.js [outfile]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const CRC_TABLE = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function parseColor(s) {
  s = String(s);
  if (s.charCodeAt(0) === 35) {
    const hex = s.slice(1);
    if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), 1];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map(function (v) { return parseFloat(v); });
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return [255, 0, 255, 1];
}

function makeCanvas() {
  const c = { _w: 0, _h: 0, _d: new Uint8ClampedArray(0), _ctx: null };
  Object.defineProperty(c, 'width', {
    get: function () { return c._w; },
    set: function (v) { c._w = v | 0; c._d = new Uint8ClampedArray(Math.max(0, c._w * c._h * 4)); }
  });
  Object.defineProperty(c, 'height', {
    get: function () { return c._h; },
    set: function (v) { c._h = v | 0; c._d = new Uint8ClampedArray(Math.max(0, c._w * c._h * 4)); }
  });
  c.getContext = function () {
    if (c._ctx) return c._ctx;
    const ctx = {
      canvas: c, fillStyle: '#000000', imageSmoothingEnabled: false, globalAlpha: 1,
      fillRect: function (x, y, w, h) {
        const col = parseColor(this.fillStyle), a0 = col[3] * this.globalAlpha;
        const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
        for (let py = y0; py < y1; py++) {
          if (py < 0 || py >= c._h) continue;
          for (let px = x0; px < x1; px++) {
            if (px < 0 || px >= c._w) continue;
            const i = (py * c._w + px) * 4;
            const da = c._d[i + 3] / 255, sa = a0;
            const oa = sa + da * (1 - sa);
            if (oa <= 0) { c._d[i] = c._d[i + 1] = c._d[i + 2] = c._d[i + 3] = 0; continue; }
            for (let k = 0; k < 3; k++) c._d[i + k] = (col[k] * sa + c._d[i + k] * da * (1 - sa)) / oa;
            c._d[i + 3] = oa * 255;
          }
        }
      },
      drawImage: function (img) {
        const a = Array.prototype.slice.call(arguments, 1);
        let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
        if (a.length === 2) { dx = a[0]; dy = a[1]; dw = sw; dh = sh; }
        else if (a.length === 4) { dx = a[0]; dy = a[1]; dw = a[2]; dh = a[3]; }
        else if (a.length === 8) { sx = a[0]; sy = a[1]; sw = a[2]; sh = a[3]; dx = a[4]; dy = a[5]; dw = a[6]; dh = a[7]; }
        else return;
        for (let y = 0; y < dh; y++) {
          const ty = Math.round(dy + y);
          if (ty < 0 || ty >= c._h) continue;
          const jy = Math.min(sh - 1, Math.floor(sy + y * sh / dh));
          for (let x = 0; x < dw; x++) {
            const tx = Math.round(dx + x);
            if (tx < 0 || tx >= c._w) continue;
            const jx = Math.min(sw - 1, Math.floor(sx + x * sw / dw));
            const si = (jy * img.width + jx) * 4;
            const sa = img._d[si + 3] / 255;
            if (sa <= 0) continue;
            const di = (ty * c._w + tx) * 4, da = c._d[di + 3] / 255;
            const oa = sa + da * (1 - sa);
            for (let k = 0; k < 3; k++) c._d[di + k] = (img._d[si + k] * sa + c._d[di + k] * da * (1 - sa)) / oa;
            c._d[di + 3] = oa * 255;
          }
        }
      },
      clearRect: function (x, y, w, h) {
        const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
        for (let py = y0; py < y1; py++) {
          if (py < 0 || py >= c._h) continue;
          for (let px = x0; px < x1; px++) {
            if (px < 0 || px >= c._w) continue;
            c._d[(py * c._w + px) * 4 + 3] = 0;
          }
        }
      },
      save: function () {}, restore: function () {},
      translate: function () {}, scale: function () {}, rotate: function () {}, setTransform: function () {}
    };
    c._ctx = ctx;
    return ctx;
  };
  return c;
}

global.document = {
  createElement: function (t) {
    if (t !== 'canvas') throw new Error('unsupported element ' + t);
    return makeCanvas();
  }
};

const ROOT = path.join(__dirname, '..');
for (const f of ['art-data.js', 'data.js', 'sprites.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), { filename: f });
}
buildAllSprites();

function validate() {
  const issues = [];
  const baseChars = new Set();
  for (const dir of ['down', 'up', 'side']) {
    ART.player[dir].forEach(function (frame, fi) {
      if (frame.length !== ART.player.h) issues.push(dir + fi + ' height=' + frame.length);
      frame.forEach(function (row, ri) {
        if (row.length !== ART.player.w) issues.push(dir + fi + ' row ' + ri + ' len=' + row.length);
        for (const ch of row) if (ch !== '.') baseChars.add(ch);
      });
    });
  }
  const overChars = new Set();
  if (ART.overlays) {
    for (const name in ART.overlays) {
      for (const dir in ART.overlays[name]) {
        ART.overlays[name][dir].forEach(function (row, ri) {
          if (row.length !== ART.player.w) issues.push('overlay ' + name + '/' + dir + ' row ' + ri + ' len=' + row.length);
          if (row.length > 17) issues.push('overlay ' + name + '/' + dir + ' row ' + ri + ' too tall');
          for (const ch of row) if (ch !== '.') overChars.add(ch);
        });
      }
    }
  }
  const used = new Set([...baseChars, ...overChars]);
  const unused = [];
  for (const name in ART.palettes) {
    for (const ch of used) if (!ART.palettes[name][ch]) issues.push('palette ' + name + ' missing key "' + ch + '"');
    for (const ch in ART.palettes[name]) if (!used.has(ch)) unused.push(name + ':' + ch);
  }
  if (unused.length) console.log('note: unused palette keys -> ' + unused.join(' '));
  return issues;
}

const issues = validate();
console.log(issues.length ? 'ISSUES:\n  ' + issues.join('\n  ') : 'art ok: rows 16 wide, palettes cover all keys');

const S = 6;
const CELL_W = ART.player.w * S, CELL_H = ART.player.h * S;
const LABEL_W = 66, PAD = 6, HEAD = 26, LBL = 14;
const DIRS = ['down', 'up', 'side'];
const names = Object.keys(ART.palettes);
const cols = DIRS.length * 3;
const W = LABEL_W + cols * (CELL_W + PAD) + PAD;
const rows = names.length + 1;
const H = HEAD + rows * (CELL_H + LBL + PAD) + PAD;

const sheet = makeCanvas();
sheet.width = W; sheet.height = H;
const g = sheet.getContext('2d');

for (let y = 0; y < H; y += 8) {
  for (let x = 0; x < W; x += 8) {
    g.fillStyle = ((x / 8 + y / 8) & 1) ? '#3b4a52' : '#465862';
    g.fillRect(x, y, 8, 8);
  }
}
g.fillStyle = '#12181c';
g.fillRect(0, 0, W, HEAD);
PixelFont.draw(g, 'SUNVALE CHARACTERS', PAD, 8, '#f7e07a', 1);

let col = 0;
for (const dir of DIRS) {
  for (let f = 0; f < 3; f++) {
    const x = LABEL_DIR_X(col);
    PixelFont.draw(g, dir.toUpperCase() + ' ' + f, x, HEAD - 12, '#9fb6c4', 1);
    col++;
  }
}
function LABEL_DIR_X(i) { return LABEL_W + i * (CELL_W + PAD) + 2; }

names.forEach(function (name, r) {
  const y0 = HEAD + r * (CELL_H + LBL + PAD);
  PixelFont.draw(g, name.toUpperCase(), PAD, y0 + CELL_H / 2, '#ffffff', 1);
  col = 0;
  for (const dir of DIRS) {
    for (let f = 0; f < 3; f++) {
      const sp = Sprites.player[name][dir][f];
      g.drawImage(sp, LABEL_DIR_X(col), y0, CELL_W, CELL_H);
      col++;
    }
  }
});

const cy = HEAD + names.length * (CELL_H + LBL + PAD);
g.fillStyle = '#12181c';
g.fillRect(0, cy, W, H - cy);
PixelFont.draw(g, 'CHICKEN', PAD, cy + CELL_H / 2, '#ffffff', 1);
Sprites.chicken.forEach(function (sp, i) {
  g.drawImage(sp, LABEL_DIR_X(i), cy, CELL_W, CELL_H);
});

const out = process.argv[2] || path.join(ROOT, 'shots', 'chars.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePNG(sheet.width, sheet.height, sheet._d));
console.log('wrote ' + out + ' (' + sheet.width + 'x' + sheet.height + ')');
