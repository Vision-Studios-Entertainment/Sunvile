const World = {
  seed: 1337,
  maps: {},
  current: 'farm',

  map: function () { return this.maps[this.current]; },

  init: function (seed) {
    this.seed = seed;
    this.maps.farm = genFarm(seed);
    this.maps.house = genHouse();
    this.maps.shop = genShop();
    for (const k in this.maps) this.rebuildGrid(k);
  },

  tileAt: function (m, x, y) {
    const map = this.maps[m || this.current];
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return T.WATER;
    return map.tiles[y * map.w + x];
  },

  setTile: function (m, x, y, v) {
    const map = this.maps[m || this.current];
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return;
    map.tiles[y * map.w + x] = v;
  },

  solidTile: function (m, x, y) {
    const map = this.maps[m || this.current];
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
    if (TILE_SOLID[map.tiles[y * map.w + x]]) return true;
    const p = map.grid[y * map.w + x];
    return !!(p && p.some(function (q) { return q.solid; }));
  },

  propAt: function (m, x, y) {
    const map = this.maps[m || this.current];
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
    return map.grid[y * map.w + x];
  },

  rebuildGrid: function (m) {
    const map = this.maps[m];
    map.grid = new Array(map.w * map.h);
    for (const p of map.props) {
      if (!p.alive && p.type !== 'tree') continue;
      if (p.dead) continue;
      for (let y = 0; y < p.h; y++) {
        for (let x = 0; x < p.w; x++) {
          const tx = p.tx + x, ty = p.ty + y;
          if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
          const i = ty * map.w + tx;
          if (!map.grid[i]) map.grid[i] = [];
          map.grid[i].push(p);
        }
      }
    }
  },

  farmable: function (x, y) {
    if (x < FARMABLE.x0 || x > FARMABLE.x1 || y < FARMABLE.y0 || y > FARMABLE.y1) return false;
    const t = this.tileAt('farm', x, y);
    return TILE_FARM[t];
  },

  serialize: function () {
    const farm = this.maps.farm;
    const props = [];
    farm.props.forEach(function (p, i) {
      if (p.dirty) props.push({ i: i, alive: p.alive, hp: p.hp, state: p.state, timer: p.timer, ready: p.ready });
    });
    return { seed: this.seed, props: props };
  },

  applySave: function (d) {
    if (!d || d.seed !== this.seed) this.init(this.seed);
    const farm = this.maps.farm;
    (d.props || []).forEach(function (s) {
      const p = farm.props[s.i];
      if (!p) return;
      p.alive = s.alive; p.hp = s.hp; p.state = s.state; p.timer = s.timer; p.ready = s.ready;
      p.dirty = true;
    });
    this.rebuildGrid('farm');
  }
};

function mkMap(w, h, fill) {
  return {
    w: w, h: h,
    tiles: new Array(w * h).fill(fill),
    props: [], grid: [], crops: {}, soil: {},
    lights: [], npcs: [], chickens: [], name: ''
  };
}

function addProp(map, def) {
  const p = Object.assign({
    tx: 0, ty: 0, w: 1, h: 1, solid: true, alive: true, dead: false,
    hp: 1, maxHp: 1, state: 'full', timer: 0, ready: true, dirty: false,
    variant: 0, ox: 0, oy: 0, sprite: null, interact: null, text: null,
    target: null, spawn: null, kind: null
  }, def);
  map.props.push(p);
  return p;
}

function baseSpriteProp(map, type, sprite, tx, ty, w, h, extra) {
  const def = Object.assign({
    type: type, sprite: sprite, tx: tx, ty: ty, w: w, h: h,
    ox: tx * TILE + Math.floor((TILE * w - sprite.width) / 2),
    oy: (ty + h) * TILE - sprite.height
  }, extra || {});
  return addProp(map, def);
}

function noiseHash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, y, s, scale) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = noiseHash(x0, y0, s), b = noiseHash(x0 + 1, y0, s);
  const c = noiseHash(x0, y0 + 1, s), d = noiseHash(x0 + 1, y0 + 1, s);
  const p = a + (b - a) * sx, q = c + (d - c) * sx;
  return p + (q - p) * sy;
}

