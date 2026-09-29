/* WORLD — procedural maps, tiles and collision.

   World API (used by everyone else)
     init(seed)          rebuilds maps.farm/house/shop and their grids
     map()               the map the player is currently on
     tileAt/setTile      read/write a tile id (m = map name, null = current)
     solidTile           wall/water/fence test used by movement + tools
     propAt              objects standing on a tile (trees, rocks, signs...)
     rebuildGrid(name)   rebuild the spatial lookup after a prop changes
     farmable(x,y)       inside the tilled field rect (FARMABLE in data.js)
     serialize/applySave World blob for the save file

   Layout
     World object       public API above
     helpers            mkMap/addProp/baseSpriteProp, noiseHash/noise2/fbm2
                        (value noise -> organic terrain), shuffleArr
     genFarm            big one: terrain, water, field, props, NPCs, chickens
     genHouse / genShop interiors
     propSprite         picks the right Sprites.* canvas for a prop

   Contracts
     * World.init() assigns this.maps.<name> = gen<Name>() — EVERY map it
       assigns needs a generator defined in this file, or boot dies with
       "ReferenceError: <gen> is not defined". New maps also need doors/
       entrances in the other maps and a spawn point in Game.interact().
     * World.maps[<name>] shape is what Game.save() serialises — renaming a
       map or a prop type breaks old saves.
     * After any prop mutation (chop/mine/kill) call rebuildGrid() or
       collision and interaction lookups go stale. */

