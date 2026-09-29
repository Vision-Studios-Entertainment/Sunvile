/* SPRITES — all art is generated at runtime onto offscreen canvases.
   Nothing here loads image files; shapes are drawn with fillRect primitives
   (px) and ellipse helpers, so editing a colour or a coordinate is enough.

   Layout
     FONT / PixelFont   5x7 bitmap font: glyph cache, measure(), draw(), shadow()
     mk/px/rngf/...     low-level helpers (mk = create canvas, rngf = seeded RNG)
     Sprites            the atlas the renderer reads — fill it in via build*
     buildTiles/...     one builder per category: tiles, characters, crops,
                        items, props, buildings, UI
     buildAllSprites()  called ONCE from boot() in main.js; call it again if
                        you change palettes at runtime

   Contracts
     * Sprites.* shapes are plain canvases — drawImage() them, never mutate.
     * The seeded rngf(seed) calls are what make generated art deterministic
       across reloads; changing a seed reshuffles that whole sprite.
     * PixelFont upper-cases everything: lowercase never reaches the glyphs. */

const FONT = {
  'A': '01110/10001/10001/11111/10001/10001/10001',
  'B': '11110/10001/10001/11110/10001/10001/11110',
  'C': '01111/10000/10000/10000/10000/10000/01111',
  'D': '11110/10001/10001/10001/10001/10001/11110',
  'E': '11111/10000/10000/11110/10000/10000/11111',
  'F': '11111/10000/10000/11110/10000/10000/10000',
  'G': '01111/10000/10000/10111/10001/10001/01111',
  'H': '10001/10001/10001/11111/10001/10001/10001',
  'I': '11111/00100/00100/00100/00100/00100/11111',
  'J': '00111/00010/00010/00010/00010/10010/01100',
  'K': '10001/10010/10100/11000/10100/10010/10001',
  'L': '10000/10000/10000/10000/10000/10000/11111',
  'M': '10001/11011/10101/10101/10001/10001/10001',
  'N': '10001/11001/10101/10011/10001/10001/10001',
  'O': '01110/10001/10001/10001/10001/10001/01110',
  'P': '11110/10001/10001/11110/10000/10000/10000',
  'Q': '01110/10001/10001/10001/10101/10010/01101',
  'R': '11110/10001/10001/11110/10100/10010/10001',
  'S': '01111/10000/10000/01110/00001/00001/11110',
  'T': '11111/00100/00100/00100/00100/00100/00100',
  'U': '10001/10001/10001/10001/10001/10001/01110',
  'V': '10001/10001/10001/10001/10001/01010/00100',
  'W': '10001/10001/10001/10101/10101/11011/10001',
  'X': '10001/10001/01010/00100/01010/10001/10001',
  'Y': '10001/10001/01010/00100/00100/00100/00100',
  'Z': '11111/00001/00010/00100/01000/10000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11111/00010/00100/00010/00001/10001/01110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/11110/00001/00001/10001/01110',
  '6': '00110/01000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00010/01100',
  ' ': '00000/00000/00000/00000/00000/00000/00000',
  '.': '00000/00000/00000/00000/00000/00110/00110',
  ',': '00000/00000/00000/00000/00110/00100/01000',
  ':': '00000/00110/00110/00000/00110/00110/00000',
  ';': '00000/00110/00110/00000/00110/00100/01000',
  '!': '00100/00100/00100/00100/00100/00000/00100',
  '?': '01110/10001/00001/00010/00100/00000/00100',
  "'": '00100/00100/00000/00000/00000/00000/00000',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '/': '00001/00010/00100/01000/10000/00000/00000',
  '(': '00010/00100/01000/01000/01000/00100/00010',
  ')': '01000/00100/00010/00010/00010/00100/01000',
  '"': '01010/01010/00000/00000/00000/00000/00000',
  '$': '00100/01111/10100/01110/00101/11110/00100',
  '%': '11001/11010/00010/00100/01000/01011/10011',
  '&': '01100/10010/10100/01000/10101/10010/01101',
  '=': '00000/00000/11111/00000/11111/00000/00000',
  '<': '00010/00100/01000/10000/01000/00100/00010',
  '>': '01000/00100/00010/00001/00010/00100/01000',
  '#': '01010/11111/01010/01010/01010/11111/01010',
  '*': '00000/10101/01110/11111/01110/10101/00000',
  '_': '00000/00000/00000/00000/00000/00000/11111',
  '[': '01110/01000/01000/01000/01000/01000/01110',
  ']': '01110/00010/00010/00010/00010/00010/01110',
  '{': '00110/00100/00100/01000/00100/00100/00110',
  '}': '01100/00100/00100/00010/00100/00100/01100',
  '|': '00100/00100/00100/00100/00100/00100/00100',
  '@': '01110/10001/10111/10101/10111/10000/01110',
  '^': '00100/01010/10001/00000/00000/00000/00000',
  '~': '00000/00000/01000/10101/00010/00000/00000'
};

// ---- bitmap font (5x7, upper-case only) ---------------------------

const PixelFont = {
  cache: {},
  glyph: function (ch, color) {
    const key = color + '|' + ch;
    if (this.cache[key]) return this.cache[key];
    const c = mk(5, 7), g = c.getContext('2d');
    const rows = FONT[ch] || FONT['?'];
    const parts = rows.split('/');
    for (let y = 0; y < parts.length; y++) {
      for (let x = 0; x < 5; x++) {
        if (parts[y][x] === '1') { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
      }
    }
    this.cache[key] = c;
    return c;
  },
  measure: function (str, scale) {
    scale = scale || 1;
    return str.length * 6 * scale - scale;
  },
  draw: function (ctx, str, x, y, color, scale, align) {
    scale = scale || 1;
    str = String(str).toUpperCase();
    if (align === 'center') x -= Math.floor(this.measure(str, scale) / 2);
    if (align === 'right') x -= this.measure(str, scale);
    x = Math.round(x); y = Math.round(y);
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch !== ' ') ctx.drawImage(this.glyph(ch, color), x + i * 6 * scale, y, 5 * scale, 7 * scale);
    }
    return x + this.measure(str, scale);
  },
  shadow: function (ctx, str, x, y, color, scale, align) {
    scale = scale || 1;
    this.draw(ctx, str, x + scale, y + scale, '#14100c', scale, align);
    this.draw(ctx, str, x, y, color, scale, align);
  }
};

// ---- primitive drawing helpers ------------------------------------

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

function px(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}