function fbm2(x, y, s, scale, oct) {
  let sum = 0, amp = 0.5, tot = 0, sc = scale;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x, y, s + i * 977, sc) * amp;
    tot += amp; amp *= 0.5; sc = Math.max(1, sc * 0.5);
  }
  return sum / tot;
}

function shuffleArr(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function genFarm(seed) {
  const s = seed >>> 0;
  const r = rngf(s);
  const m = mkMap(MAP_W, MAP_H, T.GRASS);
  m.name = 'Sunvale Farm';

  function inMap(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  function getT(x, y) { return inMap(x, y) ? m.tiles[y * MAP_W + x] : T.WATER; }
  function grassT(x, y) {
    const t = getT(x, y);
    return t === T.GRASS || t === T.GRASS2 || t === T.WILDFLOWER;
  }

  const occ = new Uint8Array(MAP_W * MAP_H);
  function taken(x, y) { return !inMap(x, y) || occ[y * MAP_W + x] === 1; }
  function freeAt(x, y) { return inMap(x, y) && !occ[y * MAP_W + x] && grassT(x, y); }

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const g = fbm2(x, y, s, 8, 3);
      const f = fbm2(x + 71, y - 53, s + 613, 5, 2);
      m.tiles[y * MAP_W + x] = f > 0.665 ? T.WILDFLOWER : (g > 0.52 ? T.GRASS2 : T.GRASS);
    }
  }

  const RES = [
    { x0: 5, y0: 3, x1: 16, y1: 13 },
    { x0: 41, y0: 3, x1: 52, y1: 13 },
    { x0: 37, y0: 18, x1: 49, y1: 31 },
    { x0: 7, y0: 21, x1: 34, y1: 48 },
    { x0: 8, y0: 12, x1: 48, y1: 16 },
    { x0: 9, y0: 23, x1: 11, y1: 26 },
    { x0: 20, y0: 16, x1: 44, y1: 19 },
    { x0: 45, y0: 32, x1: 50, y1: 37 }
  ];
  function reserved(x, y) {
    for (let i = 0; i < RES.length; i++) {
      const q = RES[i];
      if (x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) return true;
    }
    return false;
  }

  const PONDS = [
    { cx0: 45, cx1: 50, cy0: 44, cy1: 50, rx0: 4, rx1: 6.5, ry0: 3, ry1: 5 },
    { cx0: 20, cx1: 32, cy0: 52, cy1: 55, rx0: 5, rx1: 8, ry0: 2.5, ry1: 4 },
    { cx0: 6, cx1: 14, cy0: 52, cy1: 55, rx0: 4, rx1: 7, ry0: 2.5, ry1: 4 },
    { cx0: 53, cx1: 54, cy0: 24, cy1: 32, rx0: 2.5, rx1: 3.5, ry0: 3.5, ry1: 6 }
  ];
  const pondDef = PONDS[(r() * PONDS.length) | 0];
  const pcx = pondDef.cx0 + r() * (pondDef.cx1 - pondDef.cx0);
  const pcy = pondDef.cy0 + r() * (pondDef.cy1 - pondDef.cy0);
  const prx = pondDef.rx0 + r() * (pondDef.rx1 - pondDef.rx0);
  const pry = pondDef.ry0 + r() * (pondDef.ry1 - pondDef.ry0);
  const pseed = (s + 4877) | 0;

  function pondD(x, y) {
    const dx = (x + 0.5 - pcx) / prx, dy = (y + 0.5 - pcy) / pry;
    return Math.sqrt(dx * dx + dy * dy) + (fbm2(x, y, pseed, 4, 2) - 0.5) * 0.5;
  }

  const wet = new Uint8Array(MAP_W * MAP_H);
  const pbx0 = Math.max(2, Math.floor(pcx - prx) - 3), pbx1 = Math.min(MAP_W - 3, Math.ceil(pcx + prx) + 3);
  const pby0 = Math.max(2, Math.floor(pcy - pry) - 3), pby1 = Math.min(MAP_H - 3, Math.ceil(pcy + pry) + 3);
  for (let y = pby0; y <= pby1; y++) {
    for (let x = pbx0; x <= pbx1; x++) {
      if (reserved(x, y)) continue;
      const d = pondD(x, y);
      const i = y * MAP_W + x;
      if (d <= 1) {
        m.tiles[i] = T.WATER;
        occ[i] = 1;
        for (let wy = y - 2; wy <= y + 2; wy++) {
          for (let wx = x - 2; wx <= x + 2; wx++) {
            if (inMap(wx, wy)) wet[wy * MAP_W + wx] = 1;
          }
        }
      } else if (d <= 1.32 && grassT(x, y)) {
        m.tiles[i] = T.SAND;
        occ[i] = 1;
      }
    }
  }

  function rect(x0, y0, x1, y1, t) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      m.tiles[y * MAP_W + x] = t;
    }
  }

  const pond = { cx: 50, cy: 44, rx: 7.5, ry: 5.5 };
  for (let y = 36; y <= 53; y++) for (let x = 40; x <= 60; x++) {
    const dx = (x - pond.cx) / pond.rx, dy = (y - pond.cy) / pond.ry;
    const d = dx * dx + dy * dy;
    if (d <= 1) m.tiles[y * MAP_W + x] = T.WATER;
    else if (d <= 1.45) if (m.tiles[y * MAP_W + x] !== T.WATER) m.tiles[y * MAP_W + x] = T.SAND;
  }

  rect(8, 14, 47, 15, T.PATH);
  rect(10, 12, 11, 15, T.PATH);
  rect(46, 12, 47, 15, T.PATH);
  rect(19, 15, 20, 23, T.PATH);
  rect(45, 15, 46, 19, T.PATH);
  rect(21, 16, 45, 17, T.PATH);
  rect(12, 12, 23, 13, T.PATH);

  function fenceRect(x0, y0, x1, y1, gates) {
    for (let x = x0; x <= x1; x++) {
      let skipTop = false, skipBot = false;
      (gates || []).forEach(function (g) {
        if (g.edge === 'top' && x >= g.x0 && x <= g.x1) skipTop = true;
        if (g.edge === 'bottom' && x >= g.x0 && x <= g.x1) skipBot = true;
      });
      if (!skipTop) m.tiles[y0 * MAP_W + x] = T.FENCE;
      if (!skipBot) m.tiles[y1 * MAP_W + x] = T.FENCE;
    }
    for (let y = y0; y <= y1; y++) {
      let skipL = false, skipR = false;
      (gates || []).forEach(function (g) {
        if (g.edge === 'left' && y >= g.y0 && y <= g.y1) skipL = true;
        if (g.edge === 'right' && y >= g.y0 && y <= g.y1) skipR = true;
      });
      if (!skipL) m.tiles[y * MAP_W + x0] = T.FENCE;
      if (!skipR) m.tiles[y * MAP_W + x1] = T.FENCE;
    }
  }

  fenceRect(7, 21, 34, 47, [{ edge: 'top', x0: 19, x1: 20 }]);
  fenceRect(38, 18, 48, 30, [{ edge: 'top', x0: 45, x1: 46 }]);

  const occ = {};
  function block(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) occ[x + ',' + y] = 1;
  }
  block(6, 3, 16, 13);
  block(42, 3, 52, 13);
  block(39, 19, 45, 23);
  block(6, 12, 48, 16);
  block(6, 20, 35, 48);
  block(37, 17, 49, 31);
  block(39, 36, 60, 53);
  block(17, 11, 24, 24);
  block(44, 14, 47, 20);

  const house = baseSpriteProp(m, 'building', Sprites.builds.house, 6, 4, 10, 8, {
    ox: 6 * TILE - 4, oy: 12 * TILE - 132, spriteName: 'house'
  });
  house.interact = 'door'; house.target = 'house';
  house.spawn = { x: 7 * TILE + 8, y: 10 * TILE + 8 };
  house.doorTiles = [[10, 11], [11, 11]];
  m.lights.push({ x: house.ox + 38, y: house.oy + 102, r: 52, c: '#ffd9a0' });
  m.lights.push({ x: house.ox + 130, y: house.oy + 102, r: 52, c: '#ffd9a0' });
  m.lights.push({ x: house.ox + 85, y: house.oy + 112, r: 40, c: '#ffca80' });

  const shop = baseSpriteProp(m, 'building', Sprites.builds.shop, 42, 4, 10, 8, {
    ox: 42 * TILE - 4, oy: 12 * TILE - 132, spriteName: 'shop'
  });
  shop.interact = 'door'; shop.target = 'shop';
  shop.spawn = { x: 7 * TILE + 8, y: 10 * TILE + 8 };
  shop.doorTiles = [[46, 11], [47, 11]];
  m.lights.push({ x: shop.ox + 36, y: shop.oy + 103, r: 52, c: '#ffe0b0' });
  m.lights.push({ x: shop.ox + 130, y: shop.oy + 103, r: 52, c: '#ffe0b0' });
  m.lights.push({ x: shop.ox + 85, y: shop.oy + 112, r: 40, c: '#ffca80' });
  m.lights.push({ x: shop.ox + 84, y: shop.oy + 71, r: 46, c: '#a8f0e0' });

  const coop = baseSpriteProp(m, 'building', Sprites.builds.coop, 39, 20, 6, 4, {
    ox: 39 * TILE - 4, oy: 24 * TILE - 76, spriteName: 'coop'
  });

  function place(type, sprite, x, y, extra) {
    const p = baseSpriteProp(m, type, sprite, x, y, 1, 1, extra);
    p.dirty = true;
    block(x, y, x, y);
    return p;
  }

  place('mailbox', Sprites.props.mailbox, 13, 12, { interact: 'mailbox', text: null });
  place('sign', Sprites.props.sign, 16, 13, { interact: 'sign', text: 'WELCOME TO SUNVALE FARM' });
  place('sign', Sprites.props.sign_small, 44, 13, { interact: 'sign', text: 'GENERAL STORE - SEEDS AND SUPPLIES' });

  for (const lx of [25, 33, 41]) {
    const p = place('lamp', Sprites.props.lamp, lx, 13, { solid: false, oy: 14 * TILE - 26 });
    m.lights.push({ x: lx * TILE + 8, y: 14 * TILE - 14, r: 58, c: '#ffd9a0', on: true });
  }
  place('lamp', Sprites.props.lamp, 21, 19, { solid: false, oy: 20 * TILE - 26 });
  m.lights.push({ x: 21 * TILE + 8, y: 20 * TILE - 14, r: 58, c: '#ffd9a0', on: true });
  place('lamp', Sprites.props.lamp, 47, 16, { solid: false, oy: 17 * TILE - 26 });
  m.lights.push({ x: 47 * TILE + 8, y: 17 * TILE - 14, r: 58, c: '#ffd9a0', on: true });

  place('trough', Sprites.props.trough, 41, 26, { oy: 27 * TILE - 12 });
  place('scarecrow', Sprites.props.scarecrow, 32, 23, {});
  place('barrel', Sprites.props.barrel, 16, 10, {});
  place('crate', Sprites.props.crate, 42, 10, {});
  place('pot', Sprites.props.pot, 17, 11, { solid: false });

  const zones = [
    { x0: 1, y0: 2, x1: 5, y1: 57, w: 3 },
    { x0: 54, y0: 2, x1: 58, y1: 36, w: 2 },
    { x0: 2, y0: 1, x1: 57, y1: 3, w: 2 },
    { x0: 2, y0: 51, x1: 57, y1: 58, w: 3 },
    { x0: 35, y0: 34, x1: 37, y1: 47, w: 2 },
    { x0: 49, y0: 19, x1: 58, y1: 34, w: 2 },
    { x0: 26, y0: 49, x1: 38, y1: 50, w: 1 }
  ];

  function free(x, y) {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
    if (occ[x + ',' + y]) return false;
    const t = m.tiles[y * MAP_W + x];
    return t === T.GRASS || t === T.GRASS2 || t === T.WILDFLOWER;
  }

  for (const z of zones) {
    for (let i = 0; i < 90; i++) {
      const x = z.x0 + ((r() * (z.x1 - z.x0 + 1)) | 0);
      const y = z.y0 + ((r() * (z.y1 - z.y0 + 1)) | 0);
      if (!free(x, y)) continue;
      const roll = r();
      if (roll < 0.62) {
        const v = (r() * Sprites.props.tree.length) | 0;
        const p = addProp(m, {
          type: 'tree', sprite: Sprites.props.tree[v], variant: v,
          tx: x, ty: y, w: 1, h: 1, hp: 4, maxHp: 4, state: 'full',
          ox: x * TILE - 5, oy: (y + 1) * TILE - 34, kind: 'oak', dirty: true
        });
        block(x, y, x, y);
      } else if (roll < 0.86) {
        const v = (r() * Sprites.props.pine.length) | 0;
        const p = addProp(m, {
          type: 'tree', sprite: Sprites.props.pine[v], variant: v,
          tx: x, ty: y, w: 1, h: 1, hp: 5, maxHp: 5, state: 'full',
          ox: x * TILE - 4, oy: (y + 1) * TILE - 36, kind: 'pine', dirty: true
        });
        block(x, y, x, y);
      } else if (roll < 0.94) {
        const v = (r() * Sprites.props.rock.length) | 0;
        const ore = r() < 0.18;
        addProp(m, {
          type: 'rock', sprite: ore ? Sprites.props.ore[v % 2] : Sprites.props.rock[v],
          variant: v, tx: x, ty: y, w: 1, h: 1, hp: ore ? 4 : 3, maxHp: ore ? 4 : 3,
          state: 'full', ox: x * TILE - 1, oy: (y + 1) * TILE - 16,
          kind: ore ? 'ore' : 'rock', dirty: true
        });
        block(x, y, x, y);
      } else {
        const v = (r() * 2) | 0;
        addProp(m, {
          type: 'bush', sprite: Sprites.props.bush_berry[v], variant: v,
          tx: x, ty: y, w: 1, h: 1, hp: 1, maxHp: 1, state: 'full', ready: true, timer: 0,
          ox: x * TILE - 1, oy: (y + 1) * TILE - 14, interact: 'bush', dirty: true
        });
        block(x, y, x, y);
      }
    }
  }

  for (let i = 0; i < 40; i++) {
    const x = 2 + ((r() * (MAP_W - 4)) | 0), y = 2 + ((r() * (MAP_H - 4)) | 0);
    if (!free(x, y)) continue;
    if (r() < 0.4) m.tiles[y * MAP_W + x] = T.WILDFLOWER;
  }

  const npcs = [];
  NPC_DEFS.filter(function (d) { return d.map === 'farm'; }).forEach(function (d) {
    npcs.push({
      def: d, x: d.home.x * TILE, y: d.home.y * TILE, dir: 'down',
      frame: 0, anim: 0, tx: d.home.x, ty: d.home.y, state: 'idle', wait: 1 + r() * 2,
      talked: false, moving: false, prevX: d.home.x, prevY: d.home.y
    });
  });
  m.npcs = npcs;

  for (let i = 0; i < 4; i++) {
    m.chickens.push({
      x: (40 + i) * TILE + 4, y: (25 + (i % 2)) * TILE,
      dir: -1, frame: 0, anim: 0, tx: 40 + i, ty: 25 + (i % 2),
      state: 'idle', wait: r() * 2, petted: false, moving: false
    });
  }

  return m;
}

