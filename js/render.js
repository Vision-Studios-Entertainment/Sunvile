/* RENDERER — draws the world every frame onto the #game canvas.

   Layout
     init/resize    canvas + offscreen `light` layer; resize also rebuilds
                    the rain drop pool (density scales with screen area)
     nightAlpha     game-minutes -> dusk tint; the only owner of the day/
                    night look (values tuned in render.js, not data.js)
     updateCam      camera follow, clamped to map bounds; `snap` jumps
                    instead of lerping (used on teleports/title)
     draw()         ORDER MATTERS: world tiles -> sorted props/entities ->
                    FX -> target mark -> lighting -> weather -> vignette.
                    A second pass would double-draw, so add new layers here
     drawX          one function per visual kind; drawChar is shared by NPCs
     drawLighting   blits `light` (multiplicative) so lamps/night read over
                    the scene

   Contracts
     * ZOOM (data.js) scales world units to screen px — the camera works in
       world units; never scale a sprite by hand, multiply by ZOOM.
     * Everything is drawn in one pass with integer-rounded positions to
       keep pixel art crisp (imageSmoothingEnabled is off).

   Called from main.js frame(): Renderer.updateCam(dt) then Renderer.draw(dt)
   then UI.draw() last, so the HUD is never covered by the world. */

const Renderer = {
  canvas: null, ctx: null, light: null, lctx: null,
  W: 0, H: 0, t: 0, cam: { x: 0, y: 0 }, snapped: false,
  drops: [], boltT: 4, boltNext: 6, drawList: [], seen: null,

// ---- setup: canvases, resize, rain pool ---------------------------

  init: function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.resize();
  },

  resize: function () {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.light.width = this.W;
    this.light.height = this.H;
    this.ctx.imageSmoothingEnabled = false;
    this.lctx.imageSmoothingEnabled = false;
    this.drops = [];
    const n = Math.floor((this.W * this.H) / 9000);
    for (let i = 0; i < n; i++) {
      this.drops.push({
        x: Math.random() * this.W, y: Math.random() * this.H,
        z: Math.random(), s: 400 + Math.random() * 500
      });
    }
  },

// ---- time of day ---------------------------------------------------

  nightAlpha: function (min) {
    if (min < 360) return 0.62;
    if (min < 540) return 0.62 * (1 - (min - 360) / 180);
    if (min < 960) return 0;
    if (min < 1140) return 0.62 * ((min - 960) / 180);
    if (min < 1260) return 0.62 + 0.16 * ((min - 1140) / 120);
    return 0.78;
  },