function rngf(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function fillEllipse(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function blob(ctx, cx, cy, rx, ry, fill, outline) {
  fillEllipse(ctx, cx, cy, rx + 1, ry + 1, outline);
  fillEllipse(ctx, cx, cy, rx, ry, fill);
}

// ---- the atlas + its builders -------------------------------------

const Sprites = {
  tiles: [], water: [], fence: {}, player: {}, chicken: [], crops: {},
  items: {}, props: {}, builds: {}, ui: {}, shadow: null
};

// ---- terrain tiles (one canvas per T.* id) ------------------------

function buildTiles() {
  function grass(v) {
    const c = mk(16, 16), g = c.getContext('2d'), r = rngf(7700 + v * 131);
    px(g, 0, 0, 16, 16, '#4f9c3f');
    for (let i = 0; i < 80; i++) {
      g.fillStyle = r() < 0.5 ? '#478f39' : '#57a846';
      g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1);
    }
    for (let i = 0; i < 6; i++) {
      const x = (r() * 14) | 0, y = (r() * 13) | 0;
      px(g, x, y + 1, 1, 2, '#3d8233');
      px(g, x + 1, y, 1, 1, '#63b553');
    }
    return c;
  }
  Sprites.tiles[T.GRASS] = [grass(0), grass(1), grass(2)];
  Sprites.tiles[T.GRASS2] = [grass(3), grass(4), grass(5)];

  const flowerCols = ['#e86a8a', '#f0d24a', '#f4f2ea', '#b98fe0', '#ef8c2f'];
  Sprites.tiles[T.WILDFLOWER] = Sprites.tiles[T.GRASS].map(function (base, i) {
    const c = mk(16, 16), g = c.getContext('2d'), r = rngf(310 + i * 97);
    g.drawImage(base, 0, 0);
    for (let k = 0; k < 3; k++) {
      const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0);
      const col = flowerCols[(r() * flowerCols.length) | 0];
      px(g, x, y - 1, 1, 1, col); px(g, x - 1, y, 3, 1, col);
      px(g, x, y + 1, 1, 1, col); px(g, x, y, 1, 1, '#f7e07a');
    }
    return c;
  });

  const path = mk(16, 16), pg = path.getContext('2d'), pr = rngf(4242);
  px(pg, 0, 0, 16, 16, '#c9a86f');
  for (let i = 0; i < 90; i++) {
    pg.fillStyle = pr() < 0.55 ? '#bb9a63' : '#d6b67e';
    pg.fillRect((pr() * 16) | 0, (pr() * 16) | 0, 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    const x = (pr() * 13) | 0, y = (pr() * 13) | 0;
    px(pg, x, y, 2, 2, '#a8875a');
    px(pg, x, y, 1, 1, '#e0c68f');
  }
  Sprites.tiles[T.PATH] = [path];

  const sand = mk(16, 16), sg = sand.getContext('2d'), sr = rngf(881);
  px(sg, 0, 0, 16, 16, '#e0cf9a');
  for (let i = 0; i < 70; i++) {
    sg.fillStyle = sr() < 0.5 ? '#d3bd85' : '#eddfb2';
    sg.fillRect((sr() * 16) | 0, (sr() * 16) | 0, 1, 1);
  }
  Sprites.tiles[T.SAND] = [sand];

  for (let f = 0; f < 4; f++) {
    const c = mk(16, 16), g = c.getContext('2d');
    px(g, 0, 0, 16, 16, '#2f6fb8');
    px(g, 0, 0, 16, 4, '#3a80cc');
    px(g, 0, 13, 16, 3, '#2a5f9e');
    for (let i = 0; i < 4; i++) {
      const y = 3 + i * 3;
      const off = ((f * 3 + i * 5) % 16);
      for (let x = -2; x < 18; x += 6) {
        const xx = ((x + off) % 16 + 16) % 16;
        px(g, xx, y, 3, 1, '#59a3e0');
        px(g, (xx + 1) % 16, y + 1, 2, 1, '#3f8ad4');
      }
    }
    Sprites.water.push(c);
  }
  Sprites.tiles[T.WATER] = Sprites.water;

  function soil(wet) {
    const c = mk(16, 16), g = c.getContext('2d'), r = rngf(wet ? 5150 : 6160);
    const base = wet ? '#4b331f' : '#6d4c31', dark = wet ? '#3a2718' : '#573b26', lite = wet ? '#5c4029' : '#7d5a3b';
    px(g, 0, 0, 16, 16, base);
    for (let i = 0; i < 55; i++) {
      g.fillStyle = r() < 0.5 ? dark : lite;
      g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1);
    }
    for (let y = 3; y < 16; y += 4) {
      px(g, 0, y, 16, 1, dark);
      px(g, 0, y + 1, 16, 1, lite);
      for (let i = 0; i < 4; i++) px(g, (r() * 15) | 0, y, 1, 1, base);
    }
    return c;
  }
  Sprites.tiles[T.SOIL] = [soil(false)];
  Sprites.tiles[T.SOIL_WET] = [soil(true)];

  const floor = mk(16, 16), fg = floor.getContext('2d'), fr = rngf(9090);
  px(fg, 0, 0, 16, 16, '#bb8b5c');
  for (let i = 0; i < 60; i++) {
    fg.fillStyle = fr() < 0.5 ? '#b08050' : '#c79769';
    fg.fillRect((fr() * 16) | 0, (fr() * 16) | 0, 1, 1);
  }
  for (let y = 3; y < 16; y += 4) px(fg, 0, y, 16, 1, '#8f6438');
  px(fg, 0, 0, 16, 1, '#c99a66');
  for (let i = 0; i < 6; i++) { const x = (fr() * 15) | 0, y = ((fr() * 4) | 0) * 4 + 1; px(fg, x, y, 1, 1, '#7a5535'); }
  Sprites.tiles[T.FLOOR] = [floor];

  const wall = mk(16, 16), wg = wall.getContext('2d');
  px(wg, 0, 0, 16, 16, '#cdb28e');
  for (let x = 3; x < 16; x += 5) px(wg, x, 0, 1, 12, '#b89a74');
  px(wg, 0, 12, 16, 4, '#8a6a4a');
  px(wg, 0, 12, 16, 1, '#6f5338');
  px(wg, 0, 15, 16, 1, '#5f462c');
  Sprites.tiles[T.WALL] = [wall];

  const rug = mk(16, 16), rg = rug.getContext('2d');
  px(rg, 0, 0, 16, 16, '#b5483f');
  px(rg, 0, 0, 16, 2, '#e0c060');
  px(rg, 0, 14, 16, 2, '#e0c060');
  px(rg, 0, 0, 2, 16, '#e0c060');
  px(rg, 14, 0, 2, 16, '#e0c060');
  px(rg, 4, 4, 8, 8, '#c95f4f');
  px(rg, 7, 7, 2, 2, '#e0c060');
  px(rg, 3, 7, 1, 2, '#8f3630'); px(rg, 12, 7, 1, 2, '#8f3630');
  Sprites.tiles[T.RUG] = [rug];

  const stone = mk(16, 16), stg = stone.getContext('2d'), str = rngf(2222);
  px(stg, 0, 0, 16, 16, '#a8a49c');
  for (let i = 0; i < 80; i++) {
    stg.fillStyle = str() < 0.5 ? '#9d988f' : '#b4b0a7';
    stg.fillRect((str() * 16) | 0, (str() * 16) | 0, 1, 1);
  }
  for (let y = 0; y < 16; y += 5) px(stg, 0, y, 16, 1, '#8e8a82');
  for (let x = 4; x < 16; x += 6) px(stg, x, 0, 1, 16, '#8e8a82');
  Sprites.tiles[T.STONE] = [stone];

  const deck = mk(16, 16), dg = deck.getContext('2d'), dr = rngf(515);
  px(dg, 0, 0, 16, 16, '#c99a66');
  for (let i = 0; i < 50; i++) {
    dg.fillStyle = dr() < 0.5 ? '#bd8d5b' : '#d5a975';
    dg.fillRect((dr() * 16) | 0, (dr() * 16) | 0, 1, 1);
  }
  for (let y = 5; y < 16; y += 6) px(dg, 0, y, 16, 1, '#9c7346');
  Sprites.tiles[T.DECK] = [deck];

  const bridge = mk(16, 16), bg = bridge.getContext('2d'), br = rngf(616);
  px(bg, 0, 0, 16, 16, '#b98a5a');
  for (let y = 0; y < 16; y += 4) {
    px(bg, 0, y, 16, 1, '#7a5535');
    for (let i = 0; i < 6; i++) { bg.fillStyle = br() < 0.5 ? '#ab7c4e' : '#c79a68'; bg.fillRect((br() * 16) | 0, y + 1, 1, 3); }
  }
  Sprites.tiles[T.BRIDGE] = [bridge];

  const hard = mk(16, 16), hg = hard.getContext('2d');
  px(hg, 0, 0, 16, 16, '#9c6f45');
  for (let y = 0; y < 16; y += 4) px(hg, 0, y, 16, 1, '#7a5535');
  for (let x = 7; x < 16; x += 8) px(hg, x, 0, 1, 16, '#8a6140');
  Sprites.tiles[T.HARDWOOD] = [hard];

  const fenceBase = mk(16, 16);
  fenceBase.getContext('2d').drawImage(Sprites.tiles[T.GRASS][0], 0, 0);
  Sprites.tiles[T.FENCE] = [fenceBase];

  const nf = [];
  for (let h = 0; h < 2; h++) for (let v = 0; v < 2; v++) {
    const c = mk(16, 16), g = c.getContext('2d');
    g.drawImage(Sprites.tiles[T.GRASS][1], 0, 0);
    if (h) {
      px(g, 0, 6, 16, 2, '#a97c4f');
      px(g, 0, 11, 16, 2, '#a97c4f');
      px(g, 0, 6, 16, 1, '#c99a66');
      px(g, 0, 11, 16, 1, '#c99a66');
      px(g, 0, 8, 16, 1, '#7a5535');
      px(g, 0, 13, 16, 1, '#7a5535');
    }
    if (v) {
      px(g, 6, 0, 2, 16, '#a97c4f');
      px(g, 11, 0, 2, 16, '#a97c4f');
      px(g, 6, 0, 1, 16, '#c99a66');
      px(g, 11, 0, 1, 16, '#c99a66');
      px(g, 8, 0, 1, 16, '#7a5535');
      px(g, 13, 0, 1, 16, '#7a5535');
    }
    px(g, 6, 2, 4, 13, '#a97c4f');
    px(g, 6, 2, 1, 13, '#c99a66');
    px(g, 9, 2, 1, 13, '#7a5535');
    px(g, 6, 2, 4, 1, '#c99a66');
    px(g, 6, 14, 4, 1, '#5f3f24');
    nf.push(c);
  }
  Sprites.fence = { '00': nf[0], '10': nf[1], '01': nf[2], '11': nf[3] };
}

// ---- player / villager palettes ----------------------------------

function buildCharacters() {
  for (const name in ART.palettes) {
    const pal = ART.palettes[name];
    const out = { down: [], up: [], side: [] };
    for (const dir in out) {
      for (const rows of ART.player[dir]) {
        const c = mk(ART.player.w, ART.player.h), g = c.getContext('2d');
        for (let y = 0; y < rows.length; y++) {
          for (let x = 0; x < rows[y].length; x++) {
            const ch = rows[y][x];
            if (ch === '.') continue;
            g.fillStyle = pal[ch] || '#f0f';
            g.fillRect(x, y, 1, 1);
          }
        }
        out[dir].push(c);
      }
    }
    Sprites.player[name] = out;
  }

  for (let f = 0; f < 3; f++) {
    const c = mk(16, 14), g = c.getContext('2d');
    const lift = f === 1 ? 1 : f === 2 ? -1 : 0;
    fillEllipse(g, 7, 12, 5, 2, 'rgba(20,16,12,0.25)');
    px(g, 5, 11, 1, 3 - (f === 1 ? 1 : 0), '#e08a3c');
    px(g, 9, 11, 1, 3 - (f === 2 ? 1 : 0), '#e08a3c');
    px(g, 4, 13, 3, 1, '#e08a3c');
    px(g, 8, 13, 3, 1, '#e08a3c');
    blob(g, 8, 7 + (f === 0 ? 0 : -0), 5, 4, '#f5f2e8', '#241611');
    fillEllipse(g, 9, 7, 3, 2, '#ded7c4');
    px(g, 6, 6, 4, 1, '#cfc7b2');
    px(g, 12, 4, 3, 1, '#f5f2e8'); px(g, 13, 3, 2, 1, '#f5f2e8');
    px(g, 12, 5, 3, 1, '#ded7c4');
    px(g, 12, 3, 1, 1, '#241611'); px(g, 14, 3, 1, 1, '#241611');
    blob(g, 4, 4 + lift * 0, 3, 3, '#f5f2e8', '#241611');
    px(g, 3, 0, 3, 2, '#d94f3d'); px(g, 4, 0, 1, 1, '#f0705f');
    px(g, 1, 4, 3, 1, '#f0a93a'); px(g, 1, 5, 2, 1, '#c9842a');
    px(g, 4, 4, 1, 1, '#241611');
    px(g, 3, 7, 2, 1, '#e8d9a8');
    Sprites.chicken.push(c);
  }

  Sprites.shadow = mk(16, 8);
  const sg = Sprites.shadow.getContext('2d');
  fillEllipse(sg, 8, 4, 7, 3, 'rgba(20,16,12,0.28)');
}

