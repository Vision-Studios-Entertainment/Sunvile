const UI = {
  regions: [], held: null, tip: null, mx: 0, my: 0,
  helpOpen: false, selNameT: 0, lastSel: -1,

  begin: function () { this.regions = []; this.tip = null; },

  region: function (x, y, w, h, fn) {
    this.regions.push({ x: x, y: y, w: w, h: h, fn: fn });
  },

  inside: function (r, x, y) {
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  },

  click: function (x, y) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (this.inside(r, x, y)) { r.fn(); return true; }
    }
    if (this.held) { this.held = null; AudioSys.play('close'); return true; }
    return false;
  },

  panel: function (g, x, y, w, h, fill) {
    g.fillStyle = '#0d0a07'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = '#7a5c3a'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = '#c9a67e'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#3d2c1d'; g.fillRect(x - 1, y - 1, w + 2, 1);
    g.fillStyle = fill || '#241a14'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(x, y, w, 1);
  },

  button: function (g, x, y, w, h, label, fn, scale) {
    const hov = this.mx >= x && this.mx < x + w && this.my >= y && this.my < y + h;
    g.fillStyle = '#0d0a07'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = hov ? '#d9b489' : '#7a5c3a'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = hov ? '#5a4530' : '#3a2c20'; g.fillRect(x, y, w, h);
    if (hov) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, w, 1); }
    PixelFont.shadow(g, label, x + w / 2, y + Math.floor((h - 7 * (scale || 1)) / 2),
      hov ? '#f7e07a' : '#f0e6d0', scale || 1, 'center');
    this.region(x, y, w, h, fn);
    return hov;
  },

  slot: function (g, x, y, s, stack, sel, label) {
    g.fillStyle = '#0d0a07'; g.fillRect(x, y, s, s);
    g.fillStyle = sel ? '#f7e07a' : '#5a4530'; g.fillRect(x + 1, y + 1, s - 2, s - 2);
    g.fillStyle = sel ? '#4a3a26' : '#1c150f'; g.fillRect(x + 2, y + 2, s - 4, s - 4);
    if (sel) {
      g.fillStyle = '#fff6c9';
      g.fillRect(x, y, 4, 1); g.fillRect(x, y, 1, 4);
      g.fillRect(x + s - 4, y, 4, 1); g.fillRect(x + s - 1, y, 1, 4);
      g.fillRect(x, y + s - 1, 4, 1); g.fillRect(x, y + s - 4, 1, 4);
      g.fillRect(x + s - 4, y + s - 1, 4, 1); g.fillRect(x + s - 1, y + s - 4, 1, 4);
    }
    if (stack) {
      const icon = Sprites.items[stack.id];
      const iw = icon ? icon.width : 16, ih = icon ? icon.height : 16;
      if (icon) g.drawImage(icon, Math.round(x + (s - iw) / 2), Math.round(y + (s - ih) / 2));
      if (stack.n > 1) {
        PixelFont.shadow(g, String(stack.n), x + s - 4, y + s - 9, '#ffffff', 1, 'right');
      }
      if (label) PixelFont.shadow(g, label, x + s / 2, y + s - 9, '#f7e07a', 1, 'center');
    }
  },

  wrap: function (str, maxW, scale) {
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (PixelFont.measure(test, scale) > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  },

  fit: function (str, maxW, scale) {
    str = String(str);
    scale = scale || 1;
    if (PixelFont.measure(str, scale) <= maxW) return str;
    while (str.length > 1 && PixelFont.measure(str + '..', scale) > maxW) str = str.slice(0, -1);
    return str + '..';
  },

  dim: function (g, a) {
    g.fillStyle = 'rgba(8,6,10,' + (a || 0.55) + ')';
    g.fillRect(0, 0, Renderer.W, Renderer.H);
  },

  draw: function (g, dt) {
    this.begin();
    if (Game.state === 'title') {
      this.drawTitle(g);
      this.fade(g);
      this.drawCursor(g);
      return;
    }

    this.drawHUD(g);
    if (Game.state === 'play') { this.drawPrompt(g); this.drawToasts(g); this.drawTip(g); }

    if (Game.state === 'inventory') { this.dim(g); this.drawInventory(g); }
    else if (Game.state === 'shop') { this.dim(g); this.drawShop(g); }
    else if (Game.state === 'mail') { this.dim(g); this.drawMail(g); }
    else if (Game.state === 'pause') { this.dim(g); this.drawPause(g); }
    else if (Game.state === 'dialogue') this.drawDialogue(g);

    if (this.helpOpen) { this.dim(g, 0.6); this.drawHelp(g); }
    if (this.held) this.drawHeld(g);
    this.fade(g);
    this.drawCursor(g);
  },

  fade: function (g) {
    if (Game.fade > 0.002) {
      g.fillStyle = 'rgba(4,4,10,' + Math.min(1, Game.fade).toFixed(3) + ')';
      g.fillRect(0, 0, Renderer.W, Renderer.H);
    }
  },

  drawCursor: function () { },

  drawHUD: function (g) {
    this.panel(g, 12, 12, 210, 56);
    PixelFont.shadow(g, 'DAY ' + Game.day + '  ' + Game.dayName(), 22, 20, '#f0e6d0', 1);
    PixelFont.shadow(g, Game.clockText(), 22, 36, '#f7e07a', 2);
    const wIco = Game.weather === 'sunny' ? Sprites.ui.sun : Game.weather === 'rain' ? Sprites.ui.rain : Sprites.ui.storm;
    g.drawImage(wIco, 176, 18, 20, 20);
    PixelFont.shadow(g, Game.weatherName(Game.weather), 186, 44, '#a0d0f0', 1, 'center');

    this.panel(g, Renderer.W - 172, 12, 160, 34);
    g.drawImage(Sprites.ui.coin, Renderer.W - 164, 22, 14, 14);
    PixelFont.shadow(g, Game.money.toLocaleString('en-US') + 'G', Renderer.W - 22, 24, '#f7e07a', 1, 'right');

    const mbw = 58, mbh = 26, mbx = Renderer.W - mbw - 12, mby = 52;
    const unread = Game.unreadMail();
    const mHov = this.mx >= mbx && this.mx < mbx + mbw && this.my >= mby && this.my < mby + mbh;
    g.fillStyle = '#0d0a07'; g.fillRect(mbx - 2, mby - 2, mbw + 4, mbh + 4);
    g.fillStyle = mHov ? '#d9b489' : '#7a5c3a'; g.fillRect(mbx - 1, mby - 1, mbw + 2, mbh + 2);
    g.fillStyle = mHov ? '#5a4530' : '#3a2c20'; g.fillRect(mbx, mby, mbw, mbh);
    g.drawImage(Sprites.ui.mail, mbx + 6, mby + 7);
    PixelFont.shadow(g, 'MAIL', mbx + 27, mby + 9, unread ? '#f7e07a' : '#9c8a70', 1);
    if (unread > 0) {
      g.fillStyle = '#3d2c1d'; g.fillRect(mbx + mbw - 14, mby - 7, 18, 15);
      g.fillStyle = '#e0453f'; g.fillRect(mbx + mbw - 13, mby - 6, 16, 13);
      g.fillStyle = '#ff9a94'; g.fillRect(mbx + mbw - 13, mby - 6, 16, 1);
      PixelFont.shadow(g, unread > 9 ? '9+' : String(unread), mbx + mbw - 5, mby - 2, '#ffffff', 1, 'center');
    }
    if (Game.state === 'play') {
      (function (self) {
        self.region(mbx, mby, mbw, mbh, function () { Game.openMail(); });
      })(this);
    }

    const eW = 168;
    const hideHud = Game.state === 'dialogue';
    if (!hideHud) {
      this.panel(g, 12, Renderer.H - 96, eW, 32);
      g.drawImage(Sprites.ui.bolt, 20, Renderer.H - 90, 12, 14);
      const frac = Game.energy / MAX_ENERGY;
      g.fillStyle = '#14100c'; g.fillRect(38, Renderer.H - 88, 118, 12);
      g.fillStyle = frac > 0.5 ? '#7fd06f' : frac > 0.25 ? '#f0d24a' : '#e0453f';
      g.fillRect(39, Renderer.H - 87, Math.round(116 * frac), 10);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(39, Renderer.H - 87, Math.round(116 * frac), 3);
      PixelFont.shadow(g, Math.ceil(Game.energy) + '/' + MAX_ENERGY, 97, Renderer.H - 85, '#14100c', 1, 'center');
    }

    const S = 44, gap = 3;
    const hw = 10 * S + 9 * gap;
    const hx = Math.floor((Renderer.W - hw) / 2), hy = Renderer.H - S - 12;
    if (!hideHud) for (let i = 0; i < 10; i++) {
      const x = hx + i * (S + gap);
      this.slot(g, x, hy, S, Game.inv[i], Game.selected === i, null);
      const lab = i === 9 ? '0' : String(i + 1);
      PixelFont.shadow(g, lab, x + 4, hy + 4, Game.selected === i ? '#f7e07a' : '#9c8a70', 1);
      (function (idx, self) {
        self.region(x, hy, S, S, function () {
          if (Game.state === 'play') Game.selectSlot(idx);
        });
      })(i, this);
      const st = Game.inv[i];
      if (st && this.mx >= x && this.mx < x + S && this.my >= hy && this.my < hy + S) {
        this.tip = { id: st.id, n: st.n };
      }
    }

    if (hideHud) return;
    const sel = Game.inv[Game.selected];
    const nm = sel ? ITEMS[sel.id].n.toUpperCase() : 'EMPTY HANDS';
    PixelFont.shadow(g, nm, hx + hw, hy - 14, '#f0e6d0', 1, 'right');
  },

  drawPrompt: function (g) {
    const t = nearestInteract();
    let text = null;
    if (t) {
      const map = {
        door: 'ENTER', exit: 'LEAVE', bed: 'SLEEP', tv: 'WATCH TV',
        chest: 'OPEN CHEST', sign: 'READ', mailbox: 'CHECK MAIL',
        shop: 'SHOP', chicken: 'PET CHICKEN'
      };
      if (t.kind === 'npc') {
        const def = t.npc ? t.npc.def : null;
        text = def ? 'TALK TO ' + def.name.toUpperCase() : null;
      } else if (t.kind === 'harvest') {
        const cr = t.crop ? CROPS[t.crop.id] : null;
        text = cr ? 'HARVEST ' + cr.name.toUpperCase() : 'HARVEST';
      } else       text = map[t.kind];
      if (t.kind === 'mailbox') {
        const n = Game.unreadMail();
        if (n > 0) text = 'CHECK MAIL (' + n + ' NEW)';
      }
    } else {
      const sel = Game.selItem();
      if (sel && ITEMS[sel.id].food) text = 'EAT ' + ITEMS[sel.id].n.toUpperCase();
    }
    if (!text) return;
    const w = PixelFont.measure('E - ' + text, 1) + 26;
    const x = Math.floor((Renderer.W - w) / 2), y = Renderer.H - 116;
    this.panel(g, x, y, w, 22, '#1c150f');
    g.fillStyle = '#7fd06f';
    g.fillRect(x + 6, y + 5, 12, 12);
    PixelFont.draw(g, 'E', x + 12, y + 7, '#14100c', 1, 'center');
    PixelFont.shadow(g, text, x + 24, y + 7, '#f0e6d0', 1);
  },

  drawToasts: function (g) {
    let y = 60;
    for (let i = FX.toasts.length - 1; i >= 0; i--) {
      const t = FX.toasts[i];
      const a = t.t < 0.25 ? t.t / 0.25 : t.t > t.life - 0.5 ? Math.max(0, (t.life - t.t) / 0.5) : 1;
      g.globalAlpha = a;
      const w = PixelFont.measure(t.text, 1) + 20;
      const x = Renderer.W - w - 12;
      this.panel(g, x, y, w, 20, '#1c150f');
      PixelFont.draw(g, t.text, x + 10, y + 6, t.col, 1);
      g.globalAlpha = 1;
      y += 26;
    }
    if (Game.msg && Game.msgT > 0) {
      const w = PixelFont.measure(Game.msg, 1) + 24;
      const x = Math.floor((Renderer.W - w) / 2);
      this.panel(g, x, Renderer.H - 150, w, 24, '#2a1a16');
      PixelFont.shadow(g, Game.msg, Renderer.W / 2, Renderer.H - 142, '#e0a0a0', 1, 'center');
    }
  },

  drawTip: function (g) {
    if (!this.tip) return;
    const def = ITEMS[this.tip.id];
    if (!def) return;
    let line2 = def.d.toUpperCase();
    if (def.sell !== undefined) line2 = 'SELLS FOR ' + def.sell + 'G   ' + line2;
    if (def.buy !== undefined) line2 = 'COSTS ' + def.buy + 'G   ' + line2;
    if (def.food) line2 = '+' + def.food + ' ENERGY   ' + line2;
    const w = Math.max(PixelFont.measure(def.n.toUpperCase(), 1), PixelFont.measure(line2, 1)) + 20;
    const x = clamp(this.mx + 12, 4, Renderer.W - w - 4);
    const y = clamp(this.my - 42, 4, Renderer.H - 44);
    this.panel(g, x, y, w, 34, '#1c150f');
    PixelFont.draw(g, def.n.toUpperCase(), x + 10, y + 6, '#f7e07a', 1);
    PixelFont.draw(g, line2, x + 10, y + 20, '#c9bba4', 1);
  },

  drawDialogue: function (g) {
    const d = Game.dialogue;
    if (!d) return;
    const w = Math.min(Renderer.W - 60, 720), h = 108;
    const x = Math.floor((Renderer.W - w) / 2), y = Renderer.H - h - 24;
    this.panel(g, x, y, w, h, '#1e1710');
    const port = charSprite(d.palette, 'down', 0);
    g.fillStyle = '#14100c'; g.fillRect(x + 12, y + 14, 56, 76);
    g.fillStyle = '#5a4530'; g.fillRect(x + 13, y + 15, 54, 74);
    g.fillStyle = '#2b3a2b'; g.fillRect(x + 14, y + 16, 52, 72);
    g.drawImage(port, x + 22, y + 30, port.width * 2, port.height * 2);
    const tagW = PixelFont.measure(d.name.toUpperCase(), 1) + 18;
    this.panel(g, x + 14, y - 12, tagW, 22, '#3a2c20');
    PixelFont.shadow(g, d.name.toUpperCase(), x + 23, y - 5, '#f7e07a', 1);

    if (d.npcId) {
      const fp = Game.friendshipOf(d.npcId);
      const hearts = Math.floor(fp / 20);
      const hx = x + w - 12 - 5 * 11, hy = y + 5;
      for (let i = 0; i < 5; i++) {
        if (i >= hearts) g.globalAlpha = 0.22;
        g.drawImage(Sprites.ui.heart, hx + i * 11, hy, 10, 10);
        g.globalAlpha = 1;
      }
      PixelFont.shadow(g, fp >= 100 ? 'BEST FRIENDS' : 'FRIENDSHIP', hx - 6, hy + 2, '#9c8a70', 1, 'right');
    }

    const text = d.pages[d.i].substring(0, Math.floor(d.chars));
    const lines = this.wrap(text, w - 100, 1);
    let ly = y + 18;
    for (let i = 0; i < lines.length && i < 5; i++) {
      PixelFont.draw(g, lines[i], x + 82, ly, '#f0e6d0', 1);
      ly += 13;
    }
    if (d.chars >= d.pages[d.i].length) {
      const bl = Math.floor(Game.timeMin * 2) % 2;
      if (bl) PixelFont.shadow(g, '>', x + w - 18, y + h - 16, '#f7e07a', 1);
    }
    this.region(x, y, w, h, function () { Game.advanceDialogue(); });
  },

  gridPos: function (px, py, col, row) {
    return { x: px + 10 + col * 44, y: py + 40 + row * 44 };
  },

  drawInventory: function (g) {
    const rows = Game.chestOpen ? 5 : 3;
    const w = 460, h = 40 + rows * 44 + 14;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, Game.chestOpen ? 'INVENTORY + CHEST' : 'INVENTORY', x + w / 2, y + 12, '#f7e07a', 1, 'center');

    for (let i = 0; i < 30; i++) {
      const col = i % 10, row = Math.floor(i / 10);
      const p = this.gridPos(x, y, col, row);
      const st = Game.inv[i];
      const sel = this.held && this.held.arr === Game.inv && this.held.i === i;
      this.slot(g, p.x, p.y, 40, st, sel, i < 4 ? null : null);
      if (i < 4) {
        g.fillStyle = 'rgba(247,224,122,0.5)';
        g.fillRect(p.x + 4, p.y + 4, 3, 3);
      }
      (function (idx, self) {
        self.region(p.x, p.y, 40, 40, function () { self.slotClick(Game.inv, idx); });
      })(i, this);
      if (st && this.mx >= p.x && this.mx < p.x + 40 && this.my >= p.y && this.my < p.y + 40)
        this.tip = { id: st.id, n: st.n };
    }

    if (Game.chestOpen) {
      const cy = y + 40 + 3 * 44 + 8;
      PixelFont.shadow(g, 'CHEST', x + 10, cy - 2, '#a0d0f0', 1);
      for (let i = 0; i < 20; i++) {
        const col = i % 10, row = Math.floor(i / 10);
        const p = { x: x + 10 + col * 44, y: cy + 14 + row * 44 };
        const st = Game.chest[i];
        const sel = this.held && this.held.arr === Game.chest && this.held.i === i;
        this.slot(g, p.x, p.y, 40, st, sel, null);
        (function (idx, self) {
          self.region(p.x, p.y, 40, 40, function () { self.slotClick(Game.chest, idx); });
        })(i, this);
        if (st && this.mx >= p.x && this.mx < p.x + 40 && this.my >= p.y && this.my < p.y + 40)
          this.tip = { id: st.id, n: st.n };
      }
    }
    this.button(g, x + w - 96, y + h - 4, 84, 20, 'CLOSE', function () {
      if (UI.held) { UI.held = null; }
      Game.chestOpen = false;
      Game.state = 'play';
      AudioSys.play('close');
    });
    this.drawTip(g);
  },

  slotClick: function (arr, i) {
    if (arr === Game.inv && i < 4) { AudioSys.play('error'); return; }
    if (!this.held) {
      if (arr[i]) this.held = { arr: arr, i: i };
      return;
    }
    const src = this.held;
    if (src.arr === arr && src.i === i) { this.held = null; AudioSys.play('close'); return; }
    if (src.arr === Game.inv && src.i < 4) { this.held = null; AudioSys.play('error'); return; }
    if (arr === Game.inv && i < 4) { AudioSys.play('error'); return; }
    const a = src.arr[src.i], b = arr[i];
    if (a && b && a.id === b.id) {
      const max = Game.stackMax(a.id);
      const move = Math.min(a.n, max - b.n);
      b.n += move; a.n -= move;
      if (a.n <= 0) src.arr[src.i] = null;
      if (move > 0) this.held = a.n > 0 ? src : null;
      else this.held = null;
    } else {
      src.arr[src.i] = b;
      arr[i] = a;
      this.held = null;
    }
    AudioSys.play('select');
  },

  drawHeld: function (g) {
    const st = this.held.arr[this.held.i];
    if (!st) return;
    const icon = Sprites.items[st.id];
    if (icon) {
      g.globalAlpha = 0.9;
      g.drawImage(icon, this.mx - 8, this.my - 8);
      g.globalAlpha = 1;
      if (st.n > 1) PixelFont.shadow(g, String(st.n), this.mx + 10, this.my + 4, '#ffffff', 1, 'right');
    }
  },

  drawShop: function (g) {
    const w = 660, h = 448;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'GENERAL STORE', x + w / 2, y + 14, '#f7e07a', 2, 'center');
    PixelFont.shadow(g, 'JUNIPER: "TAKE YOUR PICK, FARMER."', x + w / 2, y + 38, '#c9bba4', 1, 'center');

    g.fillStyle = '#7a5c3a';
    g.fillRect(x + 326, y + 54, 1, h - 96);
    PixelFont.shadow(g, 'BUY', x + 16, y + 56, '#7fd06f', 1);
    PixelFont.shadow(g, 'SELL', x + 344, y + 56, '#f0d24a', 1);

    const stock = SHOP_STOCK;
    for (let i = 0; i < stock.length; i++) {
      const id = stock[i];
      const col = i % 2, row = Math.floor(i / 2);
      const cx = x + 14 + col * 154, cy = y + 74 + row * 106;
      const cw = 146, chh = 98;
      g.fillStyle = '#1a130e'; g.fillRect(cx, cy, cw, chh);
      g.fillStyle = '#3d2c1d'; g.fillRect(cx, cy, cw, 1);
      const isChicken = id === 'chicken';
      const icon = isChicken ? Sprites.chicken[0] : Sprites.items[id];
      if (icon) g.drawImage(icon, cx + 6, cy + 8);
      const name = isChicken ? 'CHICKEN' : ITEMS[id].n.toUpperCase();
      PixelFont.shadow(g, name, cx + 30, cy + 8, '#f0e6d0', 1);
      const price = isChicken ? 800 : ITEMS[id].buy;
      g.drawImage(Sprites.ui.coin, cx + 30, cy + 24, 12, 12);
      PixelFont.shadow(g, String(price), cx + 46, cy + 26, '#f7e07a', 1);
      const d2 = isChicken ? 'A FRIENDLY BIRD' : ITEMS[id].d.toUpperCase();
      const lines = this.wrap(d2, cw - 12, 1);
      for (let li = 0; li < lines.length && li < 2; li++)
        PixelFont.draw(g, lines[li], cx + 6, cy + 44, '#9c8a70', 1);
      (function (itemId, self) {
        self.button(g, cx + 6, cy + chh - 24, cw - 12, 18, 'BUY', function () { Game.buy(itemId); });
      })(id, this);
    }

    const groups = [];
    const seen = {};
    for (let i = 4; i < Game.inv.length; i++) {
      const s = Game.inv[i];
      if (!s) continue;
      const def = ITEMS[s.id];
      if (!def || def.sell === undefined) continue;
      if (!seen[s.id]) { seen[s.id] = { id: s.id, n: 0 }; groups.push(seen[s.id]); }
      seen[s.id].n += s.n;
    }
    if (!groups.length) {
      PixelFont.draw(g, 'NOTHING TO SELL YET.', x + 344, y + 84, '#9c8a70', 1);
    }
    for (let i = 0; i < groups.length && i < 14; i++) {
      const gr = groups[i];
      const ry = y + 74 + i * 24;
      const def = ITEMS[gr.id];
      g.fillStyle = i % 2 ? '#1a130e' : '#20180f';
      g.fillRect(x + 344, ry, 300, 22);
      const icon = Sprites.items[gr.id];
      if (icon) g.drawImage(icon, x + 348, ry + 3, 16, 16);
      PixelFont.draw(g, def.n.toUpperCase() + ' X' + gr.n, x + 370, ry + 8, '#f0e6d0', 1);
      PixelFont.draw(g, (def.sell * gr.n) + 'G', x + 548, ry + 8, '#f7e07a', 1);
      (function (idx, self) {
        self.button(g, x + 596, ry + 2, 44, 18, 'SELL', function () {
          let total = 0;
          const id = groups[idx].id;
          for (let k = 0; k < Game.inv.length; k++) {
            const s = Game.inv[k];
            if (s && s.id === id) { total += ITEMS[id].sell * s.n; Game.inv[k] = null; }
          }
          if (total > 0) { Game.money += total; AudioSys.play('coin'); FX.toast('+' + total + 'G', '#f7e07a'); }
        });
      })(i, this);
    }

    this.button(g, x + 344, y + h - 42, 130, 22, 'SELL EVERYTHING', function () { Game.sellAll(); });
    this.button(g, x + w - 116, y + h - 42, 104, 22, 'CLOSE [ESC]', function () {
      Game.state = 'play'; AudioSys.play('close'); Game.save();
    });
    g.drawImage(Sprites.ui.coin, x + w - 74, y + 52, 14, 14);
    PixelFont.shadow(g, Game.money.toLocaleString('en-US') + 'G', x + w - 16, y + 54, '#f7e07a', 1, 'right');
    this.drawTip(g);
  },

  drawMail: function (g) {
    const w = 760, h = 448;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');

    PixelFont.shadow(g, 'MAILBOX', x + 16, y + 14, '#f7e07a', 2);
    const un = Game.unreadMail();
    PixelFont.shadow(g, un ? un + ' UNREAD' : 'ALL CAUGHT UP', x + 160, y + 18,
      un ? '#f7e07a' : '#7fd06f', 1);
    g.drawImage(Sprites.ui.mail, x + w - 34, y + 14);
    g.fillStyle = '#5a4530'; g.fillRect(x + 12, y + 36, w - 24, 1);

    const listX = x + 14, listY = y + 46, listW = 254, rowH = 34, rows = 9;
    if (!Game.mail.length) {
      PixelFont.draw(g, 'NO MAIL YET.', listX + 8, listY + 10, '#9c8a70', 1);
      PixelFont.draw(g, 'LETTERS ARRIVE', listX + 8, listY + 26, '#9c8a70', 1);
      PixelFont.draw(g, 'EACH MORNING.', listX + 8, listY + 40, '#9c8a70', 1);
    }
    let start = Math.max(0, Math.min(Game.mailSel - Math.floor(rows / 2),
      Math.max(0, Game.mail.length - rows)));
    for (let i = start; i < start + rows && i < Game.mail.length; i++) {
      const ry = listY + (i - start) * rowH;
      const sel = i === Game.mailSel;
      const m = Game.mail[i];
      g.fillStyle = sel ? '#3f2f22' : (i % 2 ? '#1a130e' : '#20180f');
      g.fillRect(listX, ry, listW, rowH - 4);
      if (sel) { g.fillStyle = '#f7e07a'; g.fillRect(listX, ry, 3, rowH - 4); }
      const tx = listX + (m.read ? 10 : 20);
      if (!m.read) { g.fillStyle = '#f7e07a'; g.fillRect(listX + 9, ry + 7, 6, 6); }
      PixelFont.draw(g, this.fit(m.from, 140), tx, ry + 5, m.read ? '#c9bba4' : '#f0e6d0', 1);
      PixelFont.draw(g, 'D' + m.day, listX + listW - 26, ry + 5, '#7a6a56', 1);
      PixelFont.draw(g, this.fit(m.subject, listW - 44), tx, ry + 17, sel ? '#f7e07a' : '#9c8a70', 1);
      if (m.att && !m.attClaimed && !m.req) g.drawImage(Sprites.ui.coin, listX + listW - 24, ry + 15, 12, 12);
      else if (m.req && !m.reqDone) {
        g.fillStyle = '#7fd06f'; g.fillRect(listX + listW - 22, ry + 17, 8, 8);
      }
      (function (idx, self) {
        self.region(listX, ry, listW, rowH - 4, function () {
          Game.mailSel = idx; Game.markRead(idx); AudioSys.play('select');
        });
      })(i, this);
    }
    PixelFont.draw(g, Game.mail.length + ' LETTER' + (Game.mail.length === 1 ? '' : 'S'),
      listX, listY + rows * rowH + 6, '#7a6a56', 1);

    const pX = x + 284, pW = w - 284 - 14;
    const m = Game.mail[Game.mailSel];
    if (!m) {
      PixelFont.draw(g, 'THE MAILBOX IS EMPTY.', pX, y + 60, '#9c8a70', 1);
      PixelFont.draw(g, 'VILLAGE REQUESTS AND GIFTS', pX, y + 80, '#9c8a70', 1);
      PixelFont.draw(g, 'ARRIVE HERE AFTER YOU SLEEP.', pX, y + 94, '#9c8a70', 1);
    } else {
      PixelFont.shadow(g, this.fit(m.subject, pW), pX, y + 48, '#f7e07a', 1);
      PixelFont.draw(g, 'FROM ' + m.from + '   DAY ' + m.day, pX, y + 64, '#9c8a70', 1);
      if (m.npc && Game.friendshipOf(m.npc) > 0) {
        const hearts = Game.friendshipHearts(m.npc);
        const hx = pX + pW - 5 * 11;
        for (let i = 0; i < 5; i++) {
          if (i >= hearts) g.globalAlpha = 0.22;
          g.drawImage(Sprites.ui.heart, hx + i * 11, y + 62, 10, 10);
          g.globalAlpha = 1;
        }
      }
      g.fillStyle = '#5a4530'; g.fillRect(pX, y + 78, pW, 1);
      let ly = y + 90;
      for (const line of m.body) {
        for (const wl of this.wrap(line, pW, 1)) {
          if (ly > y + 236) break;
          PixelFont.draw(g, wl, pX, ly, '#f0e6d0', 1);
          ly += 14;
        }
      }

      if (m.att || m.req) {
        const ax = pX, ay = y + 254, aw = pW, ah = 92;
        this.panel(g, ax, ay, aw, ah, '#1a130e');
        const bx = ax + aw - 130;
        if (m.req) {
          const r = m.req, def = ITEMS[r.item], have = Game.countItem(r.item);
          PixelFont.shadow(g, 'REQUEST FROM ' + m.from, ax + 10, ay + 9, '#7fd06f', 1);
          const icon = Sprites.items[r.item];
          if (icon) g.drawImage(icon, ax + 8, ay + 24);
          PixelFont.shadow(g, def.n.toUpperCase() + '   X' + r.n, ax + 30, ay + 26, '#f0e6d0', 1);
          PixelFont.shadow(g, 'HAVE ' + have + ' OF ' + r.n, ax + 30, ay + 42,
            have >= r.n ? '#7fd06f' : '#e0453f', 1);
          g.drawImage(Sprites.ui.coin, ax + 30, ay + 58, 12, 12);
          PixelFont.shadow(g, 'REWARD ' + r.gold + 'G', ax + 46, ay + 60, '#f7e07a', 1);
          if (m.reqDone) PixelFont.shadow(g, 'DELIVERED', bx + 60, ay + 44, '#7fd06f', 1, 'center');
          else {
            (function (letter, self) {
              self.button(g, bx, ay + ah - 30, 120, 22, have >= r.n ? 'DELIVER' : 'NEED MORE',
                function () { Game.deliverReq(letter); });
            })(m, this);
          }
        } else {
          const a = m.att;
          PixelFont.shadow(g, 'ENCLOSED WITH ' + m.from, ax + 10, ay + 9, '#f7e07a', 1);
          let iy = ay + 26;
          if (a.gold) {
            g.drawImage(Sprites.ui.coin, ax + 8, iy - 2, 14, 14);
            PixelFont.shadow(g, '+' + a.gold + 'G', ax + 30, iy + 1, '#f7e07a', 1);
            iy += 20;
          }
          if (a.item) {
            const icon = Sprites.items[a.item];
            if (icon) g.drawImage(icon, ax + 8, iy - 4);
            PixelFont.shadow(g, ITEMS[a.item].n.toUpperCase() + '   X' + a.n,
              ax + 30, iy, '#a8e8a0', 1);
          }
          if (m.attClaimed) PixelFont.shadow(g, 'TAKEN', bx + 60, ay + 44, '#9c8a70', 1, 'center');
          else {
            (function (letter, self) {
              self.button(g, bx, ay + ah - 30, 120, 22, 'CLAIM', function () { Game.claimMail(letter); });
            })(m, this);
          }
        }
      } else {
        PixelFont.draw(g, '- NOTHING ENCLOSED -', pX, y + 276, '#7a6a56', 1);
      }
    }

    this.button(g, x + 14, y + h - 30, 96, 22, 'DELETE', function () {
      Game.deleteMail(Game.mailSel);
    });
    PixelFont.draw(g, 'ENTER CLAIMS OR DELIVERS', x + 124, y + h - 24, '#7a6a56', 1);
    this.button(g, x + w - 124, y + h - 30, 110, 22, 'CLOSE [ESC]', function () {
      Game.closeMail();
    });
    this.drawTip(g);
  },

  drawPause: function (g) {
    const w = 300, h = 268;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'PAUSED', x + w / 2, y + 16, '#f7e07a', 2, 'center');
    const bw = 220, bx = x + (w - bw) / 2;
    let by = y + 52;
    this.button(g, bx, by, bw, 28, 'RESUME', function () { Game.state = 'play'; AudioSys.play('close'); });
    by += 38;
    this.button(g, bx, by, bw, 28, 'SAVE GAME', function () { Game.save(); FX.toast('GAME SAVED', '#7fd06f'); AudioSys.play('coin'); });
    by += 38;
    this.button(g, bx, by, bw, 28, 'HOW TO PLAY', function () { UI.helpOpen = true; AudioSys.play('open'); });
    by += 38;
    this.button(g, bx, by, bw, 28, (AudioSys.musicOn ? 'MUSIC: ON' : 'MUSIC: OFF'), function () {
      AudioSys.toggleMusic(); AudioSys.play('select');
    });
    by += 38;
    this.button(g, bx, by, bw, 28, 'QUIT TO TITLE', function () {
      Game.save();
      Game.state = 'title';
      Renderer.titleCam = true;
      AudioSys.play('close');
    });
    PixelFont.shadow(g, 'PROGRESS SAVES WHEN YOU SLEEP', x + w / 2, y + h - 16, '#9c8a70', 1, 'center');
  },

  drawHelp: function (g) {
    const w = 400, h = 372;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'HOW TO PLAY', x + w / 2, y + 16, '#f7e07a', 2, 'center');
    let ly = y + 48;
    for (const line of HELP_LINES) {
      const parts = line.split(/\s{2,}/);
      PixelFont.draw(g, parts[0], x + 20, ly, '#f0d24a', 1);
      PixelFont.draw(g, parts[1] || '', x + 150, ly, '#f0e6d0', 1);
      ly += 18;
    }
    ly += 6;
    const tips = [
      'USE THE HOE ON GRASS IN YOUR FIELD,',
      'PLANT SEEDS, THEN WATER EVERY DAY.',
      'SLEEP IN YOUR BED TO ADVANCE THE DAY.',
      'SELL CROPS AT THE GENERAL STORE.',
      'EATING FOOD RESTORES ENERGY.',
      'TALK DAILY AND GIFT CROPS FOR HEARTS.',
      'READ YOUR MAIL FOR VILLAGE REQUESTS.'
    ];
    for (const t of tips) {
      PixelFont.draw(g, t, x + 20, ly, '#9c8a70', 1);
      ly += 14;
    }
    this.button(g, x + w / 2 - 50, y + h - 30, 100, 20, 'CLOSE', function () {
      UI.helpOpen = false; AudioSys.play('close');
    });
  },

  drawTitle: function (g) {
    const W = Renderer.W, H = Renderer.H;
    g.fillStyle = 'rgba(8,10,20,0.42)';
    g.fillRect(0, 0, W, H);
    const bob = Math.sin(TitleT * 1.6) * 4;
    PixelFont.shadow(g, 'SUNVALE', W / 2, H * 0.22 + bob, '#f7e07a', 6, 'center');
    PixelFont.shadow(g, 'A COZY PIXEL FARM LIFE', W / 2, H * 0.22 + 54 + bob, '#f0e6d0', 1, 'center');

    const bw = 260, bx = Math.floor((W - bw) / 2);
    let by = Math.floor(H * 0.5);
    if (Game.hasSave) {
      this.button(g, bx, by, bw, 34, 'CONTINUE FARM', function () {
        Game.continueGame();
        Renderer.titleCam = false;
        Renderer.updateCam(1, true);
      }, 2);
      by += 48;
      this.button(g, bx, by, bw, 34, 'NEW FARM', function () {
        Game.newGame();
        Renderer.titleCam = false;
        Renderer.updateCam(1, true);
      }, 2);
    } else {
      this.button(g, bx, by, bw, 38, 'START FARM', function () {
        Game.newGame();
        Renderer.titleCam = false;
        Renderer.updateCam(1, true);
      }, 2);
    }
    by += 62;
    PixelFont.shadow(g, 'WASD MOVE   E INTERACT   SPACE USE TOOL', W / 2, by, '#c9bba4', 1, 'center');
    by += 16;
    PixelFont.shadow(g, 'I INVENTORY   H HELP   M MUSIC   ESC PAUSE', W / 2, by, '#c9bba4', 1, 'center');
    PixelFont.shadow(g, 'A FAN-MADE COZY FARMING GAME', W / 2, H - 28, '#9c8a70', 1, 'center');
  }
};
