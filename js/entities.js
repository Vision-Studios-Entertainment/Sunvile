const Player = {
  x: 10 * TILE + 8, y: 14 * TILE, dir: 'down', frame: 0, anim: 0,
  moving: false, palette: 'player', useTimer: 0, useTool: null, run: false,
  box: { w: 10, h: 12 },

  front: function () {
    const d = DIRV[this.dir];
    const tx = Math.floor(this.x / TILE), ty = Math.floor(this.y / TILE);
    return { x: (tx + d.x) * TILE + 8, y: (ty + d.y) * TILE + 8 };
  },

  update: function (dt) {
    if (this.useTimer > 0) this.useTimer -= dt;
    let dx = 0, dy = 0;
    if (Input.down('left')) dx -= 1;
    if (Input.down('right')) dx += 1;
    if (Input.down('up')) dy -= 1;
    if (Input.down('down')) dy += 1;
    this.run = Input.down('run');
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      const sp = (this.run ? RUN : WALK) * dt;
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right';
      else if (dy) this.dir = dy < 0 ? 'up' : 'down';
      this.move(dx * sp, dy * sp);
      this.moving = true;
      this.anim += dt * (this.run ? 11 : 8);
      this.frame = [0, 1, 0, 2][Math.floor(this.anim) % 4];
    } else {
      this.moving = false;
      this.anim = 0;
      this.frame = 0;
    }
  },

  move: function (dx, dy) {
    const map = World.current;
    if (dx) {
      const nx = this.x + dx;
      if (!this.hits(nx, this.y)) this.x = nx;
    }
    if (dy) {
      const ny = this.y + dy;
      if (!this.hits(this.x, ny)) this.y = ny;
    }
    const m = World.map();
    this.x = clamp(this.x, 8, m.w * TILE - 8);
    this.y = clamp(this.y, 14, m.h * TILE - 4);
  },

  hits: function (cx, cy) {
    const x0 = cx - this.box.w / 2, x1 = cx + this.box.w / 2;
    const y0 = cy - this.box.h, y1 = cy - 1;
    const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor(x1 / TILE);
    const ty0 = Math.floor(y0 / TILE), ty1 = Math.floor(y1 / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (World.solidTile(null, tx, ty)) return true;
      }
    }
    return false;
  },

  unstick: function () {
    if (!this.hits(this.x, this.y)) return;
    const m = World.map();
    const cx = Math.floor(this.x / TILE), cy = Math.floor(this.y / TILE);
    for (let r = 1; r <= Math.max(m.w, m.h); r++) {
      for (let ty = cy - r; ty <= cy + r; ty++) {
        for (let tx = cx - r; tx <= cx + r; tx++) {
          if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) !== r) continue;
          if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
          const x = tx * TILE + 8, y = (ty + 1) * TILE;
          if (y < 14 || y > m.h * TILE - 4) continue;
          if (this.hits(x, y)) continue;
          this.x = x; this.y = y;
          return;
        }
      }
    }
  }
};

const DIRV = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

const FX = {
  list: [], floats: [], toasts: [], hearts: [], rain: [], splashes: [], lightning: 0, flash: 0,

  clear: function () {
    this.list = []; this.floats = []; this.rain = []; this.splashes = [];
    this.hearts = [];
  },

  burst: function (x, y, col, n, spread, life, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * spread;
      this.list.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spread * 0.5,
        life: life * (0.6 + Math.random() * 0.7), max: life,
        col: col, size: 1 + ((Math.random() * 2) | 0), grav: grav === undefined ? 220 : grav
      });
    }
  },

  float: function (x, y, text, col) {
    this.floats.push({ x: x, y: y, text: text, col: col || '#ffffff', t: 0, life: 1.4 });
  },

  toast: function (text, col) {
    this.toasts.push({ text: text, col: col || '#f0e6d0', t: 0, life: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  },

  update: function (dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      f.y -= 22 * dt;
      if (f.t >= f.life) this.floats.splice(i, 1);
    }
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t += dt;
      if (this.toasts[i].t >= this.toasts[i].life) this.toasts.splice(i, 1);
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.t += dt; h.y -= 20 * dt;
      if (h.t > 1.1) this.hearts.splice(i, 1);
    }
    if (this.flash > 0) this.flash -= dt;
  }
};