// ---- crop growth stages ------------------------------------------

function buildCrops() {
  for (const id in CROPS) {
    const cr = CROPS[id];
    const stages = [];
    for (let s = 0; s < 5; s++) {
      const c = mk(16, 16), g = c.getContext('2d');
      drawCrop(g, cr, s);
      stages.push(c);
    }
    Sprites.crops[id] = stages;
  }
}

function drawCrop(g, cr, s) {
  const leaf = cr.leaf, leaf2 = cr.leaf2;
  const cx = 8;
  if (s === 0) {
    px(g, cx - 1, 11, 1, 2, leaf2);
    px(g, cx - 3, 10, 2, 1, leaf); px(g, cx - 3, 9, 1, 1, leaf);
    px(g, cx + 1, 10, 2, 1, leaf); px(g, cx + 2, 9, 1, 1, leaf);
    return;
  }
  if (s === 1) {
    px(g, cx, 8, 1, 5, leaf2);
    px(g, cx - 4, 8, 4, 1, leaf); px(g, cx - 4, 7, 2, 1, leaf);
    px(g, cx + 1, 8, 4, 1, leaf); px(g, cx + 3, 7, 2, 1, leaf);
    px(g, cx - 3, 11, 3, 1, leaf); px(g, cx + 1, 11, 3, 1, leaf);
    return;
  }
  if (s === 2) {
    px(g, cx, 5, 1, 8, leaf2);
    px(g, cx - 5, 6, 5, 1, leaf); px(g, cx - 5, 5, 3, 1, leaf);
    px(g, cx + 1, 6, 5, 1, leaf); px(g, cx + 3, 5, 3, 1, leaf);
    px(g, cx - 5, 9, 4, 1, leaf2); px(g, cx + 1, 9, 4, 1, leaf2);
    px(g, cx - 4, 12, 4, 1, leaf); px(g, cx + 1, 12, 4, 1, leaf);
    if (cr.form !== 'big') { px(g, cx - 2, 8, 1, 1, cr.fruit2); px(g, cx + 2, 8, 1, 1, cr.fruit2); }
    return;
  }
  if (s === 3) {
    px(g, cx, 4, 1, 9, leaf2);
    blob(g, cx - 3, 8, 4, 3, leaf, leaf2);
    blob(g, cx + 3, 8, 4, 3, leaf, leaf2);
    blob(g, cx, 6, 4, 3, leaf, leaf2);
    px(g, cx - 6, 11, 5, 2, leaf2); px(g, cx + 1, 11, 5, 2, leaf2);
    px(g, cx - 4, 5, 3, 1, '#'+ '7fd06f');
    if (cr.form === 'big') fillEllipse(g, cx, 12, 3, 2.4, cr.fruit2);
    else { px(g, cx - 3, 9, 2, 2, cr.fruit2); px(g, cx + 2, 10, 2, 2, cr.fruit2); }
    return;
  }
  px(g, cx, 3, 1, 8, leaf2);
  blob(g, cx - 3, 7, 4, 3, leaf, leaf2);
  blob(g, cx + 3, 7, 4, 3, leaf, leaf2);
  blob(g, cx - 1, 5, 4, 3, leaf, leaf2);
  px(g, cx - 7, 10, 5, 2, leaf2); px(g, cx + 2, 10, 5, 2, leaf2);
  if (cr.form === 'bulb') {
    blob(g, cx, 13, 4, 3, cr.fruit, cr.fruit2);
    px(g, cx - 3, 11, 6, 1, cr.fruit2);
    px(g, cx - 1, 10, 2, 1, cr.fruit2);
  } else if (cr.form === 'root') {
    px(g, cx - 2, 12, 4, 2, cr.fruit);
    px(g, cx - 1, 14, 2, 1, cr.fruit2);
    px(g, cx - 2, 12, 4, 1, cr.fruit2);
    px(g, cx, 15, 1, 1, cr.fruit2);
  } else if (cr.form === 'lump') {
    blob(g, cx - 3, 13, 3, 2, cr.fruit, cr.fruit2);
    blob(g, cx + 3, 12, 3, 2, cr.fruit, cr.fruit2);
    px(g, cx - 4, 12, 2, 1, '#'+ 'e0c68f');
  } else if (cr.form === 'cluster') {
    px(g, cx - 4, 9, 2, 2, cr.fruit); px(g, cx + 2, 8, 2, 2, cr.fruit);
    px(g, cx - 1, 11, 2, 2, cr.fruit); px(g, cx + 4, 11, 2, 2, cr.fruit);
    px(g, cx - 4, 9, 1, 1, '#ff9a94'); px(g, cx - 1, 11, 1, 1, '#ff9a94');
    px(g, cx + 2, 8, 1, 1, '#ff9a94');
    px(g, cx, 7, 1, 1, '#f0d24a');
  } else if (cr.form === 'big') {
    blob(g, cx, 12, 5, 4, cr.fruit, cr.fruit2);
    px(g, cx - 3, 9, 1, 6, cr.fruit2); px(g, cx, 8, 1, 8, cr.fruit2);
    px(g, cx + 3, 9, 1, 6, cr.fruit2);
    px(g, cx - 4, 9, 3, 1, '#f0a54a');
    px(g, cx - 1, 7, 2, 2, leaf2);
  }
}

// ---- inventory item icons ----------------------------------------