// ---- camera + main frame ------------------------------------------

  updateCam: function (dt, snap) {
    const map = World.map();
    const vw = this.W / ZOOM, vh = this.H / ZOOM;
    const mw = map.w * TILE, mh = map.h * TILE;
    let tx, ty;
    if (this.titleCam) {
      tx = (Math.sin(TitleT * 0.06) * 0.5 + 0.5) * Math.max(1, mw - vw);
      ty = (Math.sin(TitleT * 0.04 + 1.2) * 0.5 + 0.5) * Math.max(1, mh - vh);
    } else {
      tx = Player.x - vw / 2;
      ty = Player.y - vh / 2 - 6;
    }
    tx = mw <= vw ? (mw - vw) / 2 : clamp(tx, 0, mw - vw);
    ty = mh <= vh ? (mh - vh) / 2 : clamp(ty, 0, mh - vh);
    if (snap || !this.cam.x && !this.cam.y) { this.cam.x = tx; this.cam.y = ty; }
    else {
      const k = Math.min(1, dt * 7);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
  },

  draw: function (dt) {
    this.t += dt;
    const ctx = this.ctx;
    const map = World.map();
    const camX = Math.round(this.cam.x), camY = Math.round(this.cam.y);
    const vw = this.W / ZOOM, vh = this.H / ZOOM;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.setTransform(ZOOM, 0, 0, ZOOM, -camX * ZOOM, -camY * ZOOM);
    ctx.imageSmoothingEnabled = false;

    const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const x1 = Math.min(map.w - 1, Math.floor((camX + vw) / TILE) + 1);
    const y1 = Math.min(map.h - 1, Math.floor((camY + vh) / TILE) + 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = map.tiles[y * map.w + x];
        let sp;
        if (t === T.FENCE) {
          const hL = x > 0 && map.tiles[y * map.w + x - 1] === T.FENCE ? 1 : 0;
          const hR = x < map.w - 1 && map.tiles[y * map.w + x + 1] === T.FENCE ? 1 : 0;
          const vU = y > 0 && map.tiles[(y - 1) * map.w + x] === T.FENCE ? 1 : 0;
          const vD = y < map.h - 1 && map.tiles[(y + 1) * map.w + x] === T.FENCE ? 1 : 0;
          sp = Sprites.fence['' + (hL || hR) + (vU || vD)];
        } else if (t === T.WATER) {
          sp = Sprites.water[Math.floor(this.t * 3) % Sprites.water.length];
        } else {
          const arr = Sprites.tiles[t];
          sp = arr ? arr[(x * 7 + y * 13) % arr.length] : null;
        }
        if (sp) ctx.drawImage(sp, x * TILE, y * TILE);
      }
    }

    this.drawList.length = 0;
    if (!this.seen) this.seen = new Set();
    const seen = this.seen;
    seen.clear();

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const g = map.grid[y * map.w + x];
        if (g) for (const p of g) {
          if (seen.has(p)) continue;
          seen.add(p);
          this.drawList.push({ y: (p.ty + p.h) * TILE, p: p, k: 'prop' });
        }
        const ck = x + ',' + y;
        const cr = map.crops[ck];
        if (cr) this.drawList.push({ y: (y + 1) * TILE, cr: cr, x: x, ty: y, k: 'crop' });
      }
    }

    for (const n of map.npcs) {
      if (n.x > camX - 40 && n.x < camX + vw + 40 && n.y > camY - 60 && n.y < camY + vh + 60)
        this.drawList.push({ y: n.y, e: n, k: 'npc' });
    }
    for (const c of map.chickens) {
      this.drawList.push({ y: c.y, e: c, k: 'chicken' });
    }
    if (!this.titleCam) this.drawList.push({ y: Player.y, k: 'player' });

    this.drawList.sort(function (a, b) { return a.y - b.y; });
    for (const it of this.drawList) {
      if (it.k === 'prop') this.drawProp(it.p);
      else if (it.k === 'crop') this.drawCrop(it);
      else if (it.k === 'npc') this.drawChar(it.e, it.e.def.palette);
      else if (it.k === 'chicken') this.drawChicken(it.e);
      else if (it.k === 'player') this.drawPlayer();
    }

    this.drawFX();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.drawLighting(camX, camY, vw, vh);
    this.drawWeather(dt);
    this.drawVignette();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