function walkNPC(e, dt, range, speed) {
  if (e.state === 'idle') {
    e.wait -= dt;
    e.frame = 0; e.moving = false;
    if (e.wait <= 0) {
      const tx = range.x0 + ((Math.random() * (range.x1 - range.x0 + 1)) | 0);
      const ty = range.y0 + ((Math.random() * (range.y1 - range.y0 + 1)) | 0);
      if (!World.solidTile(null, tx, ty)) {
        e.tx = tx; e.ty = ty; e.state = 'walk';
      }
      e.wait = 1 + Math.random() * 3;
    }
    return;
  }
  const gx = e.tx * TILE + TILE / 2, gy = e.ty * TILE + TILE / 2;
  const dx = gx - e.x, dy = gy - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) { e.state = 'idle'; e.wait = 1.5 + Math.random() * 3; e.moving = false; e.frame = 0; return; }
  const s = speed * dt;
  const mx = (dx / d) * s, my = (dy / d) * s;
  const before = { x: e.x, y: e.y };
  if (Math.abs(dx) > Math.abs(dy)) e.dir = dx < 0 ? 'left' : 'right';
  else e.dir = dy < 0 ? 'up' : 'down';
  e.x += mx; e.y += my;
  if (Math.hypot(e.x - before.x, e.y - before.y) < s * 0.35) {
    e.state = 'idle'; e.wait = 1 + Math.random() * 2;
  }
  e.moving = true;
  e.anim += dt * 7;
  e.frame = [0, 1, 0, 2][Math.floor(e.anim) % 4];
  e.x = clamp(e.x, TILE, World.map().w * TILE - TILE);
  e.y = clamp(e.y, TILE, World.map().h * TILE - TILE);
}

function updateNPCs(dt) {
  const m = World.map();
  for (const n of m.npcs) {
    const range = n.range || n.def.range;
    if (n.def.id === 'juniper') { n.moving = false; n.frame = 0; continue; }
    walkNPC(n, dt, range, 26);
  }
}

function updateChickens(dt) {
  const m = World.map();
  for (const c of m.chickens) {
    if (c.state === 'idle') {
      c.wait -= dt; c.moving = false; c.frame = 0;
      if (c.wait <= 0) {
        const tx = 39 + ((Math.random() * 9) | 0);
        const ty = 24 + ((Math.random() * 6) | 0);
        if (!World.solidTile(null, tx, ty)) { c.tx = tx; c.ty = ty; c.state = 'walk'; }
        c.wait = 1 + Math.random() * 3;
      }
      if (Math.random() < dt * 0.5) c.frame = 2;
      continue;
    }
    const gx = c.tx * TILE + 8, gy = c.ty * TILE + 10;
    const dx = gx - c.x, dy = gy - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) { c.state = 'idle'; c.wait = 1 + Math.random() * 2.5; c.moving = false; c.frame = 0; continue; }
    const s = 24 * dt;
    c.x += (dx / d) * s; c.y += (dy / d) * s;
    c.dir = dx < 0 ? -1 : 1;
    c.moving = true;
    c.anim += dt * 8;
    c.frame = [0, 1, 0, 2][Math.floor(c.anim) % 4];
  }
}

function nearestInteract() {
  const f = Player.front();
  const tx = Math.floor(f.x / TILE), ty = Math.floor(f.y / TILE);
  const grid = World.propAt(null, tx, ty);
  if (grid) {
    for (const p of grid) if (p.interact) return { kind: p.interact, prop: p };
  }
  const m = World.map();
  const ckey = tx + ',' + ty;
  if (World.current === 'farm' && m.crops[ckey]) {
    const cr = m.crops[ckey];
    if (cr.stage >= 4) return { kind: 'harvest', x: tx, y: ty, crop: cr };
  }
  for (const n of m.npcs) {
    if (Math.hypot(n.x - Player.x, n.y - Player.y) < 26) return { kind: 'npc', npc: n };
  }
  for (const c of m.chickens) {
    if (Math.hypot(c.x - Player.x, c.y - Player.y) < 22) return { kind: 'chicken', chicken: c };
  }
  return null;
}

function charSprite(pal, dir, frame) {
  const set = Sprites.player[pal] || Sprites.player.player;
  if (dir === 'up') return set.up[frame];
  if (dir === 'down') return set.down[frame];
  return set.side[frame];
}