function buildItems() {
  const I = Sprites.items;
  function tool(id, fn) { const c = mk(16, 16); fn(c.getContext('2d')); I[id] = c; }

  tool('hoe', function (g) {
    for (let i = 0; i < 9; i++) px(g, 11 - i, 3 + i, 2, 1, '#8a5a34');
    px(g, 10, 4, 1, 8, '#a97c4f');
    px(g, 2, 10, 5, 3, '#8a8f96');
    px(g, 2, 10, 5, 1, '#b0b6bd');
    px(g, 1, 11, 1, 4, '#8a8f96');
    px(g, 3, 13, 4, 1, '#5f646b');
    px(g, 6, 9, 3, 2, '#5f646b');
  });
  tool('can', function (g) {
    px(g, 3, 6, 8, 7, '#6f8fa8'); px(g, 3, 6, 8, 1, '#93b3cc');
    px(g, 3, 12, 8, 1, '#4d6b82');
    px(g, 10, 8, 4, 2, '#6f8fa8'); px(g, 13, 6, 2, 4, '#93b3cc');
    px(g, 4, 3, 6, 1, '#4d6b82'); px(g, 4, 3, 1, 3, '#6f8fa8'); px(g, 9, 3, 1, 3, '#6f8fa8');
    px(g, 5, 7, 5, 2, '#93b3cc');
    px(g, 4, 10, 6, 1, '#4d6b82');
  });
  tool('axe', function (g) {
    for (let i = 0; i < 10; i++) px(g, 12 - i, 4 + i, 2, 1, '#8a5a34');
    px(g, 11, 5, 1, 8, '#a97c4f');
    px(g, 4, 3, 6, 4, '#b0b6bd');
    px(g, 3, 4, 2, 5, '#8a8f96');
    px(g, 4, 3, 6, 1, '#d5dbe2');
    px(g, 4, 6, 5, 1, '#5f646b');
    px(g, 8, 2, 4, 2, '#8a8f96');
  });
  tool('pick', function (g) {
    for (let i = 0; i < 10; i++) px(g, 12 - i, 4 + i, 2, 1, '#8a5a34');
    px(g, 11, 5, 1, 8, '#a97c4f');
    px(g, 2, 5, 12, 2, '#8a8f96');
    px(g, 2, 5, 12, 1, '#b0b6bd');
    px(g, 1, 3, 2, 4, '#5f646b'); px(g, 13, 3, 2, 4, '#5f646b');
    px(g, 2, 4, 1, 2, '#8a8f96'); px(g, 13, 4, 1, 2, '#8a8f96');
    px(g, 7, 7, 2, 2, '#5f646b');
  });

  for (const cropId in CROPS) {
    const cr = CROPS[cropId];
    const sc = mk(16, 16), sg = sc.getContext('2d');
    drawCrop(sg, cr, 4);
    I[cropId] = sc;

    const sd = mk(16, 16), sdg = sd.getContext('2d');
    px(sdg, 3, 4, 10, 10, '#d9c08c');
    px(sdg, 3, 4, 10, 2, '#e8d5a8');
    px(sdg, 3, 12, 10, 2, '#b99a68');
    px(sdg, 3, 4, 1, 10, '#c9b078'); px(sdg, 12, 4, 1, 10, '#a88f5f');
    px(sdg, 3, 7, 10, 1, '#b99a68');
    px(sdg, 5, 9, 6, 2, cr.fruit);
    px(sdg, 6, 8, 2, 1, cr.leaf); px(sdg, 9, 8, 2, 1, cr.leaf);
    px(sdg, 6, 11, 4, 1, cr.fruit2);
    px(sdg, 6, 3, 4, 2, '#b99a68');
    I[cropId + '_seeds'] = sd;
  }

  const wood = mk(16, 16), wg = wood.getContext('2d');
  for (let i = 0; i < 3; i++) {
    const y = 5 + i * 4;
    px(wg, 2, y, 12, 3, '#8a5a34');
    px(wg, 2, y, 12, 1, '#a97c4f');
    px(wg, 2, y + 2, 12, 1, '#5f3f24');
    fillEllipse(wg, 13.5, y + 1.5, 2, 1.6, '#c99a66');
    px(wg, 13, y + 1, 1, 1, '#8a5a34');
  }
  I.wood = wood;

  const stone = mk(16, 16), stg = stone.getContext('2d');
  blob(stg, 7, 10, 5, 4, '#8a8f96', '#5f646b');
  blob(stg, 11, 7, 3, 3, '#9aa0a8', '#5f646b');
  px(stg, 5, 7, 4, 2, '#b0b6bd');
  px(stg, 9, 5, 2, 1, '#b0b6bd');
  I.stone = stone;

  const gem = mk(16, 16), gg = gem.getContext('2d');
  px(gg, 7, 3, 2, 1, '#e8b6ff');
  px(gg, 5, 4, 6, 2, '#c98fe0');
  px(gg, 3, 6, 10, 4, '#a86fc9');
  px(gg, 5, 10, 6, 3, '#8a4fae');
  px(gg, 7, 13, 2, 1, '#6f3a92');
  px(gg, 6, 6, 2, 3, '#e8b6ff');
  px(gg, 9, 7, 2, 2, '#d9a5ef');
  I.gem = gem;

  const berry = mk(16, 16), bg = berry.getContext('2d');
  px(bg, 7, 4, 2, 3, '#3f8a3f');
  px(bg, 5, 3, 3, 2, '#5fae44'); px(bg, 9, 3, 3, 2, '#5fae44');
  blob(bg, 6, 9, 3, 3, '#e0453f', '#8f2420');
  blob(bg, 10, 10, 3, 3, '#c93b36', '#8f2420');
  px(bg, 5, 8, 1, 1, '#ff9a94'); px(bg, 9, 9, 1, 1, '#ff9a94');
  I.berry = berry;

  const egg = mk(16, 16), eg = egg.getContext('2d');
  fillEllipse(eg, 8, 9, 4, 5, '#241611');
  fillEllipse(eg, 8, 9, 3, 4, '#f5efe0');
  fillEllipse(eg, 7, 8, 1.5, 2, '#fffdf5');
  px(eg, 6, 12, 4, 1, '#dcd3bd');
  I.egg = egg;

  function dishBase() {
    const c = mk(16, 16), g = c.getContext('2d');
    fillEllipse(g, 8, 13, 7, 3.6, '#241611');
    fillEllipse(g, 8, 12, 6.5, 3.1, '#e8e2d4');
    px(g, 3, 12, 10, 1, '#c9c2b0');
    px(g, 5, 14, 6, 1, '#b8b2a2');
    return { c: c, g: g };
  }

  const stewD = dishBase();
  fillEllipse(stewD.g, 8, 10, 5.4, 2.4, '#b5603a');
  fillEllipse(stewD.g, 8, 9.6, 4.6, 1.8, '#d97b52');
  px(stewD.g, 5, 9, 2, 1, '#5fae44');
  px(stewD.g, 9, 10, 2, 1, '#f0d24a');
  px(stewD.g, 7, 11, 2, 1, '#e0453f');
  px(stewD.g, 6, 4, 1, 3, '#b0b6bd');
  px(stewD.g, 9, 3, 1, 3, '#b0b6bd');
  px(stewD.g, 6, 3, 1, 1, '#d5dbe2');
  I.veg_stew = stewD.c;

  const omD = dishBase();
  blob(omD.g, 8, 10, 5.5, 3, '#f0d24a', '#c9a421');
  px(omD.g, 4, 9, 3, 1, '#f7e07a');
  px(omD.g, 6, 11, 2, 1, '#e8c452');
  px(omD.g, 7, 8, 1, 1, '#5fae44');
  px(omD.g, 10, 9, 1, 1, '#5fae44');
  px(omD.g, 8, 11, 1, 1, '#5fae44');
  px(omD.g, 3, 8, 2, 1, '#ffffff');
  I.omelette = omD.c;

  const pieC = mk(16, 16), pg2 = pieC.getContext('2d');
  fillEllipse(pg2, 8, 11, 7, 4.5, '#241611');
  fillEllipse(pg2, 8, 10, 6.5, 4, '#c98a3a');
  fillEllipse(pg2, 8, 9, 5.2, 3, '#b5485a');
  px(pg2, 5, 7, 6, 1, '#e0453f');
  px(pg2, 6, 6, 4, 1, '#c93b36');
  px(pg2, 4, 8, 8, 1, '#d9a34a');
  px(pg2, 5, 9, 1, 3, '#d9a34a');
  px(pg2, 8, 8, 1, 3, '#d9a34a');
  px(pg2, 11, 9, 1, 3, '#d9a34a');
  px(pg2, 4, 12, 8, 1, '#a87534');
  I.berry_pie = pieC;

  const soupD = dishBase();
  fillEllipse(soupD.g, 8, 10, 5.4, 2.4, '#d97b1f');
  fillEllipse(soupD.g, 8, 9.6, 4.6, 1.8, '#f0a54a');
  px(soupD.g, 6, 9, 4, 1, '#f7e07a');
  px(soupD.g, 8, 10, 3, 1, '#f7e07a');
  px(soupD.g, 5, 11, 2, 1, '#c96a1a');
  px(soupD.g, 6, 4, 1, 3, '#b0b6bd');
  px(soupD.g, 9, 3, 1, 3, '#b0b6bd');
  I.pumpkin_soup = soupD.c;

}

function makeSign(text, w) {
  const c = mk(w, 18), g = c.getContext('2d');
  px(g, 2, 14, 3, 4, '#7a5535'); px(g, w - 5, 14, 3, 4, '#7a5535');
  px(g, 1, 1, w - 2, 13, '#a97c4f');
  px(g, 1, 1, w - 2, 1, '#c99a66');
  px(g, 1, 12, w - 2, 2, '#7a5535');
  px(g, 1, 1, 1, 12, '#c99a66');
  px(g, w - 2, 1, 1, 12, '#5f3f24');
  PixelFont.draw(g, text, Math.floor(w / 2), 4, '#4a3421', 1, 'center');
  return c;
}

// ---- world props: trees, rocks, bushes, mailbox, signs -----------