// ---- world & entity drawing ---------------------------------------

  drawProp: function (p) {
    const ctx = this.ctx;
    let sp = propSprite(p);
    if (!sp) return;
    let ox = p.ox, oy = p.oy;
    if (p.type === 'tree' && p.state !== 'full') {
      ox = p.tx * TILE + Math.floor((TILE - sp.width) / 2);
      oy = (p.ty + 1) * TILE - sp.height;
    } else if (p.type === 'bush') {
      ox = p.tx * TILE + Math.floor((TILE - sp.width) / 2);
      oy = (p.ty + 1) * TILE - sp.height;
    } else if (p.type === 'rock') {
      oy = (p.ty + 1) * TILE - sp.height;
    }
    ctx.drawImage(sp, Math.round(ox), Math.round(oy));
    if (p.type === 'tree' && p.state === 'full' && p.hp < p.maxHp) {
      const tx = p.tx * TILE + 8, ty = (p.ty + 1) * TILE - 8;
      const dmg = p.maxHp - p.hp;
      for (let i = 0; i < dmg; i++) {
        ctx.fillStyle = '#3f2a18';
        ctx.fillRect(tx - 1, ty - 6 + i * 3, 3, 2);
      }
    }
    if (p.type === 'rock' && p.alive && p.hp < p.maxHp) {
      const tx = p.tx * TILE, ty = (p.ty + 1) * TILE;
      ctx.fillStyle = '#3f444b';
      ctx.fillRect(tx + 5, ty - 10, 4, 2);
      ctx.fillRect(tx + 8, ty - 7, 3, 2);
    }
    if (p.type === 'mailbox') {
      const n = Game.unreadMail();
      if (n > 0) {
        const bx = Math.round(ox + sp.width / 2);
        const by = Math.round(oy - 7 + Math.sin(this.t * 5) * 1.6);
        ctx.fillStyle = '#3d2c1d';
        ctx.fillRect(bx - 6, by - 6, 12, 12);
        ctx.fillStyle = '#e0453f';
        ctx.fillRect(bx - 5, by - 5, 10, 10);
        ctx.fillStyle = '#ff9a94';
        ctx.fillRect(bx - 5, by - 5, 10, 1);
        PixelFont.draw(ctx, n > 9 ? '9' : String(n), bx, by - 3, '#ffffff', 1, 'center');
      }
    }
  },

  drawCrop: function (it) {
    const ctx = this.ctx;
    const sp = Sprites.crops[it.cr.id][it.cr.stage];
    ctx.drawImage(sp, it.x * TILE, it.ty * TILE);
    if (it.cr.stage >= 4) {
      const ph = Math.floor(this.t * 3) % 4;
      const pts = [[3, 3], [12, 5], [6, 12], [11, 11]];
      for (let i = 0; i < 4; i++) {
        if ((ph + i) % 4 !== 0) continue;
        const p = pts[i];
        ctx.fillStyle = '#fffdf5';
        ctx.fillRect(it.x * TILE + p[0], it.ty * TILE + p[1], 1, 2);
        ctx.fillRect(it.x * TILE + p[0] - 1, it.ty * TILE + p[1] + 1, 3, 1);
      }
    }
  },

  drawShadow: function (x, y) {
    this.ctx.drawImage(Sprites.shadow, Math.round(x - 8), Math.round(y - 5));
  },

  drawPlayer: function () {
    const ctx = this.ctx;
    this.drawShadow(Player.x, Player.y);
    const sp = charSprite(Player.palette, Player.dir, Player.frame);
    const x = Math.round(Player.x - 8), y = Math.round(Player.y - 17);
    if (Player.dir === 'right') {
      ctx.save();
      ctx.translate(x + 16, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sp, 0, 0);
      ctx.restore();
    } else ctx.drawImage(sp, x, y);
    if (Player.useTimer > 0 && Player.useTool) this.drawSwing();
  },

  drawSwing: function () {
    const ctx = this.ctx;
    const icon = Sprites.items[Player.useTool];
    if (!icon) return;
    const d = DIRV[Player.dir];
    const prog = 1 - Player.useTimer / 0.3;
    const ang = -1.1 + prog * 2.2;
    const px = Player.x + d.x * 7, py = Player.y - 7 + d.y * 6;
    ctx.save();
    ctx.translate(px, py);
    let a = ang;
    if (Player.dir === 'left') a = -ang;
    if (Player.dir === 'down') a = ang;
    if (Player.dir === 'up') a = -ang;
    ctx.rotate(a);
    ctx.drawImage(icon, -2, -18, 14, 14);
    ctx.restore();
  },

  drawChar: function (e, palette) {
    const ctx = this.ctx;
    this.drawShadow(e.x, e.y);
    const sp = charSprite(palette, e.dir, e.frame);
    const x = Math.round(e.x - 8), y = Math.round(e.y - 17);
    if (e.dir === 'right') {
      ctx.save();
      ctx.translate(x + 16, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sp, 0, 0);
      ctx.restore();
    } else ctx.drawImage(sp, x, y);
  },

  drawChicken: function (c) {
    const ctx = this.ctx;
    const sp = Sprites.chicken[c.frame] || Sprites.chicken[0];
    const x = Math.round(c.x - 8), y = Math.round(c.y - 12);
    if (c.dir > 0) {
      ctx.save();
      ctx.translate(x + 16, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sp, 0, 0);
      ctx.restore();
    } else ctx.drawImage(sp, x, y);
  },

  drawFX: function () {
    const ctx = this.ctx;
    for (const p of FX.list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const h of FX.hearts) {
      ctx.globalAlpha = Math.max(0, 1 - h.t / 1.1);
      ctx.drawImage(Sprites.ui.heart, Math.round(h.x - 6), Math.round(h.y - 6));
    }
    ctx.globalAlpha = 1;
    for (const f of FX.floats) {
      const a = Math.min(1, (f.life - f.t) * 2.4);
      ctx.globalAlpha = a;
      PixelFont.shadow(ctx, f.text, Math.round(f.x), Math.round(f.y), f.col, 1, 'center');
    }
    ctx.globalAlpha = 1;
    if (Game.state === 'play') this.drawTargetMark();
  },

  drawTargetMark: function () {
    const ctx = this.ctx;
    const t = Game.frontTile();
    const key = t.x + ',' + t.y;
    const map = World.map();
    let ok = false;
    const item = Game.selItem();
    if (item) {
      const def = ITEMS[item.id];
      if (def.k === 'seed') ok = Game.canTarget2(t) && World.tileAt(null, t.x, t.y) === T.SOIL && !map.crops[key];
      else if (def.tool === 'hoe') ok = Game.canTarget2(t);
      else if (def.tool === 'can') ok = World.tileAt(null, t.x, t.y) === T.SOIL;
      else if (def.tool === 'axe' || def.tool === 'pick') {
        const g = World.propAt(null, t.x, t.y);
        ok = !!(g && g.length);
      }
    }
    if (map.crops[key] && map.crops[key].stage >= 4) ok = true;
    const x = t.x * TILE, y = t.y * TILE;
    const col = ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)';
    ctx.fillStyle = col;
    const L = 4;
    ctx.fillRect(x, y, L, 1); ctx.fillRect(x, y, 1, L);
    ctx.fillRect(x + TILE - L, y, L, 1); ctx.fillRect(x + TILE - 1, y, 1, L);
    ctx.fillRect(x, y + TILE - 1, L, 1); ctx.fillRect(x, y + TILE - L, 1, L);
    ctx.fillRect(x + TILE - L, y + TILE - 1, L, 1); ctx.fillRect(x + TILE - 1, y + TILE - L, 1, L);
  },