const World = {
  seed: 1337,
  maps: {},
  current: 'farm',

// ==== public API ====================================================

  map: function () { return this.maps[this.current]; },

  init: function (seed) {
    this.seed = seed;
    this.maps.farm = genFarm(seed);
    this.maps.house = genHouse();
    this.maps.shop = genShop();
    this.maps.tavern = genTavern();
    this.maps.hall = genHall();
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

// ==== helpers: map scaffolding, noise, shuffling ===================

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

// ==== procedural map generation ====================================

function genFarm(seed) {
  const s = seed >>> 0;
  const r = rngf(s);
  const m = mkMap(MAP_W, MAP_H, T.GRASS);
  m.name = (typeof L === 'function') ? L('map.farm') : 'Sunvale Farm';

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
    { x0: 45, y0: 32, x1: 50, y1: 37 },
    { x0: 17, y0: 3, x1: 28, y1: 13 },
    { x0: 29, y0: 3, x1: 40, y1: 13 }
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

  function block(x0, y0, x1, y1) {
    for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) {
        occ[y * MAP_W + x] = 1;
      }
    }
  }

  function fenceRect(x0, y0, x1, y1, gates) {
    const gs = gates || [];
    function put(x, y) {
      if (!freeAt(x, y)) return;
      m.tiles[y * MAP_W + x] = T.FENCE;
      occ[y * MAP_W + x] = 1;
    }
    for (let x = x0; x <= x1; x++) {
      if (!gs.some(function (g) { return g.edge === 'top' && x >= g.x0 && x <= g.x1; })) put(x, y0);
      if (!gs.some(function (g) { return g.edge === 'bottom' && x >= g.x0 && x <= g.x1; })) put(x, y1);
    }
    for (let y = y0; y <= y1; y++) {
      if (!gs.some(function (g) { return g.edge === 'left' && y >= g.y0 && y <= g.y1; })) put(x0, y);
      if (!gs.some(function (g) { return g.edge === 'right' && y >= g.y0 && y <= g.y1; })) put(x1, y);
    }
  }

  function penFree(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inMap(x, y) || reserved(x, y) || taken(x, y) || !grassT(x, y)) return false;
      }
    }
    return true;
  }

  const fieldX = 14 + ((r() * 17) | 0);
  const fieldGap = 30 + ((r() * 14) | 0);
  fenceRect(7, 21, 34, 48, [
    { edge: 'top', x0: fieldX, x1: fieldX + 1 },
    { edge: 'right', y0: fieldGap, y1: fieldGap + 1 }
  ]);

  const coopGate = 43 + ((r() * 5) | 0);
  fenceRect(38, 18, 48, 30, [
    { edge: 'top', x0: coopGate, x1: Math.min(47, coopGate + 1) }
  ]);

  const BANDS = [
    { x0: 3, y0: 49, x1: 34, y1: 57 },
    { x0: 49, y0: 4, x1: 58, y1: 17 },
    { x0: 17, y0: 4, x1: 40, y1: 11 },
    { x0: 36, y0: 33, x1: 58, y1: 43 }
  ];
  let pens = 1 + ((r() * 2) | 0);
  for (let a = 0; a < 24 && pens > 0; a++) {
    const b = BANDS[(r() * BANDS.length) | 0];
    const w = 6 + ((r() * 8) | 0);
    const h = 4 + ((r() * 4) | 0);
    if (b.x1 - b.x0 < w + 1 || b.y1 - b.y0 < h + 1) continue;
    const x0 = b.x0 + ((r() * (b.x1 - b.x0 - w)) | 0);
    const y0 = b.y0 + ((r() * (b.y1 - b.y0 - h)) | 0);
    const x1 = x0 + w, y1 = y0 + h;
    if (!penFree(x0 - 1, y0 - 1, x1 + 1, y1 + 1)) continue;
    const ge = (r() * 4) | 0;
    let gate;
    if (ge < 2) {
      const gx = x0 + 1 + ((r() * Math.max(1, w - 1)) | 0);
      gate = { edge: ge === 0 ? 'top' : 'bottom', x0: gx, x1: Math.min(x1, gx + 1) };
    } else {
      const gy = y0 + 1 + ((r() * Math.max(1, h - 1)) | 0);
      gate = { edge: ge === 2 ? 'left' : 'right', y0: gy, y1: Math.min(y1, gy + 1) };
    }
    fenceRect(x0, y0, x1, y1, [gate]);
    pens--;
  }

  function pathable(x, y) {
    if (!inMap(x, y)) return false;
    const t = m.tiles[y * MAP_W + x];
    return t !== T.WATER && t !== T.SAND;
  }
  function path(x, y) {
    if (!pathable(x, y)) return false;
    m.tiles[y * MAP_W + x] = T.PATH;
    occ[y * MAP_W + x] = 1;
    return true;
  }
  function pathRect(x0, y0, x1, y1) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) path(x, y);
    }
  }

  pathRect(8, 14, 47, 15);
  pathRect(10, 12, 11, 15);
  pathRect(46, 12, 47, 15);
  pathRect(22, 12, 23, 13);
  pathRect(34, 12, 35, 13);

  const spineX = 35 + ((r() * 2) | 0);
  const reachY = Math.max(20, Math.min(56, Math.round(pcy)));
  for (let y = 16; y <= reachY; y++) {
    if (!path(spineX, y)) break;
    path(spineX + 1, y);
  }
  let hitR = -1, hitL = -1;
  for (let x = spineX + 2; x <= MAP_W - 3; x++) if (!pathable(x, reachY)) { hitR = x; break; }
  for (let x = spineX - 1; x >= 2; x--) if (!pathable(x, reachY)) { hitL = x; break; }
  let dir = 0;
  if (hitR >= 0 && (hitL < 0 || hitR - spineX <= spineX - hitL)) dir = 1;
  else if (hitL >= 0) dir = -1;
  if (dir) {
    let hx = spineX + (dir > 0 ? 2 : -1);
    while (dir > 0 ? hx <= MAP_W - 3 : hx >= 2) {
      if (!path(hx, reachY)) break;
      hx += dir;
    }
  }

  for (let y = 16; y <= 21; y++) {
    if (!path(fieldX, y)) break;
    path(fieldX + 1, y);
  }
  if (r() < 0.5) {
    const arm = 2 + ((r() * 5) | 0);
    const ad = r() < 0.5 ? -1 : 1;
    for (let k = 1; k <= arm; k++) path(fieldX + ad * k, 17);
  }

  const coopX = 44 + ((r() * 4) | 0);
  for (let y = 16; y <= 19; y++) {
    if (!path(coopX, y)) break;
    path(coopX + 1, y);
  }
  for (let x = 40; x <= coopX + 1; x++) path(x, 19);

  const spurN = 2 + ((r() * 3) | 0);
  for (let i = 0; i < spurN; i++) {
    const up = r() < 0.35;
    const sx = up ? 18 + ((r() * 23) | 0) : 12 + ((r() * 36) | 0);
    const len = 2 + ((r() * 4) | 0);
    const ya = up ? 13 : 16, yb = up ? 13 - len : 16 + len;
    for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) if (!path(sx, y)) break;
    if (r() < 0.5) {
      const ad = r() < 0.5 ? -1 : 1;
      const arm = 2 + ((r() * 5) | 0);
      for (let k = 1; k <= arm; k++) path(sx + ad * k, yb);
    }
  }

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

  const tavern = baseSpriteProp(m, 'building', Sprites.builds.tavern, 18, 4, 10, 8, {
    ox: 18 * TILE - 4, oy: 12 * TILE - 132, spriteName: 'tavern'
  });
  tavern.interact = 'door'; tavern.target = 'tavern';
  tavern.spawn = { x: 22 * TILE + 8, y: 13 * TILE };
  tavern.doorTiles = [[22, 11], [23, 11]];
  block(18, 4, 27, 11);
  m.lights.push({ x: tavern.ox + 36, y: tavern.oy + 103, r: 52, c: '#ffd0a0' });
  m.lights.push({ x: tavern.ox + 130, y: tavern.oy + 103, r: 52, c: '#ffd0a0' });
  m.lights.push({ x: tavern.ox + 85, y: tavern.oy + 112, r: 44, c: '#ffca80' });
  m.lights.push({ x: tavern.ox + 67, y: tavern.oy + 88, r: 26, c: '#ffd9a0' });
  m.lights.push({ x: tavern.ox + 101, y: tavern.oy + 88, r: 26, c: '#ffd9a0' });

  const hall = baseSpriteProp(m, 'building', Sprites.builds.hall, 30, 4, 10, 8, {
    ox: 30 * TILE - 4, oy: 12 * TILE - 132, spriteName: 'hall'
  });
  hall.interact = 'door'; hall.target = 'hall';
  hall.spawn = { x: 34 * TILE + 8, y: 13 * TILE };
  hall.doorTiles = [[34, 11], [35, 11]];
  block(30, 4, 39, 11);
  m.lights.push({ x: hall.ox + 34, y: hall.oy + 103, r: 52, c: '#e8ffd0' });
  m.lights.push({ x: hall.ox + 132, y: hall.oy + 103, r: 52, c: '#e8ffd0' });
  m.lights.push({ x: hall.ox + 85, y: hall.oy + 112, r: 44, c: '#ffca80' });

  const coop = baseSpriteProp(m, 'building', Sprites.builds.coop, 39, 20, 6, 4, {
    ox: 39 * TILE - 4, oy: 24 * TILE - 76, spriteName: 'coop'
  });

  function place(type, sprite, x, y, extra) {
    const p = baseSpriteProp(m, type, sprite, x, y, 1, 1, extra);
    p.dirty = true;
    occ[y * MAP_W + x] = 1;
    return p;
  }

  function placeFree(type, sprite, cands, extra) {
    const list = shuffleArr(cands.slice(), r);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!freeAt(c[0], c[1])) continue;
      const ex = typeof extra === 'function' ? extra(c[0], c[1]) : extra;
      return place(type, sprite, c[0], c[1], ex);
    }
    return null;
  }

  function grid(x0, y0, x1, y1) {
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
    return out;
  }

  placeFree('mailbox', Sprites.props.mailbox, [[12, 12], [13, 12], [14, 12], [12, 13], [14, 13], [15, 12]],
    { interact: 'mailbox', text: null });
  placeFree('sign', Sprites.props.sign, [[15, 13], [16, 13], [17, 13], [14, 13], [13, 13]],
    { interact: 'sign', text: (typeof L === 'function') ? L('sign.farm') : 'WELCOME TO SUNVALE FARM' });
  placeFree('sign', Sprites.props.sign_small, [[44, 13], [43, 13], [45, 13], [42, 13], [41, 13]],
    { interact: 'sign', text: (typeof L === 'function') ? L('sign.shop') : 'GENERAL STORE - SEEDS AND SUPPLIES' });

  const qboard = baseSpriteProp(m, 'board', Sprites.props.board, 17, 13, 2, 1, {
    interact: 'board', text: null
  });
  occ[13 * MAP_W + 17] = 1;
  occ[13 * MAP_W + 18] = 1;

  const lampPool = [];
  for (let x = 12; x <= 45; x++) lampPool.push(x);
  shuffleArr(lampPool, r);
  const lamps = [];
  const lampN = 4 + ((r() * 3) | 0);
  for (let i = 0; i < lampPool.length && lamps.length < lampN; i++) {
    const lx = lampPool[i];
    if (lamps.some(function (v) { return Math.abs(v - lx) < 5; })) continue;
    const ly = r() < 0.5 ? 13 : 16;
    if (!freeAt(lx, ly)) continue;
    place('lamp', Sprites.props.lamp, lx, ly, { solid: false, oy: (ly + 1) * TILE - 26 });
    m.lights.push({ x: lx * TILE + 8, y: (ly + 1) * TILE - 14, r: 58, c: '#ffd9a0', on: true });
    lamps.push(lx);
  }

  placeFree('barrel', Sprites.props.barrel, grid(17, 9, 20, 13), {});
  placeFree('crate', Sprites.props.crate, grid(37, 9, 40, 13), {});
  placeFree('pot', Sprites.props.pot, grid(12, 13, 45, 16), { solid: false });
  placeFree('scarecrow', Sprites.props.scarecrow, grid(13, 25, 30, 44), {});
  placeFree('trough', Sprites.props.trough, [[41, 26], [42, 26], [46, 26], [45, 27], [43, 28]],
    function (x, y) { return { oy: (y + 1) * TILE - 12 }; });

  let trees = 0, rocks = 0, bushes = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (occ[i] || reserved(x, y) || !grassT(x, y)) continue;
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      let d = edge <= 1 ? 0.75 : edge <= 3 ? 0.42 : edge <= 7 ? 0.16 : 0.05;
      d += (fbm2(x, y, s + 131, 6, 2) - 0.45) * 0.55;
      if (wet[i]) d += 0.28;
      if (d <= 0 || r() >= d) continue;
      const roll = r();
      if (roll < 0.6) {
        if (trees >= 140) continue;
        const pine = r() < 0.38;
        const v = (r() * (pine ? Sprites.props.pine.length : Sprites.props.tree.length)) | 0;
        addProp(m, pine ? {
          type: 'tree', sprite: Sprites.props.pine[v], variant: v,
          tx: x, ty: y, w: 1, h: 1, hp: 5, maxHp: 5, state: 'full',
          ox: x * TILE - 4, oy: (y + 1) * TILE - 36, kind: 'pine', dirty: true
        } : {
          type: 'tree', sprite: Sprites.props.tree[v], variant: v,
          tx: x, ty: y, w: 1, h: 1, hp: 4, maxHp: 4, state: 'full',
          ox: x * TILE - 5, oy: (y + 1) * TILE - 34, kind: 'oak', dirty: true
        });
        occ[i] = 1; trees++;
      } else if (roll < 0.86) {
        if (rocks >= 60) continue;
        const v = (r() * Sprites.props.rock.length) | 0;
        const ore = r() < 0.18;
        addProp(m, {
          type: 'rock', sprite: ore ? Sprites.props.ore[v % 2] : Sprites.props.rock[v],
          variant: v, tx: x, ty: y, w: 1, h: 1, hp: ore ? 4 : 3, maxHp: ore ? 4 : 3,
          state: 'full', ox: x * TILE - 1, oy: (y + 1) * TILE - 16,
          kind: ore ? 'ore' : 'rock', dirty: true
        });
        occ[i] = 1; rocks++;
      } else {
        if (bushes >= 30) continue;
        const v = (r() * 2) | 0;
        addProp(m, {
          type: 'bush', sprite: Sprites.props.bush_berry[v], variant: v,
          tx: x, ty: y, w: 1, h: 1, hp: 1, maxHp: 1, state: 'full', ready: true, timer: 0,
          ox: x * TILE - 1, oy: (y + 1) * TILE - 14, interact: 'bush', dirty: true
        });
        occ[i] = 1; bushes++;
      }
    }
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
  m.name = (typeof L === 'function') ? L('map.house') : 'Your House';
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
  place('stove', Sprites.props.stove, 4, 1, 1, 1, { interact: 'stove' });
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
  m.name = (typeof L === 'function') ? L('map.shop') : 'General Store';
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
  NPC_DEFS.filter(function (n) { return n.map === 'shop' && n.id !== 'juniper'; }).forEach(function (n) {
    m.npcs.push({
      def: n, x: n.home.x * TILE, y: n.home.y * TILE, dir: 'down', frame: 0, anim: 0,
      tx: n.home.x, ty: n.home.y, state: 'idle', wait: 1 + Math.random() * 2,
      talked: false, moving: false, prevX: n.home.x, prevY: n.home.y, range: n.range
    });
  });

  m.lights.push({ x: 4 * TILE, y: 3 * TILE, r: 64, c: '#fff0c9', on: true });
  m.lights.push({ x: 11 * TILE, y: 3 * TILE, r: 64, c: '#fff0c9', on: true });
  return m;
}