function buildProps() {
  const P = Sprites.props;

  P.tree = [];
  for (let v = 0; v < 3; v++) {
    const c = mk(26, 34), g = c.getContext('2d'), r = rngf(100 + v * 37);
    fillEllipse(g, 13, 31, 8, 3, 'rgba(20,16,12,0.22)');
    px(g, 11, 20, 4, 11, '#7a5535');
    px(g, 11, 20, 1, 11, '#a97c4f');
    px(g, 14, 20, 1, 11, '#5f3f24');
    px(g, 8, 29, 3, 2, '#6b4a2e'); px(g, 15, 29, 4, 2, '#6b4a2e');
    px(g, 10, 22, 2, 1, '#5f3f24'); px(g, 13, 25, 2, 1, '#5f3f24');
    blob(g, 13, 14, 10, 8, '#276b30', '#1c4f23');
    blob(g, 9, 12, 7, 6, '#3a8f3e', '#1c4f23');
    blob(g, 17, 12, 6, 5, '#3a8f3e', '#1c4f23');
    blob(g, 13, 9, 7, 5, '#4fa64f', '#1c4f23');
    blob(g, 10, 8, 4, 3, '#57b85a', '#1c4f23');
    for (let i = 0; i < 16; i++) {
      const x = 5 + ((r() * 16) | 0), y = 5 + ((r() * 14) | 0);
      g.fillStyle = r() < 0.5 ? '#6fc26c' : '#2f7a34';
      g.fillRect(x, y, 1, 1);
    }
    P.tree.push(c);
  }

  P.pine = [];
  for (let v = 0; v < 3; v++) {
    const c = mk(24, 36), g = c.getContext('2d'), r = rngf(300 + v * 53);
    fillEllipse(g, 12, 33, 7, 3, 'rgba(20,16,12,0.22)');
    px(g, 10, 27, 4, 6, '#6b4a2e');
    px(g, 10, 27, 1, 6, '#8a5a34');
    for (let i = 0; i < 4; i++) {
      const y = 4 + i * 7, halfW = 4 + i * 3;
      for (let row = 0; row < 7; row++) {
        const w = Math.min(halfW, 2 + row + i);
        px(g, 12 - w, y + row, w * 2, 1, '#276b30');
      }
      px(g, 12 - halfW, y + 6, halfW * 2, 1, '#1c4f23');
      px(g, 12 - Math.floor(halfW / 2), y, Math.max(2, halfW), 1, '#3f9a44');
      px(g, 10, y + 2, 4, 1, '#57b85a');
    }
    for (let i = 0; i < 14; i++) {
      const x = 4 + ((r() * 16) | 0), y = 5 + ((r() * 24) | 0);
      g.fillStyle = r() < 0.5 ? '#57b85a' : '#1c4f23';
      g.fillRect(x, y, 1, 1);
    }
    P.pine.push(c);
  }

  P.rock = [];
  for (let v = 0; v < 3; v++) {
    const c = mk(18, 16), g = c.getContext('2d'), r = rngf(500 + v * 71);
    fillEllipse(g, 9, 13, 7, 3, 'rgba(20,16,12,0.22)');
    blob(g, 8, 9, 6, 5, '#8a8f96', '#4f545b');
    blob(g, 12, 8, 3.5, 3, '#9aa0a8', '#4f545b');
    px(g, 5, 6, 5, 2, '#b0b6bd');
    px(g, 11, 5, 2, 1, '#c4cad1');
    px(g, 4, 11, 3, 1, '#5f646b');
    for (let i = 0; i < 8; i++) {
      g.fillStyle = r() < 0.5 ? '#6f747b' : '#a8aeb6';
      g.fillRect(3 + ((r() * 12) | 0), 5 + ((r() * 7) | 0), 1, 1);
    }
    P.rock.push(c);
  }

  P.ore = [];
  for (let v = 0; v < 2; v++) {
    const c = mk(18, 16), g = c.getContext('2d');
    g.drawImage(P.rock[v % 3], 0, 0);
    for (const p of [[5, 8], [8, 6], [11, 9], [7, 11]]) {
      px(g, p[0], p[1], 2, 2, '#a86fc9');
      px(g, p[0], p[1], 1, 1, '#e8b6ff');
    }
    P.ore.push(c);
  }

  P.bush = [];
  P.bush_berry = [];
  for (let v = 0; v < 2; v++) {
    const c = mk(18, 14), g = c.getContext('2d');
    fillEllipse(g, 9, 12, 7, 2, 'rgba(20,16,12,0.2)');
    blob(g, 9, 8, 7, 4.5, '#3f8a3f', '#245c28');
    blob(g, 6, 6, 4, 3, '#54a854', '#245c28');
    blob(g, 12, 7, 3.5, 3, '#54a854', '#245c28');
    px(g, 7, 4, 3, 1, '#6fc26c');
    P.bush.push(c);
    const c2 = mk(18, 14), g2 = c2.getContext('2d');
    g2.drawImage(c, 0, 0);
    for (const p of [[5, 7], [9, 5], [12, 8], [7, 10], [11, 11], [3, 9]]) {
      fillEllipse(g2, p[0], p[1], 1.6, 1.6, '#e0453f');
      px(g2, p[0] - 1, p[1] - 1, 1, 1, '#ff9a94');
    }
    P.bush_berry.push(c2);
  }

  P.stump = [];
  const stump = mk(16, 12), smg = stump.getContext('2d');
  fillEllipse(smg, 8, 10, 6, 2, 'rgba(20,16,12,0.22)');
  px(smg, 4, 4, 8, 6, '#7a5535');
  px(smg, 4, 4, 8, 1, '#a97c4f');
  fillEllipse(smg, 8, 4, 4, 2, '#c99a66');
  fillEllipse(smg, 8, 4, 3, 1.4, '#a97c4f');
  px(smg, 7, 3, 2, 1, '#8a5a34');
  px(smg, 4, 9, 8, 1, '#5f3f24');
  P.stump.push(stump);

  P.sprout = [];
  const sprout = mk(12, 12), srg = sprout.getContext('2d');
  fillEllipse(srg, 6, 10, 4, 1.5, 'rgba(20,16,12,0.2)');
  px(srg, 5, 6, 2, 4, '#7a5535');
  blob(srg, 4, 5, 3, 2, '#3f9a44', '#1c4f23');
  blob(srg, 8, 5, 3, 2, '#3f9a44', '#1c4f23');
  blob(srg, 6, 3, 3, 2, '#57b85a', '#1c4f23');
  P.sprout.push(sprout);

  P.lamp = mk(16, 26);
  (function () {
    const g = P.lamp.getContext('2d');
    fillEllipse(g, 8, 24, 6, 2, 'rgba(20,16,12,0.22)');
    px(g, 7, 10, 2, 14, '#3a3a44');
    px(g, 7, 10, 1, 14, '#565663');
    px(g, 5, 23, 6, 2, '#2b2b34');
    px(g, 5, 1, 6, 2, '#2b2b34');
    px(g, 4, 3, 8, 8, '#2b2b34');
    px(g, 5, 4, 6, 6, '#f5d76e');
    px(g, 6, 5, 4, 4, '#fff3b8');
    px(g, 6, 11, 4, 1, '#2b2b34');
  })();

  P.mailbox = mk(20, 22);
  (function () {
    const g = P.mailbox.getContext('2d');
    fillEllipse(g, 10, 20, 7, 2, 'rgba(20,16,12,0.22)');
    px(g, 9, 12, 2, 8, '#8a5a34');
    px(g, 4, 3, 12, 10, '#4a7ec2');
    px(g, 4, 3, 12, 1, '#6f9fe0');
    px(g, 4, 12, 12, 1, '#35598f');
    px(g, 4, 4, 1, 9, '#6f9fe0');
    fillEllipse(g, 10, 4, 6, 3, '#4a7ec2');
    fillEllipse(g, 10, 4, 6, 2, '#6f9fe0');
    px(g, 6, 7, 8, 3, '#2b3f66');
    px(g, 15, 6, 1, 5, '#e8c452');
    px(g, 16, 6, 3, 1, '#e8c452');
    px(g, 16, 9, 3, 1, '#e8c452');
  })();

  P.barrel = mk(16, 20);
  (function () {
    const g = P.barrel.getContext('2d');
    fillEllipse(g, 8, 18, 6, 2, 'rgba(20,16,12,0.22)');
    px(g, 3, 5, 10, 13, '#8a5a34');
    px(g, 3, 5, 10, 1, '#a97c4f');
    fillEllipse(g, 8, 5, 5, 2, '#a97c4f');
    fillEllipse(g, 8, 5, 4, 1.4, '#c99a66');
    px(g, 3, 8, 10, 2, '#5f3f24');
    px(g, 3, 14, 10, 2, '#5f3f24');
    px(g, 3, 8, 1, 2, '#7a5535');
    px(g, 12, 8, 1, 2, '#4a3421');
    px(g, 5, 6, 2, 10, '#9c6a3e');
  })();

  P.crate = mk(16, 16);
  (function () {
    const g = P.crate.getContext('2d');
    fillEllipse(g, 8, 14, 7, 2, 'rgba(20,16,12,0.22)');
    px(g, 2, 2, 12, 12, '#b5854f');
    px(g, 2, 2, 12, 1, '#d0a06a');
    px(g, 2, 13, 12, 1, '#7a5535');
    px(g, 2, 2, 1, 12, '#d0a06a');
    px(g, 13, 2, 1, 12, '#7a5535');
    for (let i = 0; i < 10; i++) { px(g, 3 + i, 3 + i, 1, 1, '#96693f'); px(g, 12 - i, 3 + i, 1, 1, '#96693f'); }
    px(g, 4, 7, 8, 1, '#96693f');
  })();

  P.pot = mk(12, 14);
  (function () {
    const g = P.pot.getContext('2d');
    fillEllipse(g, 6, 12, 5, 2, 'rgba(20,16,12,0.2)');
    px(g, 3, 7, 6, 5, '#c9744a');
    px(g, 3, 7, 6, 1, '#e08f62');
    px(g, 2, 5, 8, 3, '#b5603a');
    px(g, 2, 5, 8, 1, '#d97b52');
    px(g, 5, 1, 2, 5, '#3f8a3f');
    blob(g, 4, 2, 3, 2, '#54a854', '#245c28');
    blob(g, 8, 3, 3, 2, '#54a854', '#245c28');
    blob(g, 6, 1, 3, 2, '#6fc26c', '#245c28');
  })();

  P.sign = makeSign('SUNVALE', 52);
  P.sign_small = makeSign('SHOP', 34);

  P.bed = mk(18, 30);
  (function () {
    const g = P.bed.getContext('2d');
    fillEllipse(g, 9, 28, 8, 2, 'rgba(20,16,12,0.2)');
    px(g, 1, 0, 16, 5, '#8a5a34');
    px(g, 1, 0, 16, 1, '#a97c4f');
    px(g, 2, 5, 14, 23, '#f2ede0');
    px(g, 2, 5, 14, 6, '#e8e0cc');
    px(g, 4, 6, 10, 4, '#ffffff');
    px(g, 2, 12, 14, 14, '#4a7ec2');
    px(g, 2, 12, 14, 1, '#6f9fe0');
    px(g, 2, 20, 14, 1, '#35598f');
    px(g, 6, 14, 6, 2, '#6f9fe0');
    px(g, 2, 26, 14, 2, '#8a5a34');
    px(g, 1, 4, 1, 24, '#7a5535');
    px(g, 16, 4, 1, 24, '#5f3f24');
  })();

  P.tv = mk(20, 16);
  (function () {
    const g = P.tv.getContext('2d');
    fillEllipse(g, 10, 15, 8, 2, 'rgba(20,16,12,0.2)');
    px(g, 1, 3, 18, 11, '#3a3a44');
    px(g, 1, 3, 18, 1, '#565663');
    px(g, 3, 5, 11, 7, '#1a2b38');
    px(g, 4, 6, 9, 5, '#3f7fa8');
    px(g, 5, 7, 3, 2, '#7fc4e8');
    px(g, 15, 6, 3, 3, '#1a1a20');
    px(g, 15, 10, 3, 2, '#1a1a20');
    px(g, 3, 14, 2, 2, '#2b2b34');
    px(g, 15, 14, 2, 2, '#2b2b34');
    px(g, 6, 0, 2, 4, '#8a8f96');
  })();

  P.table = mk(30, 22);
  (function () {
    const g = P.table.getContext('2d');
    fillEllipse(g, 15, 20, 13, 2, 'rgba(20,16,12,0.2)');
    px(g, 1, 3, 28, 9, '#a97c4f');
    px(g, 1, 3, 28, 1, '#c99a66');
    px(g, 1, 11, 28, 1, '#7a5535');
    for (let x = 4; x < 28; x += 7) px(g, x, 4, 1, 7, '#96693f');
    px(g, 3, 12, 3, 8, '#8a5a34');
    px(g, 24, 12, 3, 8, '#8a5a34');
    px(g, 3, 12, 1, 8, '#a97c4f');
    px(g, 24, 12, 1, 8, '#a97c4f');
  })();

  P.chair = mk(14, 20);
  (function () {
    const g = P.chair.getContext('2d');
    fillEllipse(g, 7, 18, 6, 2, 'rgba(20,16,12,0.2)');
    px(g, 3, 1, 8, 9, '#a97c4f');
    px(g, 3, 1, 8, 1, '#c99a66');
    px(g, 5, 3, 4, 5, '#7a5535');
    px(g, 2, 10, 10, 3, '#b5854f');
    px(g, 2, 10, 10, 1, '#d0a06a');
    px(g, 3, 13, 2, 5, '#8a5a34');
    px(g, 9, 13, 2, 5, '#8a5a34');
  })();

  P.chest = mk(18, 16);
  (function () {
    const g = P.chest.getContext('2d');
    fillEllipse(g, 9, 15, 8, 2, 'rgba(20,16,12,0.2)');
    px(g, 1, 4, 16, 11, '#8a5a34');
    fillEllipse(g, 9, 4, 8, 3, '#a97c4f');
    fillEllipse(g, 9, 4, 8, 2, '#c99a66');
    px(g, 1, 7, 16, 2, '#5f3f24');
    px(g, 1, 4, 1, 11, '#a97c4f');
    px(g, 16, 4, 1, 11, '#4a3421');
    px(g, 7, 7, 4, 5, '#e8c452');
    px(g, 8, 8, 2, 3, '#f7e07a');
    px(g, 3, 10, 3, 2, '#96693f');
    px(g, 13, 10, 2, 2, '#96693f');
  })();

  P.shelf = mk(36, 22);
  (function () {
    const g = P.shelf.getContext('2d');
    px(g, 0, 0, 36, 3, '#7a5535');
    px(g, 0, 9, 36, 3, '#7a5535');
    px(g, 0, 18, 36, 4, '#6b4a2e');
    px(g, 0, 0, 36, 1, '#a97c4f');
    px(g, 0, 9, 36, 1, '#a97c4f');
    const cols = ['#e0453f', '#f0d24a', '#5fae44', '#4a7ec2', '#b98fe0', '#ef8c2f'];
    for (let i = 0; i < 8; i++) {
      const x = 2 + i * 4.4, h = 4 + (i % 3);
      px(g, x, 9 - h, 3, h, cols[i % cols.length]);
      px(g, x, 9 - h, 3, 1, '#ffffff');
    }
    for (let i = 0; i < 6; i++) {
      const x = 3 + i * 5.5, h = 4 + ((i + 1) % 3);
      px(g, x, 18 - h, 4, h, cols[(i + 2) % cols.length]);
      px(g, x, 18 - h, 4, 1, '#f0f0f0');
    }
  })();

  P.counter = mk(20, 22);
  (function () {
    const g = P.counter.getContext('2d');
    fillEllipse(g, 10, 20, 9, 2, 'rgba(20,16,12,0.2)');
    px(g, 0, 4, 20, 16, '#a97c4f');
    px(g, 0, 4, 20, 2, '#c99a66');
    px(g, 0, 6, 20, 1, '#7a5535');
    px(g, 0, 18, 20, 2, '#7a5535');
    for (let x = 3; x < 20; x += 6) px(g, x, 7, 1, 11, '#96693f');
    px(g, 0, 3, 20, 1, '#e0c68f');
  })();

  P.register = mk(16, 14);
  (function () {
    const g = P.register.getContext('2d');
    px(g, 2, 4, 12, 9, '#6f8fa8');
    px(g, 2, 4, 12, 1, '#93b3cc');
    px(g, 4, 1, 8, 4, '#4d6b82');
    px(g, 5, 2, 6, 2, '#c9f0ff');
    px(g, 4, 7, 8, 2, '#2b3f4f');
    px(g, 4, 10, 2, 2, '#e8c452');
    px(g, 7, 10, 2, 2, '#e0453f');
    px(g, 10, 10, 2, 2, '#5fae44');
  })();

  P.fridge = mk(16, 26);
  (function () {
    const g = P.fridge.getContext('2d');
    fillEllipse(g, 8, 25, 7, 2, 'rgba(20,16,12,0.2)');
    px(g, 2, 2, 12, 23, '#e8e8e8');
    px(g, 2, 2, 12, 1, '#ffffff');
    px(g, 13, 3, 1, 22, '#b8b8b8');
    px(g, 2, 11, 12, 1, '#c9c9c9');
    px(g, 11, 5, 1, 5, '#8a8f96');
    px(g, 11, 14, 1, 6, '#8a8f96');
    px(g, 3, 17, 4, 4, '#e0453f');
    px(g, 8, 20, 4, 3, '#5fae44');
  })();

  P.stove = mk(18, 20);
  (function () {
    const g = P.stove.getContext('2d');
    fillEllipse(g, 9, 19, 8, 2, 'rgba(20,16,12,0.2)');
    px(g, 1, 4, 16, 15, '#6f8fa8');
    px(g, 1, 4, 16, 1, '#93b3cc');
    px(g, 3, 6, 5, 4, '#2b3f4f');
    px(g, 10, 6, 5, 4, '#2b3f4f');
    px(g, 4, 7, 3, 2, '#1a2b38');
    px(g, 11, 7, 3, 2, '#1a2b38');
    px(g, 3, 13, 12, 4, '#4d6b82');
    px(g, 3, 13, 12, 1, '#93b3cc');
    px(g, 8, 14, 1, 2, '#c9c9c9');
    px(g, 4, 2, 3, 2, '#3a3a44');
    px(g, 11, 2, 3, 2, '#3a3a44');
  })();

  P.trough = mk(24, 12);
  (function () {
    const g = P.trough.getContext('2d');
    fillEllipse(g, 12, 11, 11, 2, 'rgba(20,16,12,0.2)');
    px(g, 1, 3, 22, 8, '#8a5a34');
    px(g, 1, 3, 22, 1, '#a97c4f');
    px(g, 2, 5, 20, 4, '#2f6fb8');
    px(g, 3, 5, 8, 1, '#59a3e0');
    px(g, 14, 6, 6, 1, '#59a3e0');
    px(g, 1, 10, 22, 1, '#5f3f24');
    px(g, 5, 3, 1, 8, '#7a5535');
    px(g, 18, 3, 1, 8, '#7a5535');
  })();

  P.scarecrow = mk(18, 26);
  (function () {
    const g = P.scarecrow.getContext('2d');
    fillEllipse(g, 9, 24, 7, 2, 'rgba(20,16,12,0.2)');
    px(g, 8, 8, 2, 16, '#7a5535');
    px(g, 2, 11, 14, 2, '#7a5535');
    px(g, 3, 9, 4, 6, '#b5854f');
    px(g, 11, 9, 4, 6, '#b5854f');
    px(g, 5, 2, 8, 8, '#e0cf9a');
    px(g, 5, 2, 8, 1, '#efe0b5');
    px(g, 5, 7, 8, 1, '#c9b078');
    px(g, 6, 4, 2, 2, '#3a3a44');
    px(g, 10, 4, 2, 2, '#3a3a44');
    px(g, 7, 7, 4, 1, '#8a5a34');
    px(g, 3, 0, 12, 3, '#4a7ec2');
    px(g, 3, 0, 12, 1, '#6f9fe0');
    px(g, 6, 3, 6, 1, '#35598f');
    px(g, 5, 16, 8, 6, '#5fae44');
    px(g, 5, 16, 8, 1, '#7fd06f');
  })();

  P.fireplace = mk(22, 34);
  (function () {
    const g = P.fireplace.getContext('2d');
    fillEllipse(g, 11, 32, 9, 2.5, 'rgba(20,16,12,0.22)');
    px(g, 1, 6, 20, 26, '#8f8a82');
    for (let y = 8; y < 30; y += 5) px(g, 1, y, 20, 1, '#6f6a62');
    px(g, 0, 2, 22, 5, '#a8a49c');
    px(g, 0, 2, 22, 1, '#c4c0b8');
    px(g, 0, 6, 22, 1, '#6f6a62');
    px(g, 4, 11, 14, 21, '#3a3028');
    px(g, 4, 11, 14, 2, '#5f564a');
    fillEllipse(g, 11, 28, 6, 4, '#a83a1a');
    fillEllipse(g, 11, 27, 5, 3, '#e07b1f');
    fillEllipse(g, 11, 26, 3.4, 2.2, '#f7d76e');
    px(g, 10, 22, 2, 5, '#f7e07a');
    px(g, 7, 25, 2, 4, '#f0a54a');
    px(g, 14, 24, 2, 5, '#f0a54a');
    px(g, 5, 29, 12, 3, '#7a5535');
    px(g, 5, 29, 12, 1, '#a97c4f');
    px(g, 8, 30, 6, 1, '#5f3f24');
    px(g, 3, 0, 16, 3, '#6b4a2e');
    px(g, 3, 0, 16, 1, '#8a5a34');
    px(g, 4, 0, 3, 2, '#e8c452');
    px(g, 14, 0, 4, 2, '#5fae44');
  })();

  P.board = mk(28, 30);
  (function () {
    const g = P.board.getContext('2d');
    fillEllipse(g, 14, 28, 11, 2.5, 'rgba(20,16,12,0.22)');
    px(g, 4, 15, 4, 13, '#7a5535');
    px(g, 20, 15, 4, 13, '#7a5535');
    px(g, 4, 15, 1, 13, '#a97c4f');
    px(g, 20, 15, 1, 13, '#a97c4f');
    px(g, 1, 2, 26, 15, '#a97c4f');
    px(g, 1, 2, 26, 1, '#c99a66');
    px(g, 1, 15, 26, 2, '#7a5535');
    px(g, 3, 4, 22, 11, '#e8dcc0');
    px(g, 3, 4, 22, 1, '#f7efd0');
    px(g, 5, 6, 7, 7, '#f5f2e8');
    px(g, 5, 6, 7, 1, '#ffffff');
    px(g, 6, 8, 5, 1, '#9c8a70');
    px(g, 6, 10, 4, 1, '#9c8a70');
    px(g, 15, 6, 8, 6, '#f5efe0');
    px(g, 15, 6, 8, 1, '#ffffff');
    px(g, 16, 8, 6, 1, '#9c8a70');
    px(g, 16, 10, 5, 1, '#9c8a70');
    px(g, 8, 5, 2, 2, '#e0453f');
    px(g, 19, 5, 2, 2, '#f0d24a');
  })();

  P.plant = P.pot;
}