function genHouse() {
  const m = mkMap(16, 12, T.FLOOR);
  m.name = 'Your House';
  for (let x = 0; x < 16; x++) { m.tiles[x] = T.WALL; m.tiles[11 * 16 + x] = T.WALL; }
  for (let y = 0; y < 12; y++) { m.tiles[y * 16] = T.WALL; m.tiles[y * 16 + 15] = T.WALL; }
  for (let y = 6; y <= 7; y++) for (let x = 6; x <= 9; x++) m.tiles[y * 16 + x] = T.RUG;

  function place(type, sprite, x, y, w, h, extra) {
    const p = baseSpriteProp(m, type, sprite, x, y, w || 1, h || 1, extra);
    p.dirty = true;
    return p;
  }

  const door = addProp(m, {
    type: 'door', tx: 7, ty: 11, w: 1, h: 1, solid: true, interact: 'exit',
    target: 'farm', spawn: { x: 10 * TILE + 8, y: 13 * TILE }, sprite: null
  });
  const bed = place('bed', Sprites.props.bed, 13, 1, 1, 2, { interact: 'bed' });
  place('tv', Sprites.props.tv, 2, 1, 1, 1, { interact: 'tv', oy: 2 * TILE - 16 });
  place('fridge', Sprites.props.fridge, 1, 1, 1, 1, {});
  place('stove', Sprites.props.stove, 4, 1, 1, 1, {});
  place('table', Sprites.props.table, 7, 4, 2, 1, { oy: 5 * TILE - 22 });
  place('chair', Sprites.props.chair, 6, 4, 1, 1, { oy: 5 * TILE - 20 });
  place('chest', Sprites.props.chest, 2, 9, 1, 1, { interact: 'chest', oy: 10 * TILE - 16 });
  place('pot', Sprites.props.pot, 14, 9, 1, 1, { solid: false });
  place('lamp', Sprites.props.lamp, 1, 8, 1, 1, { solid: false, oy: 9 * TILE - 26 });
  place('shelf', Sprites.props.shelf, 11, 1, 1, 1, { oy: 2 * TILE - 22, w: 3, h: 1 });
  m.props[m.props.length - 1].w = 3;

  m.lights.push({ x: 1 * TILE + 8, y: 9 * TILE - 14, r: 62, c: '#ffd9a0', on: true });
  m.lights.push({ x: 3 * TILE + 8, y: 2 * TILE, r: 44, c: '#8fd0ff', on: true });
  m.lights.push({ x: 8 * TILE, y: 5 * TILE, r: 40, c: '#ffd9a0', on: true });
  return m;
}