// ==== prop -> sprite lookup =======================================

function genTavern() {
  const m = mkMap(16, 12, T.FLOOR);
  m.name = (typeof L === 'function') ? L('map.tavern', null) !== 'map.tavern' ? L('map.tavern') : 'The Hearth Tavern' : 'The Hearth Tavern';
  for (let x = 0; x < 16; x++) { m.tiles[x] = T.WALL; m.tiles[11 * 16 + x] = T.WALL; }
  for (let y = 0; y < 12; y++) { m.tiles[y * 16] = T.WALL; m.tiles[y * 16 + 15] = T.WALL; }
  for (let y = 6; y <= 7; y++) for (let x = 3; x <= 8; x++) m.tiles[y * 16 + x] = T.RUG;

  function place(type, sprite, x, y, w, h, extra) {
    const p = baseSpriteProp(m, type, sprite, x, y, w || 1, h || 1, extra);
    p.dirty = true;
    return p;
  }

  addProp(m, {
    type: 'door', tx: 7, ty: 11, w: 1, h: 1, solid: true, interact: 'exit',
    target: 'farm', spawn: { x: 22 * TILE + 8, y: 13 * TILE }, sprite: null
  });

  place('fireplace', Sprites.props.fireplace, 2, 1, 2, 1, { oy: 2 * TILE - 34 });
  place('stove', Sprites.props.stove, 13, 1, 1, 1, { interact: 'stove' });
  place('shelf', Sprites.props.shelf, 6, 1, 1, 1, { oy: 2 * TILE - 22, w: 3, h: 1 });
  m.props[m.props.length - 1].w = 3;
  for (let x = 1; x <= 7; x++) {
    place('counter', Sprites.props.counter, x, 5, 1, 1, { oy: 6 * TILE - 22 });
  }
  place('table', Sprites.props.table, 4, 8, 2, 1, { oy: 9 * TILE - 22 });
  place('chair', Sprites.props.chair, 3, 8, 1, 1, { oy: 9 * TILE - 20 });
  place('chair', Sprites.props.chair, 6, 8, 1, 1, { oy: 9 * TILE - 20 });
  place('table', Sprites.props.table, 10, 7, 2, 1, { oy: 8 * TILE - 22 });
  place('chair', Sprites.props.chair, 9, 7, 1, 1, { oy: 8 * TILE - 20 });
  place('chair', Sprites.props.chair, 12, 7, 1, 1, { oy: 8 * TILE - 20 });
  place('barrel', Sprites.props.barrel, 1, 9, 1, 1, {});
  place('crate', Sprites.props.crate, 14, 9, 1, 1, {});
  place('pot', Sprites.props.pot, 14, 3, 1, 1, { solid: false });
  place('lamp', Sprites.props.lamp, 1, 4, 1, 1, { solid: false, oy: 5 * TILE - 26 });

  const npcs = [];
  NPC_DEFS.filter(function (d) { return d.map === 'tavern'; }).forEach(function (d) {
    npcs.push({
      def: d, x: d.home.x * TILE, y: d.home.y * TILE, dir: 'down',
      frame: 0, anim: 0, tx: d.home.x, ty: d.home.y, state: 'idle',
      wait: 2, talked: false, moving: false, prevX: d.home.x, prevY: d.home.y
    });
  });
  m.npcs = npcs;

  m.lights.push({ x: 48, y: 26, r: 62, c: '#ffca80', on: true });
  m.lights.push({ x: 13 * TILE + 8, y: 2 * TILE, r: 44, c: '#ffd9a0', on: true });
  m.lights.push({ x: 6 * TILE, y: 7 * TILE, r: 54, c: '#ffe0b0', on: true });
  m.lights.push({ x: 11 * TILE, y: 8 * TILE, r: 48, c: '#ffe0b0', on: true });
  m.lights.push({ x: 1 * TILE + 8, y: 5 * TILE - 14, r: 56, c: '#ffd9a0', on: true });
  return m;
}