// ---- post passes: lighting, weather, vignette ----------------------

  drawLighting: function (camX, camY, vw, vh) {
    const a = this.nightAlpha(Game.timeMin);
    const l = this.lctx;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, this.W, this.H);
    if (a > 0.02) {
      l.fillStyle = 'rgba(10,14,44,' + a.toFixed(3) + ')';
      l.fillRect(0, 0, this.W, this.H);
      l.globalCompositeOperation = 'destination-out';
      const map = World.map();
      const lights = map.lights || [];
      for (const li of lights) {
        const sx = (li.x - camX) * ZOOM, sy = (li.y - camY) * ZOOM;
        if (sx < -li.r * ZOOM || sy < -li.r * ZOOM || sx > this.W + li.r * ZOOM || sy > this.H + li.r * ZOOM) continue;
        const r = li.r * ZOOM * (0.94 + 0.06 * Math.sin(this.t * 4 + li.x));
        const g = l.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,0.95)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = g;
        l.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
      if (!this.titleCam) {
        const sx = (Player.x - camX) * ZOOM, sy = (Player.y - 8 - camY) * ZOOM;
        const r = 64 * ZOOM;
        const g = l.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,0.9)');
        g.addColorStop(0.45, 'rgba(0,0,0,0.42)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = g;
        l.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
      l.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(this.light, 0, 0);
    }
    const sunset = Game.timeMin;
    if (sunset > 960 && sunset < 1200) {
      const k = sunset < 1080 ? (sunset - 960) / 120 : 1 - (sunset - 1080) / 120;
      this.ctx.fillStyle = 'rgba(255,150,70,' + (0.14 * k).toFixed(3) + ')';
      this.ctx.fillRect(0, 0, this.W, this.H);
    }
  },

  drawWeather: function (dt) {
    const ctx = this.ctx;
    const w = Game.weather;
    if (w === 'rain' || w === 'storm') {
      const inten = w === 'storm' ? 1.5 : 1;
      const target = Math.floor(this.drops.length * Math.min(1.4, inten));
      ctx.strokeStyle = 'rgba(170,205,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < Math.min(target, this.drops.length); i++) {
        const d = this.drops[i];
        d.y += d.s * dt;
        d.x += d.s * dt * 0.18;
        if (d.y > this.H) { d.y = -20; d.x = Math.random() * this.W; }
        if (d.x > this.W) d.x = -10;
        const len = 7 + d.z * 9;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - len * 0.2, d.y + len);
      }
      ctx.stroke();
      if (w === 'storm') {
        this.boltT -= dt;
        if (this.boltT <= 0) {
          this.boltT = this.boltNext + Math.random() * 9;
          this.boltNext = 5 + Math.random() * 9;
          FX.flash = 0.35;
          setTimeout(function () { AudioSys.play('thunder'); }, 380);
        }
      }
    }
    if (FX.flash > 0) {
      ctx.fillStyle = 'rgba(235,240,255,' + (Math.min(1, FX.flash * 2.2) * 0.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
  },

  drawVignette: function () {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35,
      this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(6,8,16,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  }
};