function genShop() {
  const m = mkMap(16, 12, T.STONE);
  m.name = 'General Store';
  for (let x = 0; x < 16; x++) { m.tiles[x] = T.WALL; m.tiles[11 * 16 + x] = T.WALL; }
  for (let y = 0; y < 12; y++) { m.tiles[y * 16] = T.WALL; m.tiles[y * 16 + 15] = T.WALL; }

  function place(type, sprite, x, y, w, h, extra) {
    const p = baseSpriteProp(m, type, sprite, x, y, w || 1, h || 1, extra);
    p.dirty = true;
    return p;
  }

  addProp(m, {
    type: 'door', tx: 7, ty: 11, w: 1, h: 1, solid: true, interact: 'exit',
    target: 'farm', spawn: { x: 46 * TILE + 8, y: 13 * TILE }, sprite: null
  });

  for (let x = 2; x <= 12; x += 2) {
    const s = place('shelf', Sprites.props.shelf, x, 1, 1, 1, { oy: 2 * TILE - 22 });
    s.w = 2;
  }
  for (let x = 3; x <= 12; x++) {
    place('counter', Sprites.props.counter, x, 6, 1, 1, { interact: 'shop', oy: 7 * TILE - 22 });
  }
  place('register', Sprites.props.register, 9, 5, 1, 1, { oy: 6 * TILE - 14 });
  place('barrel', Sprites.props.barrel, 1, 3, 1, 1, {});
  place('crate', Sprites.props.crate, 14, 3, 1, 1, {});
  place('pot', Sprites.props.pot, 1, 9, 1, 1, { solid: false });
  place('pot', Sprites.props.pot, 14, 9, 1, 1, { solid: false });

  const d = NPC_DEFS.find(function (n) { return n.id === 'juniper'; });
  m.npcs = [{
    def: d, x: 6 * TILE, y: 5 * TILE, dir: 'down', frame: 0, anim: 0,
    tx: 6, ty: 5, state: 'idle', wait: 2, talked: false, moving: false,
    prevX: 6, prevY: 5, range: d.range
  }];

  m.lights.push({ x: 4 * TILE, y: 3 * TILE, r: 64, c: '#fff0c9', on: true });
  m.lights.push({ x: 11 * TILE, y: 3 * TILE, r: 64, c: '#fff0c9', on: true });
  return m;
}

function propSprite(p) {
  if (p.type === 'tree') {
    if (p.state === 'stump') return Sprites.props.stump[0];
    if (p.state === 'sprout') return Sprites.props.sprout[0];
    return p.kind === 'pine' ? Sprites.props.pine[p.variant] : Sprites.props.tree[p.variant];
  }
  if (p.type === 'rock') return p.alive ? p.sprite : null;
  if (p.type === 'bush') return p.ready ? Sprites.props.bush_berry[p.variant] : Sprites.props.bush[p.variant];
  if (p.type === 'building') return Sprites.builds[p.spriteName];
  return p.sprite;
}