function genHall() {
  const m = mkMap(16, 12, T.STONE);
  m.name = (typeof L === 'function') ? L('map.hall', null) !== 'map.hall' ? L('map.hall') : 'Sunvale Town Hall' : 'Sunvale Town Hall';
  for (let x = 0; x < 16; x++) { m.tiles[x] = T.WALL; m.tiles[11 * 16 + x] = T.WALL; }
  for (let y = 0; y < 12; y++) { m.tiles[y * 16] = T.WALL; m.tiles[y * 16 + 15] = T.WALL; }
  for (let y = 6; y <= 7; y++) for (let x = 6; x <= 9; x++) m.tiles[y * 16 + x] = T.RUG;

  function place(type, sprite, x, y, w, h, extra) {
    const p = baseSpriteProp(m, type, sprite, x, y, w || 1, h || 1, extra);
    p.dirty = true;
    return p;
  }

  addProp(m, {
    type: 'door', tx: 7, ty: 11, w: 1, h: 1, solid: true, interact: 'exit',
    target: 'farm', spawn: { x: 34 * TILE + 8, y: 13 * TILE }, sprite: null
  });

  place('board', Sprites.props.board, 2, 8, 2, 1, { interact: 'board', oy: 9 * TILE - 30 });
  place('shelf', Sprites.props.shelf, 1, 1, 1, 1, { oy: 2 * TILE - 22, w: 3, h: 1 });
  m.props[m.props.length - 1].w = 3;
  for (let x = 9; x <= 13; x++) {
    place('counter', Sprites.props.counter, x, 7, 1, 1, { oy: 8 * TILE - 22 });
  }
  place('register', Sprites.props.register, 11, 6, 1, 1, { oy: 7 * TILE - 14 });
  place('table', Sprites.props.table, 6, 9, 2, 1, { oy: 10 * TILE - 22 });
  place('chair', Sprites.props.chair, 5, 9, 1, 1, { oy: 10 * TILE - 20 });
  place('chair', Sprites.props.chair, 8, 9, 1, 1, { oy: 10 * TILE - 20 });
  place('barrel', Sprites.props.barrel, 14, 2, 1, 1, {});
  place('pot', Sprites.props.pot, 14, 9, 1, 1, { solid: false });
  place('pot', Sprites.props.pot, 1, 10, 1, 1, { solid: false });
  place('lamp', Sprites.props.lamp, 15, 4, 1, 1, { solid: false, oy: 5 * TILE - 26 });

  const npcs = [];
  NPC_DEFS.filter(function (d) { return d.map === 'hall'; }).forEach(function (d) {
    npcs.push({
      def: d, x: d.home.x * TILE, y: d.home.y * TILE, dir: 'down',
      frame: 0, anim: 0, tx: d.home.x, ty: d.home.y, state: 'idle',
      wait: 2, talked: false, moving: false, prevX: d.home.x, prevY: d.home.y,
      range: d.range
    });
  });
  m.npcs = npcs;

  m.lights.push({ x: 4 * TILE, y: 3 * TILE, r: 70, c: '#fff0c9', on: true });
  m.lights.push({ x: 11 * TILE, y: 3 * TILE, r: 70, c: '#fff0c9', on: true });
  m.lights.push({ x: 3 * TILE + 8, y: 8 * TILE, r: 54, c: '#ffe0b0', on: true });
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