// ---- buildings: house, shop, coop --------------------------------

function buildBuildings() {
  const B = Sprites.builds;

  B.house = mk(168, 132);
  (function () {
    const g = B.house.getContext('2d'), r = rngf(4321);
    px(g, 4, 84, 160, 44, '#d9b489');
    for (let x = 8; x < 160; x += 10) px(g, x, 84, 1, 44, '#c29a70');
    px(g, 4, 84, 160, 2, '#c9a67e');
    px(g, 4, 124, 160, 4, '#a8825e');
    px(g, 4, 128, 160, 4, '#8a6a4a');
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.5 ? '#d0aa7e' : '#e2bd95';
      g.fillRect(6 + ((r() * 156) | 0), 86 + ((r() * 38) | 0), 1, 1);
    }
    px(g, 0, 34, 168, 52, '#a04534');
    for (let y = 34; y < 86; y += 8) px(g, 0, y, 168, 2, '#8a3a2c');
    for (let y = 38; y < 86; y += 8) {
      for (let x = ((y / 8) % 2) * 6; x < 168; x += 12) px(g, x, y, 1, 6, '#8a3a2c');
    }
    px(g, 0, 34, 168, 4, '#c25a45');
    px(g, 0, 30, 168, 5, '#d97b62');
    px(g, 0, 28, 168, 3, '#b8493a');
    px(g, 4, 82, 160, 4, '#7a3a30');
    px(g, 120, 6, 20, 30, '#8a8f96');
    px(g, 120, 6, 20, 3, '#b0b6bd');
    for (let y = 9; y < 34; y += 5) px(g, 120, y, 20, 1, '#5f646b');
    for (let y = 9; y < 34; y += 5) for (let x = ((y / 5) % 2) * 5; x < 20; x += 10) px(g, 120 + x, y, 1, 5, '#6f747b');
    px(g, 118, 4, 24, 4, '#6f747b');

    function windowAt(x, y, w, h) {
      px(g, x - 2, y - 2, w + 4, h + 4, '#f0ead8');
      px(g, x, y, w, h, '#7fb2d9');
      px(g, x, y, w, 2, '#a8d0ee');
      px(g, x, y + h - 2, w, 2, '#4f86b5');
      px(g, x + Math.floor(w / 2) - 1, y, 2, h, '#f0ead8');
      px(g, x, y + Math.floor(h / 2) - 1, w, 2, '#f0ead8');
      px(g, x - 2, y + h + 2, w + 4, 2, '#c9c0ae');
    }
    windowAt(26, 92, 24, 20);
    windowAt(118, 92, 24, 20);

    px(g, 74, 96, 22, 32, '#7a5535');
    px(g, 76, 98, 18, 30, '#3a2a1a');
    px(g, 76, 98, 18, 4, '#5f462c');
    px(g, 74, 96, 22, 2, '#a97c4f');
    px(g, 90, 114, 3, 3, '#e8c452');
    px(g, 70, 126, 30, 4, '#c99a66');
    px(g, 70, 126, 30, 1, '#e0c68f');
    px(g, 6, 128, 156, 4, '#6b5340');
  })();

  B.shop = mk(168, 132);
  (function () {
    const g = B.shop.getContext('2d'), r = rngf(9911);
    px(g, 4, 84, 160, 44, '#c9b489');
    for (let x = 8; x < 160; x += 10) px(g, x, 84, 1, 44, '#b29f70');
    px(g, 4, 124, 160, 4, '#a3906a');
    px(g, 4, 128, 160, 4, '#8a7a5a');
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.5 ? '#c0ab80' : '#d4c096';
      g.fillRect(6 + ((r() * 156) | 0), 86 + ((r() * 38) | 0), 1, 1);
    }
    px(g, 0, 34, 168, 52, '#3f7a6f');
    for (let y = 34; y < 86; y += 8) px(g, 0, y, 168, 2, '#2f5f57');
    for (let y = 38; y < 86; y += 8) {
      for (let x = ((y / 8) % 2) * 6; x < 168; x += 12) px(g, x, y, 1, 6, '#2f5f57');
    }
    px(g, 0, 34, 168, 4, '#4f9a8c');
    px(g, 0, 30, 168, 5, '#67b5a5');
    px(g, 0, 28, 168, 3, '#376b62');
    px(g, 4, 82, 160, 4, '#2b4f49');

    px(g, 24, 60, 120, 22, '#5a3f24');
    px(g, 26, 62, 116, 18, '#e8d9a8');
    px(g, 26, 62, 116, 1, '#f7efd0');
    PixelFont.draw(g, 'GENERAL STORE', 84, 68, '#4a3421', 1, 'center');

    function windowAt(x, y, w, h) {
      px(g, x - 2, y - 2, w + 4, h + 4, '#f0ead8');
      px(g, x, y, w, h, '#8fd0c0');
      px(g, x, y, w, 2, '#b8e8dc');
      px(g, x, y + h - 2, w, 2, '#5a9a8c');
      px(g, x + Math.floor(w / 2) - 1, y, 2, h, '#f0ead8');
      px(g, x - 2, y + h + 2, w + 4, 2, '#c9c0ae');
    }
    windowAt(22, 92, 28, 22);
    windowAt(116, 92, 28, 22);

    px(g, 74, 96, 22, 32, '#5a3f24');
    px(g, 76, 98, 18, 30, '#2b2118');
    px(g, 76, 98, 18, 4, '#4a3421');
    px(g, 90, 114, 3, 3, '#e8c452');
    px(g, 70, 126, 30, 4, '#c99a66');
    px(g, 70, 126, 30, 1, '#e0c68f');
  })();

  B.coop = mk(104, 76);
  (function () {
    const g = B.coop.getContext('2d');
    fillEllipse(g, 52, 73, 46, 3, 'rgba(20,16,12,0.2)');
    px(g, 4, 30, 96, 42, '#b5483f');
    px(g, 4, 30, 96, 2, '#c96054');
    for (let x = 12; x < 96; x += 12) px(g, x, 30, 1, 42, '#963a32');
    px(g, 4, 66, 96, 6, '#8f3630');
    px(g, 0, 8, 104, 24, '#5f3f24');
    px(g, 0, 8, 104, 4, '#7a5535');
    for (let y = 12; y < 30; y += 6) px(g, 0, y, 104, 2, '#4a3421');
    px(g, 4, 30, 96, 3, '#3f2a18');
    px(g, 44, 46, 20, 26, '#3a2a1a');
    px(g, 44, 46, 20, 3, '#5f462c');
    fillEllipse(g, 54, 46, 10, 5, '#3a2a1a');
    px(g, 74, 40, 16, 14, '#f0ead8');
    px(g, 74, 40, 16, 1, '#ffffff');
    px(g, 74, 47, 16, 1, '#c9c0ae');
    px(g, 81, 40, 1, 14, '#c9c0ae');
    px(g, 18, 40, 14, 12, '#e8d9a8');
    PixelFont.draw(g, 'CLUCK', 25, 44, '#4a3421', 1, 'center');
    px(g, 8, 72, 88, 4, '#8a6a4a');
  })();

  B.tavern = mk(168, 132);
  (function () {
    const g = B.tavern.getContext('2d'), r = rngf(7712);
    px(g, 4, 84, 160, 44, '#a8845c');
    for (let x = 8; x < 160; x += 10) px(g, x, 84, 1, 44, '#96734c');
    px(g, 4, 84, 160, 2, '#c9a67e');
    px(g, 4, 124, 160, 4, '#8a6a4a');
    px(g, 4, 128, 160, 4, '#6f5338');
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.5 ? '#9c7a52' : '#b8946a';
      g.fillRect(6 + ((r() * 156) | 0), 86 + ((r() * 38) | 0), 1, 1);
    }
    px(g, 0, 34, 168, 52, '#6b4a7a');
    for (let y = 34; y < 86; y += 8) px(g, 0, y, 168, 2, '#573a66');
    for (let y = 38; y < 86; y += 8) {
      for (let x = ((y / 8) % 2) * 6; x < 168; x += 12) px(g, x, y, 1, 6, '#573a66');
    }
    px(g, 0, 34, 168, 4, '#8a6a9c');
    px(g, 0, 30, 168, 5, '#9e7fb0');
    px(g, 0, 28, 168, 3, '#5f4370');
    px(g, 4, 82, 160, 4, '#4a3421');

    px(g, 28, 56, 112, 26, '#5a3f24');
    px(g, 30, 58, 108, 22, '#e8d9a8');
    px(g, 30, 58, 108, 1, '#f7efd0');
    PixelFont.draw(g, 'THE HEARTH', 84, 66, '#4a3421', 1, 'center');

    function windowAt(x, y, w, h) {
      px(g, x - 2, y - 2, w + 4, h + 4, '#f0ead8');
      px(g, x, y, w, h, '#f0c97a');
      px(g, x, y, w, 2, '#ffe1a8');
      px(g, x, y + h - 2, w, 2, '#c99a3a');
      px(g, x + Math.floor(w / 2) - 1, y, 2, h, '#f0ead8');
      px(g, x, y + Math.floor(h / 2) - 1, w, 2, '#f0ead8');
      px(g, x - 2, y + h + 2, w + 4, 2, '#c9c0ae');
    }
    windowAt(22, 92, 26, 22);
    windowAt(118, 92, 26, 22);

    px(g, 74, 96, 22, 32, '#5a3f24');
    px(g, 76, 98, 18, 30, '#3a2a1a');
    px(g, 76, 98, 18, 4, '#5f462c');
    px(g, 74, 96, 22, 2, '#a97c4f');
    px(g, 90, 114, 3, 3, '#e8c452');
    px(g, 70, 126, 30, 4, '#c99a66');
    px(g, 70, 126, 30, 1, '#e0c68f');
    px(g, 6, 128, 156, 4, '#6b5340');
    px(g, 64, 84, 7, 9, '#3a3a44');
    px(g, 65, 86, 5, 5, '#f7d76e');
    px(g, 96, 84, 7, 9, '#3a3a44');
    px(g, 97, 86, 5, 5, '#f7d76e');
  })();

  B.hall = mk(168, 132);
  (function () {
    const g = B.hall.getContext('2d'), r = rngf(5533);
    px(g, 4, 84, 160, 44, '#d3c6ab');
    for (let x = 10; x < 160; x += 18) px(g, x, 84, 1, 44, '#c0b195');
    px(g, 4, 84, 160, 2, '#e8dcc4');
    px(g, 4, 124, 160, 4, '#a89a80');
    px(g, 4, 128, 160, 4, '#8a7f68');
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.5 ? '#cbbd9f' : '#e0d4ba';
      g.fillRect(6 + ((r() * 156) | 0), 86 + ((r() * 38) | 0), 1, 1);
    }
    px(g, 0, 34, 168, 52, '#3f7a5a');
    for (let y = 34; y < 86; y += 8) px(g, 0, y, 168, 2, '#2f5f47');
    for (let y = 38; y < 86; y += 8) {
      for (let x = ((y / 8) % 2) * 6; x < 168; x += 12) px(g, x, y, 1, 6, '#2f5f47');
    }
    px(g, 0, 34, 168, 4, '#4f9a76');
    px(g, 0, 30, 168, 5, '#67b595');
    px(g, 0, 28, 168, 3, '#37705c');
    px(g, 4, 82, 160, 4, '#2b4f49');

    px(g, 34, 56, 100, 24, '#5a3f24');
    px(g, 36, 58, 96, 20, '#e8d9a8');
    px(g, 36, 58, 96, 1, '#f7efd0');
    PixelFont.draw(g, 'TOWN HALL', 84, 66, '#4a3421', 1, 'center');

    px(g, 14, 88, 9, 38, '#f0ead8');
    px(g, 14, 88, 9, 2, '#ffffff');
    px(g, 17, 90, 2, 34, '#d8d0bc');
    px(g, 145, 88, 9, 38, '#f0ead8');
    px(g, 145, 88, 9, 2, '#ffffff');
    px(g, 148, 90, 2, 34, '#d8d0bc');

    function windowAt(x, y, w, h) {
      px(g, x - 2, y - 2, w + 4, h + 4, '#f0ead8');
      px(g, x, y, w, h, '#8fd0c0');
      px(g, x, y, w, 2, '#b8e8dc');
      px(g, x, y + h - 2, w, 2, '#5a9a8c');
      px(g, x + Math.floor(w / 2) - 1, y, 2, h, '#f0ead8');
      px(g, x, y + Math.floor(h / 2) - 1, w, 2, '#f0ead8');
      px(g, x - 2, y + h + 2, w + 4, 2, '#c9c0ae');
    }
    windowAt(34, 94, 24, 20);
    windowAt(110, 94, 24, 20);

    px(g, 72, 94, 26, 34, '#5a3f24');
    px(g, 74, 96, 22, 32, '#2b2118');
    px(g, 84, 96, 2, 32, '#5a3f24');
    px(g, 74, 96, 22, 4, '#4a3421');
    px(g, 78, 112, 3, 3, '#e8c452');
    px(g, 90, 112, 3, 3, '#e8c452');
    px(g, 68, 126, 34, 4, '#c99a66');
    px(g, 68, 126, 34, 1, '#e0c68f');
    px(g, 6, 128, 156, 4, '#6b5340');
  })();
}

// ---- HUD chrome (bars, hotbar slots, panels) ----------------------

function buildUI() {
  const U = Sprites.ui;
  U.coin = mk(14, 14);
  (function () {
    const g = U.coin.getContext('2d');
    fillEllipse(g, 7, 7, 6.5, 6.5, '#8a6a1a');
    fillEllipse(g, 7, 7, 5.5, 5.5, '#e8c452');
    fillEllipse(g, 7, 7, 4, 4, '#f7e07a');
    PixelFont.draw(g, 'G', 7, 4, '#8a6a1a', 1, 'center');
    px(g, 4, 4, 2, 1, '#fff6c9');
  })();

  U.bolt = mk(12, 14);
  (function () {
    const g = U.bolt.getContext('2d');
    const rows = ['00100', '01100', '11000', '11110', '00110', '01100', '11000', '10000'];
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 5; x++) {
      if (rows[y][x] === '1') px(g, 3 + x, 1 + y, 1, 1, '#f7e07a');
    }
    px(g, 3, 4, 1, 3, '#fff6c9');
  })();

  U.sun = mk(20, 20);
  (function () {
    const g = U.sun.getContext('2d');
    fillEllipse(g, 10, 10, 5, 5, '#f0a53a');
    fillEllipse(g, 10, 10, 4, 4, '#f7d76e');
    fillEllipse(g, 9, 9, 2, 2, '#fff6c9');
    for (const d of [[0, -8], [0, 8], [-8, 0], [8, 0], [-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      px(g, 9 + d[0], 9 + d[1], 2, 2, '#f0a53a');
    }
  })();

  U.rain = mk(20, 20);
  (function () {
    const g = U.rain.getContext('2d');
    fillEllipse(g, 9, 8, 7, 4, '#b8c4d0');
    fillEllipse(g, 13, 9, 5, 3, '#a8b4c0');
    fillEllipse(g, 6, 9, 4, 3, '#a8b4c0');
    px(g, 3, 8, 14, 4, '#b8c4d0');
    px(g, 4, 12, 13, 1, '#8f9cab');
    for (let i = 0; i < 4; i++) px(g, 5 + i * 3, 14 + (i % 2), 1, 4, '#5f9fd8');
  })();

  U.storm = mk(20, 20);
  (function () {
    const g = U.storm.getContext('2d');
    fillEllipse(g, 9, 7, 7, 4, '#8f9cab');
    fillEllipse(g, 13, 8, 5, 3, '#7f8c9b');
    px(g, 3, 7, 14, 5, '#8f9cab');
    px(g, 4, 11, 13, 1, '#6b7887');
    const bolt = ['010', '110', '010', '110', '010'];
    for (let y = 0; y < bolt.length; y++) for (let x = 0; x < 3; x++) {
      if (bolt[y][x] === '1') px(g, 8 + x, 12 + y * 1, 2, 1, '#f7d76e');
    }
    px(g, 9, 13, 3, 4, '#f7d76e');
    px(g, 8, 15, 3, 3, '#f0a53a');
  })();

  U.heart = mk(12, 12);
  (function () {
    const g = U.heart.getContext('2d');
    fillEllipse(g, 4, 4, 3, 3, '#e0453f');
    fillEllipse(g, 8, 4, 3, 3, '#e0453f');
    for (let i = 0; i < 5; i++) {
      px(g, 2 + i, 6 + i, 8 - i * 2, 1, '#e0453f');
    }
    px(g, 3, 3, 1, 1, '#ff9a94');
  })();

  U.mail = mk(16, 12);
  (function () {
    const g = U.mail.getContext('2d');
    px(g, 0, 0, 16, 12, '#3d2c1d');
    px(g, 1, 1, 14, 10, '#f2ede0');
    px(g, 1, 1, 14, 1, '#ffffff');
    for (let i = 0; i < 5; i++) {
      px(g, 1 + i, 1 + i, 1, 1, '#c9bba4');
      px(g, 14 - i, 1 + i, 1, 1, '#c9bba4');
    }
    px(g, 1, 10, 14, 1, '#c9bba4');
    px(g, 6, 5, 4, 3, '#e8c452');
    px(g, 7, 6, 2, 1, '#f7e07a');
  })();
}

// ---- entry point: called once from boot() -------------------------

function buildAllSprites() {
  buildTiles();
  buildCharacters();
  buildCrops();
  buildItems();
  buildProps();
  buildBuildings();
  buildUI();
}
