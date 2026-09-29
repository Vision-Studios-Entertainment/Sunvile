/* UI — all menus/HUD, drawn directly on the game canvas (no DOM UI).

   IMMEDIATE MODE: every draw function re-registers clickable rectangles via
   region(x,y,w,h,fn) while it draws; main.js routes mouse clicks to
   UI.click(), which walks regions newest-first. Consequences:
     * A widget only exists on frames where its draw* ran — hide a menu by
       not drawing it, never by disabling its callback.
     * regions reset each frame in begin() (called from UI.draw).
     * Widgets must be drawn before they can be clicked.

   Layout
     begin/region/inside/click      region plumbing + hit testing
     panel/button/slot/wrap/fit/dim shared widgets (draw + optional region)
     draw()                         per-state dispatcher — starts here when
                                    looking for a screen
     drawHUD                        bars, clock, hotbar, prompt
     drawToasts/drawTip             transient messages + item tooltips
     drawDialogue                   typewriter box (reads Game.dialogue)
     drawInventory/slotClick/drag   inventory + chest, drag to move stacks
     drawShop/drawMail              full-screen menus (state 'shop'/'mail')
      drawPause/drawSettings/drawHelp/drawTitle   overlays; drawTitle owns the
                                    title menu, drawSettings the AUDIO/GAME/
                                    CONTROLS tabs (sliders, RPC, rebinds)

   State lives in Game (state, chestOpen, helpOpen...) plus UI.settingsOpen /
   UI.capture (key rebind in progress); UI only reads it and mutates it in
   button callbacks. Keep new screens in the draw() switch AND in main.js
   onKey()'s switch, or keyboard and mouse will disagree. */

const UI = {
  regions: [], held: null, tip: null, mx: 0, my: 0,
  btn: 0, shift: false,
  helpOpen: false, selNameT: 0, lastSel: -1,
  settingsOpen: false, settingsTab: 'audio', capture: null, drag: null,
  titleSel: 0, titleItems: [], arm: { new: 0, del: 0 },
  fire: null, fireW: 0, fireH: 0, vg: null, vgH: 0,
  _prevTitle: false, _si: null, _siHas: undefined,

// ---- immediate-mode region plumbing --------------------------------

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

// ---- shared widgets ------------------------------------------------

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

  pill: function (g, x, y, w, h, on, fn) {
    const hov = this.mx >= x && this.mx < x + w && this.my >= y && this.my < y + h;
    g.fillStyle = '#0d0a07'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = hov ? '#d9b489' : '#7a5c3a'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = hov ? '#5a4530' : '#3a2c20'; g.fillRect(x, y, w, h);
    if (on) {
      g.fillStyle = 'rgba(127,208,111,0.26)'; g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = '#7fd06f'; g.fillRect(x + 1, y + h - 3, w - 2, 2);
    }
    PixelFont.shadow(g, on ? 'ON' : 'OFF', x + w / 2, y + Math.floor((h - 7) / 2),
      on ? '#7fd06f' : '#9c8a70', 1, 'center');
    this.region(x, y, w, h, fn);
    return hov;
  },

  slider: function (g, x, y, w, val, set, label) {
    PixelFont.shadow(g, label, x, y + 3, '#f0e6d0', 1);
    const tx = x + 156, tw = Math.max(40, w - 156 - 46);
    g.fillStyle = '#0d0a07'; g.fillRect(tx - 1, y, tw + 2, 14);
    g.fillStyle = '#3d2c1d'; g.fillRect(tx, y + 1, tw, 12);
    const frac = clamp(val, 0, 100) / 100;
    g.fillStyle = '#7fd06f'; g.fillRect(tx + 1, y + 2, Math.max(0, Math.round((tw - 2) * frac)), 10);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(tx + 1, y + 2, Math.max(0, Math.round((tw - 2) * frac)), 3);
    const kx = tx + 1 + Math.round((tw - 2) * frac);
    const hov = this.mx >= tx - 4 && this.mx < tx + tw + 4 && this.my >= y - 4 && this.my < y + 18;
    g.fillStyle = '#0d0a07'; g.fillRect(kx - 4, y - 2, 9, 18);
    g.fillStyle = hov || (this.drag && this.drag.set === set) ? '#f7e07a' : '#d9b489';
    g.fillRect(kx - 3, y - 1, 7, 16);
    g.fillStyle = '#f0e6d0'; g.fillRect(kx - 3, y - 1, 7, 2);
    PixelFont.shadow(g, Math.round(val) + '%', x + w, y + 3, '#f7e07a', 1, 'right');
    const self = this;
    this.region(tx - 6, y - 6, tw + 12, 26, function () {
      self.drag = { x: tx, w: tw, set: set };
      self.dragUpdate();
      AudioSys.play('select');
    });
  },

  dragUpdate: function () {
    if (!this.drag) return;
    const f = clamp((this.mx - this.drag.x) / Math.max(1, this.drag.w), 0, 1);
    this.drag.set(Math.round(f * 100));
  },

  openSettings: function () {
    this.settingsOpen = true;
    this.helpOpen = false;
    this.settingsTab = 'audio';
    this.capture = null;
    this.drag = null;
    AudioSys.play('open');
  },

  closeSettings: function () {
    this.settingsOpen = false;
    this.capture = null;
    this.drag = null;
    Settings.save();
    AudioSys.play('close');
  },

  captureKey: function (k) {
    if (k === 'escape') { this.capture = null; AudioSys.play('close'); return; }
    const action = this.capture;
    this.capture = null;
    Settings.rebind(action, k);
    AudioSys.play('coin');
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
      if (stack.fav) {
        g.fillStyle = '#ff9a94';
        g.fillRect(x + s - 9, y + 4, 3, 3);
        g.fillRect(x + s - 6, y + 4, 3, 3);
        g.fillRect(x + s - 8, y + 7, 3, 2);
        g.fillRect(x + s - 7, y + 9, 1, 1);
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

// ---- per-frame dispatcher: UI.draw(ctx, dt) ------------------------

  draw: function (g, dt) {
    const wasTitle = this._prevTitle;
    this._prevTitle = Game.state === 'title';
    this.begin();
    if (Game.state === 'title') {
      if (!wasTitle) {
        this._siHas = undefined;
        this.titleSel = 0;
        this.arm.new = 0; this.arm.del = 0;
      }
      this.drawTitle(g, dt);
      if (this.helpOpen) { this.dim(g, 0.6); this.drawHelp(g); }
      if (this.settingsOpen) { this.dim(g, 0.72); this.drawSettings(g); }
      this.drawToasts(g);
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
    else if (Game.state === 'journal') { this.dim(g); this.drawJournal(g); }
    else if (Game.state === 'cook') { this.dim(g); this.drawCook(g); }
    else if (Game.state === 'dialogue') this.drawDialogue(g);

    if (this.helpOpen) { this.dim(g, 0.6); this.drawHelp(g); }
    if (this.settingsOpen) { this.dim(g, 0.72); this.drawSettings(g); }
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

// ---- HUD: bars, clock, hotbar --------------------------------------

  drawHUD: function (g) {
    this.panel(g, 12, 12, 210, 56);
    PixelFont.shadow(g, L('day') + ' ' + Game.day + '  ' + Game.dayName(), 22, 20, '#f0e6d0', 1);
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
    PixelFont.shadow(g, L('mail'), mbx + 27, mby + 9, unread ? '#f7e07a' : '#9c8a70', 1);
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
    if (Game.state === 'play') this.drawTracker(g);
  },

  drawTracker: function (g) {
    const w = 168;
    const x = Renderer.W - w - 12, y = 86;
    const ch = Story.chapter();
    if (!ch) {
      this.panel(g, x, y, w, 34);
      PixelFont.shadow(g, 'SUNVALE LIVES!', x + 10, y + 7, '#7fd06f', 1);
      PixelFont.shadow(g, 'THE STORY IS TOLD.', x + 10, y + 20, '#9c8a70', 1);
      return;
    }
    const obj = Story.lines();
    const body = [];
    for (const ln of obj) {
      const txt = (ln.met ? '+ ' : '- ') + ln.text;
      const wl = this.wrap(txt, w - 46, 1);
      for (let k = 0; k < wl.length; k++) body.push({ t: wl[k], met: ln.met, prog: k === wl.length - 1 ? ln.prog : null });
    }
    const h = 50 + body.length * 12;
    this.panel(g, x, y, w, h);
    PixelFont.shadow(g, 'CH ' + (Story.i + 1) + '/' + STORY.length + '  [J]', x + 8, y + 6, '#a0d0f0', 1);
    PixelFont.shadow(g, this.fit(ch.title, w - 16, 1), x + 8, y + 19, '#f7e07a', 1);
    g.fillStyle = '#5a4530'; g.fillRect(x + 8, y + 31, w - 16, 1);
    for (let i = 0; i < body.length; i++) {
      const b = body[i];
      PixelFont.shadow(g, b.t, x + 8, y + 37 + i * 12, b.met ? '#7fd06f' : '#c9bba4', 1);
      if (b.prog) PixelFont.shadow(g, b.prog, x + w - 8, y + 37 + i * 12, '#f7e07a', 1, 'right');
    }
  },

  drawPrompt: function (g) {
    const t = nearestInteract();
    let text = null;
    if (t) {
      const map = {
        door: 'ENTER', exit: 'LEAVE', bed: 'SLEEP', tv: 'WATCH TV',
        chest: 'OPEN CHEST', sign: 'READ', mailbox: 'CHECK MAIL',
        shop: 'SHOP', chicken: 'PET CHICKEN', board: 'READ NOTICE BOARD',
        stove: 'COOK A DISH'
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

// ---- transient feedback: toasts + tooltips -------------------------

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

// ---- dialogue box --------------------------------------------------

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

// ---- inventory + chest ---------------------------------------------

  drawInventory: function (g) {
    const invRows = Math.ceil(Game.inv.length / 10);
    const chestRows = Game.chestOpen ? Math.ceil(Game.chest.length / 10) : 0;
    const invH = 40 + invRows * 44;
    const chestH = Game.chestOpen ? 8 + 14 + chestRows * 44 + 4 : 0;
    const w = 460, h = invH + chestH + 42;
    const x = Math.floor((Renderer.W - w) / 2);
    const y = Math.max(8, Math.floor((Renderer.H - h) / 2));
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, Game.chestOpen ? 'INVENTORY + CHEST' : 'INVENTORY', x + w / 2, y + 12, '#f7e07a', 1, 'center');

    for (let i = 0; i < Game.inv.length; i++) {
      const col = i % 10, row = Math.floor(i / 10);
      const p = this.gridPos(x, y, col, row);
      const st = Game.inv[i];
      const sel = this.held && this.held.arr === Game.inv && this.held.i === i;
      this.slot(g, p.x, p.y, 40, st, sel, null);
      if (i < 4) {
        g.fillStyle = 'rgba(247,224,122,0.5)';
        g.fillRect(p.x + 4, p.y + 4, 3, 3);
      }
      (function (idx, self) {
        self.region(p.x, p.y, 40, 40, function () {
          if (self.btn === 2) { self.slotAlt('inv', idx); return; }
          if (self.shift && Game.chestOpen) { Game.moveSlot('inv', idx); return; }
          self.slotClick(Game.inv, idx);
        });
      })(i, this);
      if (st && this.mx >= p.x && this.mx < p.x + 40 && this.my >= p.y && this.my < p.y + 40)
        this.tip = { id: st.id, n: st.n, fav: st.fav };
    }

    if (Game.chestOpen) {
      const cy = y + invH + 8;
      PixelFont.shadow(g, 'CHEST ' + Game.chest.length + ' SLOTS', x + 10, cy, '#a0d0f0', 1);
      for (let i = 0; i < Game.chest.length; i++) {
        const col = i % 10, row = Math.floor(i / 10);
        const p = { x: x + 10 + col * 44, y: cy + 14 + row * 44 };
        const st = Game.chest[i];
        const sel = this.held && this.held.arr === Game.chest && this.held.i === i;
        this.slot(g, p.x, p.y, 40, st, sel, null);
        (function (idx, self) {
          self.region(p.x, p.y, 40, 40, function () {
            if (self.btn === 2) { self.slotAlt('chest', idx); return; }
            if (self.shift) { Game.moveSlot('chest', idx); return; }
            self.slotClick(Game.chest, idx);
          });
        })(i, this);
        if (st && this.mx >= p.x && this.mx < p.x + 40 && this.my >= p.y && this.my < p.y + 40)
          this.tip = { id: st.id, n: st.n };
      }
      PixelFont.shadow(g, 'SHIFT+CLICK = QUICK MOVE   RIGHT CLICK = MOVE', x + 84, y + h - 22, '#7a6a56', 1);
    } else {
      PixelFont.shadow(g, 'RIGHT CLICK = EAT OR FAVOURITE', x + 84, y + h - 22, '#7a6a56', 1);
    }

    this.button(g, x + 10, y + h - 30, 64, 20, 'SORT', function () { Game.sortInv(); });
    this.button(g, x + w - 96, y + h - 30, 84, 20, 'CLOSE', function () {
      if (UI.held) { UI.held = null; }
      Game.chestOpen = false;
      Game.state = 'play';
      AudioSys.play('close');
    });
    this.drawTip(g);
  },

  slotAlt: function (list, i) {
    if (list === 'chest') {
      if (Game.chest[i]) Game.moveSlot('chest', i);
      return;
    }
    if (i < 4) { AudioSys.play('error'); return; }
    const s = Game.inv[i];
    if (!s) return;
    const def = ITEMS[s.id];
    if (def && def.food) { Game.eatSlot(i); return; }
    Game.toggleFav(i);
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

// ---- shop menu ------------------------------------------------------

  drawShop: function (g) {
    const w = 660, h = 448;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'GENERAL STORE', x + w / 2, y + 12, '#f7e07a', 2, 'center');
    PixelFont.shadow(g, 'JUNIPER: "TAKE YOUR PICK, FARMER."', x + w / 2, y + 34, '#c9bba4', 1, 'center');

    const tabs = [['buy', 'BUY'], ['sell', 'SELL'], ['upg', 'UPGRADES']];
    const tw = 116;
    for (let i = 0; i < tabs.length; i++) {
      (function (id, label, self) {
        const tx = x + 14 + i * (tw + 8);
        const on = Game.shopTab === id;
        const hov = self.mx >= tx && self.mx < tx + tw && self.my >= y + 48 && self.my < y + 74;
        g.fillStyle = '#0d0a07'; g.fillRect(tx - 2, y + 48, tw + 4, 26);
        g.fillStyle = (hov || on) ? '#d9b489' : '#7a5c3a'; g.fillRect(tx - 1, y + 49, tw + 2, 24);
        g.fillStyle = on ? '#4a3a26' : '#3a2c20'; g.fillRect(tx, y + 50, tw, 22);
        if (on) { g.fillStyle = '#f7e07a'; g.fillRect(tx, y + 70, tw, 2); }
        PixelFont.shadow(g, label, tx + tw / 2, y + 57, on || hov ? '#f7e07a' : '#c9bba4', 1, 'center');
        self.region(tx - 2, y + 48, tw + 4, 26, function () {
          Game.shopTab = id; AudioSys.play('select');
        });
      })(tabs[i][0], tabs[i][1], this);
    }
    g.drawImage(Sprites.ui.coin, x + w - 74, y + 52, 14, 14);
    PixelFont.shadow(g, Game.money.toLocaleString('en-US') + 'G', x + w - 16, y + 54, '#f7e07a', 1, 'right');
    g.fillStyle = '#7a5c3a';
    g.fillRect(x + 14, y + 80, w - 28, 1);

    if (Game.shopTab === 'sell') this.drawSellTab(g, x, y, w, h);
    else if (Game.shopTab === 'upg') this.drawUpgTab(g, x, y, w, h);
    else this.drawBuyTab(g, x, y, w, h);

    this.button(g, x + w - 116, y + h - 42, 104, 22, 'CLOSE [ESC]', function () {
      Game.state = 'play'; AudioSys.play('close'); Game.save();
    });
    this.drawTip(g);
  },

  drawBuyTab: function (g, x, y, w, h) {
    const stock = SHOP_STOCK;
    for (let i = 0; i < stock.length; i++) {
      const id = stock[i];
      const col = i % 2, row = Math.floor(i / 2);
      const cx = x + 14 + col * 322, cy = y + 88 + row * 76;
      const cw = 310, chh = 72;
      g.fillStyle = '#1a130e'; g.fillRect(cx, cy, cw, chh);
      g.fillStyle = '#3d2c1d'; g.fillRect(cx, cy, cw, 1);
      const isChicken = id === 'chicken';
      const icon = isChicken ? Sprites.chicken[0] : Sprites.items[id];
      if (icon) g.drawImage(icon, cx + 8, cy + 8);
      const name = isChicken ? 'CHICKEN' : ITEMS[id].n.toUpperCase();
      PixelFont.shadow(g, name, cx + 30, cy + 7, '#f0e6d0', 1);
      const price = isChicken ? 800 : ITEMS[id].buy;
      g.drawImage(Sprites.ui.coin, cx + 8, cy + 28, 12, 12);
      PixelFont.shadow(g, String(price), cx + 24, cy + 30, '#f7e07a', 1);
      const d2 = isChicken ? 'A FRIENDLY BIRD FOR THE COOP' : ITEMS[id].d.toUpperCase();
      const lines = this.wrap(d2, cw - 112, 1);
      for (let li = 0; li < lines.length && li < 2; li++)
        PixelFont.draw(g, lines[li], cx + 8, cy + 44 + li * 11, '#9c8a70', 1);
      (function (itemId, self) {
        self.button(g, cx + cw - 96, cy + 44, 88, 20, 'BUY', function () { Game.buy(itemId); });
      })(id, this);
    }
  },

  drawSellTab: function (g, x, y, w, h) {
    const groups = [];
    const seen = {};
    for (let i = 4; i < Game.inv.length; i++) {
      const s = Game.inv[i];
      if (!s) continue;
      const def = ITEMS[s.id];
      if (!def || def.sell === undefined) continue;
      if (s.fav) continue;
      if (!seen[s.id]) { seen[s.id] = { id: s.id, n: 0 }; groups.push(seen[s.id]); }
      seen[s.id].n += s.n;
    }
    if (!groups.length) {
      PixelFont.draw(g, 'NOTHING TO SELL YET.', x + 20, y + 96, '#9c8a70', 1);
      PixelFont.draw(g, 'FAVOURITED ITEMS ARE NEVER SOLD.', x + 20, y + 112, '#7a6a56', 1);
    }
    for (let i = 0; i < groups.length && i < 12; i++) {
      const gr = groups[i];
      const ry = y + 88 + i * 24;
      const def = ITEMS[gr.id];
      g.fillStyle = i % 2 ? '#1a130e' : '#20180f';
      g.fillRect(x + 14, ry, w - 28, 22);
      const icon = Sprites.items[gr.id];
      if (icon) g.drawImage(icon, x + 18, ry + 3, 16, 16);
      PixelFont.draw(g, def.n.toUpperCase() + ' X' + gr.n, x + 40, ry + 8, '#f0e6d0', 1);
      PixelFont.draw(g, (def.sell * gr.n) + 'G', x + 420, ry + 8, '#f7e07a', 1);
      (function (idx, self) {
        self.button(g, x + w - 90, ry + 2, 64, 18, 'SELL', function () {
          let total = 0;
          const id = groups[idx].id;
          for (let k = 0; k < Game.inv.length; k++) {
            const s = Game.inv[k];
            if (s && s.id === id && !s.fav) { total += ITEMS[id].sell * s.n; Game.inv[k] = null; }
          }
          if (total > 0) {
            Game.money += total;
            Story.onSell(total);
            AudioSys.play('coin');
            FX.toast('+' + total + 'G', '#f7e07a');
          }
        });
      })(i, this);
    }
    this.button(g, x + 14, y + h - 42, 150, 22, 'SELL EVERYTHING', function () { Game.sellAll(); });
    PixelFont.draw(g, 'FAVOURITED STACKS ARE SKIPPED', x + 176, y + h - 36, '#7a6a56', 1);
  },

  drawUpgTab: function (g, x, y, w, h) {
    for (let i = 0; i < UPGRADES.length; i++) {
      const u = UPGRADES[i];
      const cx = x + 14, cy = y + 88 + i * 92;
      const cw = w - 28, chh = 84;
      const owned = !!Game.upg[u.id];
      g.fillStyle = '#1a130e'; g.fillRect(cx, cy, cw, chh);
      g.fillStyle = owned ? '#2f4a33' : '#3d2c1d'; g.fillRect(cx, cy, cw, 1);
      if (owned) { g.fillStyle = 'rgba(127,208,111,0.10)'; g.fillRect(cx, cy, cw, chh); }
      PixelFont.shadow(g, u.n, cx + 12, cy + 10, owned ? '#7fd06f' : '#f0e6d0', 1);
      g.drawImage(Sprites.ui.coin, cx + 12, cy + 28, 12, 12);
      PixelFont.shadow(g, String(u.cost), cx + 28, cy + 30, owned ? '#7fd06f' : '#f7e07a', 1);
      const lines = this.wrap(u.d, cw - 140, 1);
      for (let li = 0; li < lines.length && li < 2; li++)
        PixelFont.draw(g, lines[li], cx + 12, cy + 48 + li * 12, '#9c8a70', 1);
      if (owned) {
        PixelFont.shadow(g, 'OWNED', cx + cw - 100, cy + 32, '#7fd06f', 1);
      } else {
        (function (uid, self) {
          self.button(g, cx + cw - 110, cy + 26, 96, 24, 'UPGRADE', function () { Game.buyUpgrade(uid); });
        })(u.id, this);
      }
    }
    PixelFont.draw(g, 'STEEL TOOLS CUT EVERY TOOL COST BY 1 ENERGY.', x + 20, y + 88 + 3 * 92 + 8, '#7a6a56', 1);
  },

// ---- journal + cooking ---------------------------------------------

  drawJournal: function (g) {
    const w = 660, h = 452;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.max(8, Math.floor((Renderer.H - h) / 2));
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'VILLAGE JOURNAL', x + w / 2, y + 12, '#f7e07a', 2, 'center');
    PixelFont.shadow(g, 'THE STORY OF SUNVALE', x + w / 2, y + 34, '#c9bba4', 1, 'center');
    g.fillStyle = '#7a5c3a'; g.fillRect(x + 14, y + 48, w - 28, 1);

    let ry = y + 56;
    for (let i = 0; i < STORY.length; i++) {
      const ch = STORY[i];
      const done = i < Story.i || Story.done;
      const cur = i === Story.i && !Story.done;
      const lines = cur ? Story.lines() : [];
      const rowH = cur ? 46 + lines.length * 13 : 32;
      g.fillStyle = cur ? '#2c2318' : (i % 2 ? '#1a130e' : '#20180f');
      g.fillRect(x + 14, ry, w - 28, rowH - 4);
      if (cur) { g.fillStyle = '#f7e07a'; g.fillRect(x + 14, ry, 3, rowH - 4); }
      PixelFont.shadow(g, (i + 1) + '. ' + this.fit(ch.title, 400, 1), x + 26, ry + 6,
        done ? '#7fd06f' : cur ? '#f7e07a' : '#6f6152', 1);
      PixelFont.shadow(g, done ? 'DONE' : cur ? 'NOW' : 'LOCKED', x + w - 66, ry + 6,
        done ? '#7fd06f' : cur ? '#f7e07a' : '#6f6152', 1);
      if (cur) {
        PixelFont.draw(g, this.fit(ch.desc, w - 60, 1), x + 26, ry + 20, '#c9bba4', 1);
        for (let k = 0; k < lines.length; k++) {
          const ln = lines[k];
          PixelFont.draw(g, (ln.met ? '[OK] ' : '[   ] ') + this.fit(ln.text, w - 150, 1),
            x + 34, ry + 34 + k * 13, ln.met ? '#7fd06f' : '#f0e6d0', 1);
          if (ln.prog) PixelFont.draw(g, ln.prog, x + w - 46, ry + 34 + k * 13, '#f7e07a', 1, 'right');
        }
      }
      ry += rowH;
    }
    if (Story.done) {
      PixelFont.shadow(g, 'SUNVALE LIVES! ALL CHAPTERS COMPLETE.', x + w / 2, y + h - 44, '#7fd06f', 1, 'center');
    }
    this.button(g, x + w - 116, y + h - 34, 104, 22, 'CLOSE [ESC]', function () {
      Game.state = 'play'; AudioSys.play('close');
    });
  },

  drawCook: function (g) {
    const w = 640, h = 420;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.max(8, Math.floor((Renderer.H - h) / 2));
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'THE STOVE', x + w / 2, y + 12, '#f7e07a', 2, 'center');
    PixelFont.shadow(g, 'ENERGY ' + Math.ceil(Game.energy) + '/' + MAX_ENERGY +
      '   -3 PER DISH', x + w / 2, y + 34, '#c9bba4', 1, 'center');
    g.fillStyle = '#7a5c3a'; g.fillRect(x + 14, y + 48, w - 28, 1);

    for (let i = 0; i < RECIPES.length; i++) {
      const r = RECIPES[i];
      const cx = x + 14, cy = y + 58 + i * 84;
      const cw = w - 28, chh = 78;
      const can = Game.canCook(r);
      g.fillStyle = '#1a130e'; g.fillRect(cx, cy, cw, chh);
      g.fillStyle = can ? '#3d2c1d' : '#2a2018'; g.fillRect(cx, cy, cw, 1);
      const icon = Sprites.items[r.out];
      if (icon) g.drawImage(icon, cx + 10, cy + 12);
      PixelFont.shadow(g, ITEMS[r.out].n.toUpperCase(), cx + 36, cy + 8, can ? '#f7e07a' : '#9c8a70', 1);
      PixelFont.draw(g, this.fit(ITEMS[r.out].d.toUpperCase(), 300, 1), cx + 36, cy + 22, '#9c8a70', 1);
      PixelFont.draw(g, '+' + ITEMS[r.out].food + ' ENERGY  ' + ITEMS[r.out].sell + 'G', cx + 36, cy + 34, '#7fd06f', 1);

      let ix = cx + 36;
      for (const id in r.need) {
        const have = Game.countItem(id), need = r.need[id];
        const ok = have >= need;
        const txt = ITEMS[id].n.toUpperCase() + ' ' + Math.min(have, need) + '/' + need;
        PixelFont.draw(g, txt, ix, cy + 52, ok ? '#a8e8a0' : '#e0453f', 1);
        ix += PixelFont.measure(txt, 1) + 14;
      }
      (function (rec, self) {
        self.button(g, cx + cw - 104, cy + 26, 92, 26, 'COOK', function () { Game.cookRecipe(rec); });
      })(r, this);
    }
    this.button(g, x + w - 116, y + h - 34, 104, 22, 'CLOSE [ESC]', function () {
      Game.state = 'play'; AudioSys.play('close');
    });
  },

// ---- mail menu ------------------------------------------------------

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
        const ax = pX, ay = y + 296, aw = pW, ah = 96;
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
        PixelFont.draw(g, '- NOTHING ENCLOSED -', pX, y + 318, '#7a6a56', 1);
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

// ---- pause / help / title ------------------------------------------

  drawPause: function (g) {
    const w = 300, h = 376;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, L('paused'), x + w / 2, y + 16, '#f7e07a', 2, 'center');
    const bw = 220, bx = x + (w - bw) / 2;
    let by = y + 48;
    this.button(g, bx, by, bw, 28, L('resume'), function () { Game.state = 'play'; AudioSys.play('close'); });
    by += 36;
    this.button(g, bx, by, bw, 28, 'SETTINGS', function () { UI.openSettings(); });
    by += 36;
    this.button(g, bx, by, bw, 28, L('save_game'), function () { Game.save(); FX.toast(L('msg.game_saved'), '#7fd06f'); AudioSys.play('coin'); });
    by += 36;
    this.button(g, bx, by, bw, 28, L('how_to_play'), function () { UI.helpOpen = true; AudioSys.play('open'); });
    by += 36;
    this.button(g, bx, by, bw, 28, (AudioSys.musicOn ? L('music_on') : L('music_off')), function () {
      AudioSys.toggleMusic(); AudioSys.play('select');
    });
    by += 36;
    // --- localisation: language cycler (auto-applied + persisted) ---
    const langName = (function () {
      try {
        const cur = (typeof I18n !== 'undefined') ? I18n.lang : 'en';
        const found = SUPPORTED_LANGS.find(function (l) { return l.code === cur; });
        return (found ? found.name : cur).toUpperCase();
      } catch (e) { return 'ENGLISH'; }
    })();
    this.button(g, bx, by, bw, 28, L('language') + ': ' + langName, function () { UI.cycleLang(1); AudioSys.play('select'); });
    by += 36;
    this.button(g, bx, by, bw, 28, L('quit_title'), function () {
      Game.save();
      Game.state = 'title';
      Renderer.titleCam = true;
      AudioSys.play('close');
    });
    PixelFont.shadow(g, 'FARM SEED ' + World.seed, x + w / 2, y + h - 30, '#9fe0c0', 1, 'center');
    PixelFont.shadow(g, L('progress_sleep'), x + w / 2, y + h - 16, '#9c8a70', 1, 'center');
  },

  cycleLang: function (dir) {
    try {
      const codes = SUPPORTED_LANGS.map(function (l) { return l.code; });
      let i = codes.indexOf(I18n.lang);
      if (i < 0) i = 0;
      i = (i + (dir || 1) + codes.length) % codes.length;
      I18n.setLang(codes[i]);
      try { Game.save(); } catch (e) {}
    } catch (e) {}
  },

  drawSettings: function (g) {
    const w = 584, h = 404;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.region(0, 0, Renderer.W, Renderer.H, function () { });
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'SETTINGS', x + w / 2, y + 14, '#f7e07a', 2, 'center');

    const tabs = [['audio', 'AUDIO'], ['game', 'GAME'], ['controls', 'CONTROLS']];
    const tw = 148, gap = 14;
    let tx = x + Math.floor((w - (tabs.length * tw + (tabs.length - 1) * gap)) / 2);
    for (const t of tabs) {
      const sel = this.settingsTab === t[0];
      (function (id, label, self, tx2, sel2) {
        self.button(g, tx2, y + 40, tw, 22, (sel2 ? '[' + label + ']' : label), function () {
          if (self.settingsTab !== id) { self.settingsTab = id; self.capture = null; AudioSys.play('select'); }
        });
      })(t[0], t[1], this, tx, sel);
      tx += tw + gap;
    }

    g.fillStyle = '#5a4530'; g.fillRect(x + 16, y + 70, w - 32, 1);

    const cx = x + 24, cy = y + 84, cw = w - 48;
    const self = this;
    const d = Settings.data;

    if (this.settingsTab === 'audio') {
      this.slider(g, cx, cy, cw, d.master, function (v) { Settings.setVol('master', v); }, 'MASTER VOLUME');
      this.slider(g, cx, cy + 44, cw, d.music, function (v) { Settings.setVol('music', v); }, 'MUSIC VOLUME');
      this.slider(g, cx, cy + 88, cw, d.sfx, function (v) { Settings.setVol('sfx', v); }, 'SFX VOLUME');
      PixelFont.shadow(g, 'MUSIC PLAYBACK', cx, cy + 140, '#f0e6d0', 1);
      this.pill(g, cx + cw - 70, cy + 134, 70, 20, d.musicOn, function () {
        AudioSys.toggleMusic(); AudioSys.play('select');
      });
      PixelFont.shadow(g, 'MUTE ALL AUDIO', cx, cy + 176, '#f0e6d0', 1);
      this.pill(g, cx + cw - 70, cy + 170, 70, 20, d.muted, function () {
        AudioSys.toggleMute(); AudioSys.play('select');
      });
      PixelFont.draw(g, 'DRAG THE SLIDERS TO ADJUST THE MIX LIVE.', cx, cy + 216, '#9c8a70', 1);
      PixelFont.draw(g, 'PRESS ' + Settings.keyName(d.bindings.mute) + ' IN GAME FOR A QUICK MUTE.', cx, cy + 234, '#9c8a70', 1);
    } else if (this.settingsTab === 'game') {
      PixelFont.shadow(g, 'DISCORD RICH PRESENCE', cx, cy, '#f0e6d0', 1);
      this.pill(g, cx + cw - 70, cy - 6, 70, 20, d.discordRpc, function () {
        DiscordRPC.setEnabled(!d.discordRpc);
        AudioSys.play('select');
      });
      const st = DiscordRPC.status;
      const col = st === 'ONLINE' || st === 'LAUNCHER' ? '#7fd06f' : st === 'OFF' ? '#9c8a70' : '#f0d24a';
      PixelFont.draw(g, 'BRIDGE STATUS: ' + st, cx, cy + 22, col, 1);
      PixelFont.draw(g, 'SHOWS YOUR DAY, TIME AND LOCATION TO FRIENDS.', cx, cy + 40, '#9c8a70', 1);

      PixelFont.shadow(g, 'FULLSCREEN MODE', cx, cy + 76, '#f0e6d0', 1);
      this.pill(g, cx + cw - 70, cy + 70, 70, 20, !!document.fullscreenElement, function () {
        try {
          if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
          } else if (document.exitFullscreen) document.exitFullscreen();
        } catch (e) { }
        AudioSys.play('select');
      });

      PixelFont.shadow(g, 'AUTO SAVE', cx, cy + 112, '#f0e6d0', 1);
      PixelFont.draw(g, 'ON - SAVES WHEN YOU SLEEP OR QUIT', cx + 156, cy + 112, '#7fd06f', 1);
      PixelFont.shadow(g, 'RESET EVERYTHING', cx, cy + 148, '#f0e6d0', 1);
      this.button(g, cx + 156, cy + 142, 140, 20, 'RESET SETTINGS', function () {
        Settings.reset();
        AudioSys.applyVolumes();
        DiscordRPC.setEnabled(Settings.data.discordRpc);
        AudioSys.play('error');
      });
      PixelFont.draw(g, 'RESTORES VOLUME, RPC AND ALL KEY BINDINGS.', cx, cy + 186, '#9c8a70', 1);
    } else {
      const list = Settings.ACTIONS;
      const colW = Math.floor(cw / 2) - 8;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const col = i >= 6 ? 1 : 0;
        const row = i % 6;
        const rx = cx + col * (colW + 16);
        const ry = cy + row * 28;
        const capturing = this.capture === a.id;
        g.fillStyle = capturing ? '#3f2f22' : (i % 2 ? '#1a130e' : '#20180f');
        g.fillRect(rx, ry, colW, 24);
        if (capturing) { g.fillStyle = '#f7e07a'; g.fillRect(rx, ry, 3, 24); }
        PixelFont.draw(g, this.fit(a.name, colW - 84, 1), rx + 8, ry + 8, capturing ? '#f7e07a' : '#f0e6d0', 1);
        const keyW = 76, kx = rx + colW - keyW - 4;
        g.fillStyle = '#0d0a07'; g.fillRect(kx, ry + 3, keyW, 18);
        g.fillStyle = '#5a4530'; g.fillRect(kx + 1, ry + 4, keyW - 2, 16);
        const kName = capturing ? '...' : Settings.keyName(d.bindings[a.id]);
        PixelFont.shadow(g, kName, kx + keyW / 2, ry + 9, capturing ? '#f7e07a' : '#a0d0f0', 1, 'center');
        (function (id, self) {
          self.region(rx, ry, colW, 24, function () {
            self.capture = id; self.drag = null; AudioSys.play('open');
          });
        })(a.id, this);
      }
      PixelFont.draw(g, 'CLICK A BINDING, THEN PRESS THE NEW KEY.', cx, cy + 184, '#9c8a70', 1);
      PixelFont.draw(g, 'ESC CANCELS - OLD KEY BECOMES AN ALTERNATE.', cx, cy + 202, '#9c8a70', 1);
      this.button(g, cx, cy + 224, 150, 20, 'RESET BINDINGS', function () {
        Settings.resetBindings(); AudioSys.play('error');
      });
    }

    this.button(g, x + w - 128, y + h - 34, 112, 22, 'BACK [ESC]', function () { UI.closeSettings(); });
    PixelFont.draw(g, 'SETTINGS SAVE AUTOMATICALLY', x + 20, y + h - 28, '#7a6a56', 1);

    if (this.capture) this.drawCapture(g);
  },

  drawCapture: function (g) {
    const w = 440, h = 104;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.dim(g, 0.82);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'PRESS A KEY', x + w / 2, y + 16, '#f7e07a', 2, 'center');
    PixelFont.shadow(g, Settings.actionName(this.capture), x + w / 2, y + 46, '#f0e6d0', 1, 'center');
    PixelFont.draw(g, 'ESC CANCELS THE BINDING', x + w / 2 - 66, y + 70, '#9c8a70', 1);
    const self = this;
    this.region(0, 0, Renderer.W, Renderer.H, function () { self.capture = null; AudioSys.play('close'); });
  },

  drawHelp: function (g) {
    const w = 400, h = 400;
    const x = Math.floor((Renderer.W - w) / 2), y = Math.floor((Renderer.H - h) / 2);
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'HOW TO PLAY', x + w / 2, y + 16, '#f7e07a', 2, 'center');
    let ly = y + 48;
    for (const row of Settings.helpLines()) {
      PixelFont.draw(g, row[0], x + 20, ly, '#f0d24a', 1);
      PixelFont.draw(g, row[1], x + 150, ly, '#f0e6d0', 1);
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

  titleRule: function (g, cx, y, half) {
    g.fillStyle = 'rgba(201,166,126,0.5)';
    g.fillRect(cx - half, y, half - 7, 1);
    g.fillRect(cx + 7, y, half - 7, 1);
    g.fillStyle = '#f7e07a';
    g.fillRect(cx - 1, y - 3, 3, 7);
    g.fillRect(cx - 3, y - 1, 7, 3);
    g.fillStyle = '#fff6c9';
    g.fillRect(cx, y - 1, 1, 3);
  },

  drawFireflies: function (g, dt) {
    const W = Renderer.W, H = Renderer.H;
    if (!this.fire || this.fireW !== W || this.fireH !== H) {
      this.fireW = W; this.fireH = H;
      this.fire = [];
      const n = Math.round(clamp(W * H / 40000, 14, 44));
      for (let i = 0; i < n; i++) {
        this.fire.push({
          x: Math.random() * W, y: Math.random() * H,
          s: 5 + Math.random() * 12,
          ph: Math.random() * Math.PI * 2,
          r: Math.random() < 0.3 ? 2 : 1,
          a: 0.22 + Math.random() * 0.5
        });
      }
    }
    const t = TitleT;
    for (const f of this.fire) {
      f.y -= f.s * dt;
      if (f.y < -8) { f.y = H + 8; f.x = Math.random() * W; }
      const x = f.x + Math.sin(t * 0.7 + f.ph) * 14;
      const al = f.a * (0.55 + 0.45 * Math.sin(t * 2.2 + f.ph));
      if (al <= 0.02) continue;
      g.fillStyle = 'rgba(247,224,122,' + (al * 0.20).toFixed(3) + ')';
      g.fillRect(Math.round(x) - f.r * 2, Math.round(f.y) - f.r * 2, f.r * 4, f.r * 4);
      g.fillStyle = 'rgba(255,246,201,' + al.toFixed(3) + ')';
      g.fillRect(Math.round(x), Math.round(f.y), f.r, f.r);
    }
  },

  titleSaveInfo: function () {
    if (this._siHas !== Game.hasSave) {
      this._siHas = Game.hasSave;
      this._si = null;
      if (Game.hasSave) {
        const raw = Game.peekSave();
        if (raw) {
          try {
            const d = JSON.parse(raw);
            this._si = { day: d.day || 1, money: d.money || 0 };
          } catch (e) { this._si = null; }
        }
      }
    }
    return this._si;
  },

  titleMenu: function () {
    const self = this;
    const items = [];
    const langName = (function () {
      try {
        const cur = (typeof I18n !== 'undefined') ? I18n.lang : 'en';
        const found = SUPPORTED_LANGS.find(function (l) { return l.code === cur; });
        return (found ? found.name : cur).toUpperCase();
      } catch (e) { return 'ENGLISH'; }
    })();
    if (Game.hasSave) {
      items.push({ label: (typeof L === 'function') ? L('continue') : 'CONTINUE FARM', fn: function () { self.startFarm(true); } });
      items.push({
        label: this.arm.new > 0 ? 'YES, START OVER' : ((typeof L === 'function') ? L('new') : 'NEW FARM'),
        fn: function () { self.newFarmConfirm(); }
      });
    } else {
      items.push({ label: (typeof L === 'function') ? L('start') : 'START FARM', fn: function () { self.startFarm(false); } });
    }
    items.push({ label: (typeof L === 'function') ? L('how_to_play') : 'HOW TO PLAY', fn: function () { UI.helpOpen = true; AudioSys.play('open'); } });
    items.push({ label: 'SETTINGS', fn: function () { UI.openSettings(); } });
    items.push({ label: (typeof L === 'function') ? (L('language') + ': ' + langName) : ('LANGUAGE: ' + langName), fn: function () { UI.cycleLang(1); } });
    items.push({ label: AudioSys.muted ? 'SOUND: OFF' : 'SOUND: ON', fn: function () { UI.toggleSound(); } });
    return items;
  },

  titleMove: function (d) {
    if (!this.titleItems.length) return;
    const n = this.titleItems.length;
    this.titleSel = (this.titleSel + d + n) % n;
    AudioSys.play('select');
  },

  titleActivate: function () {
    const it = this.titleItems[this.titleSel];
    if (!it) return;
    AudioSys.play('select');
    it.fn();
  },

  startFarm: function (cont) {
    AudioSys.play('open');
    if (cont) Game.continueGame(); else Game.newGame();
    Renderer.titleCam = false;
    Renderer.updateCam(1, true);
    this.arm.new = 0; this.arm.del = 0;
  },

  newFarmConfirm: function () {
    if (Game.hasSave && this.arm.new <= 0) {
      this.arm.new = 4;
      AudioSys.play('error');
      FX.toast('PRESS AGAIN TO START OVER', '#f0d24a');
      return;
    }
    this.startFarm(false);
  },

  deleteSave: function () {
    if (!Game.hasSave) return;
    if (this.arm.del <= 0) {
      this.arm.del = 4;
      AudioSys.play('error');
      FX.toast('CLICK AGAIN TO DELETE SAVE', '#e0453f');
      return;
    }
    this.arm.del = 0;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    Game.hasSave = false;
    this._siHas = undefined; this._si = null;
    AudioSys.play('close');
    FX.toast('SAVE DELETED', '#e0453f');
  },

  toggleSound: function () {
    const off = AudioSys.toggleMute();
    if (!off) AudioSys.play('select');
    FX.toast(off ? 'SOUND MUTED' : 'SOUND ON', '#f0e6d0');
  },

  drawTitle: function (g, dt) {
    const W = Renderer.W, H = Renderer.H;
    dt = dt || 0.016;
    const small = H < 560;
    if (this.arm.new > 0) this.arm.new = Math.max(0, this.arm.new - dt);
    if (this.arm.del > 0) this.arm.del = Math.max(0, this.arm.del - dt);
    const reg = !this.helpOpen;

    g.fillStyle = 'rgba(8,10,20,0.44)';
    g.fillRect(0, 0, W, H);
    if (!this.vg || this.vgH !== H) {
      this.vgH = H;
      const vg = g.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, 'rgba(5,7,14,0.74)');
      vg.addColorStop(0.30, 'rgba(5,7,14,0.06)');
      vg.addColorStop(0.70, 'rgba(5,7,14,0.28)');
      vg.addColorStop(1, 'rgba(5,7,14,0.84)');
      this.vg = vg;
    }
    g.fillStyle = this.vg;
    g.fillRect(0, 0, W, H);

    this.drawFireflies(g, dt);

    const logoS = small ? 5 : 6;
    const bob = Math.sin(TitleT * 1.5) * 4;
    const logoY = Math.round(H * (small ? 0.11 : 0.13) + bob);
    PixelFont.shadow(g, 'SUNVALE', W / 2, logoY, '#f7e07a', logoS, 'center');
    const lw = PixelFont.measure('SUNVALE', logoS);
    const prog = (TitleT * 0.5) % 2.4;
    if (prog < 1) {
      const band = logoS * 7;
      const lx = Math.round(W / 2 - lw / 2);
      g.save();
      g.beginPath();
      g.rect(Math.round(lx - band + prog * (lw + band * 2)), logoY, band, 7 * logoS);
      g.clip();
      PixelFont.draw(g, 'SUNVALE', W / 2, logoY, '#fffbe8', logoS, 'center');
      g.restore();
    }
    const subY = logoY + 7 * logoS + 9;
    PixelFont.shadow(g, 'A COZY PIXEL FARM LIFE', W / 2, subY, '#f0e6d0', 1, 'center');
    this.titleRule(g, W / 2, subY + 15, small ? 78 : 108);

    const items = this.titleMenu();
    if (this.titleSel >= items.length) this.titleSel = 0;
    this.titleItems = items;
    const info = this.titleSaveInfo();

    const panelW = Math.min(360, W - 32);
    const px = Math.floor((W - panelW) / 2);
    const bx = px + 14, bw = panelW - 28;
    const bh = small ? 30 : 34;
    const gap = small ? 6 : 8;
    const headH = info ? 26 : 0;
    const seedH = 20;
    const ph = 12 + headH + items.length * bh + (items.length - 1) * gap + 8 + seedH + gap + 14 + 12;
    const py = Math.round(H * (small ? 0.36 : 0.40));

    g.fillStyle = 'rgba(10,8,6,0.82)';
    g.fillRect(px, py, panelW, ph);
    g.fillStyle = '#7a5c3a';
    g.fillRect(px, py, panelW, 1); g.fillRect(px, py + ph - 1, panelW, 1);
    g.fillRect(px, py, 1, ph); g.fillRect(px + panelW - 1, py, 1, ph);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(px + 2, py + 2, panelW - 4, 1);
    g.fillStyle = '#d9b489';
    g.fillRect(px, py, 4, 2); g.fillRect(px, py, 2, 4);
    g.fillRect(px + panelW - 4, py, 4, 2); g.fillRect(px + panelW - 2, py, 2, 4);
    g.fillRect(px, py + ph - 2, 4, 2); g.fillRect(px, py + ph - 4, 2, 4);
    g.fillRect(px + panelW - 4, py + ph - 2, 4, 2); g.fillRect(px + panelW - 2, py + ph - 4, 2, 4);

    let iy = py + 12;
    if (info) {
      PixelFont.shadow(g, 'DAY ' + info.day, bx, iy + 2, '#f0e6d0', 1);
      const moneyTxt = info.money.toLocaleString('en-US') + 'G';
      const mw = PixelFont.measure(moneyTxt, 1);
      g.drawImage(Sprites.ui.coin, px + panelW - 16 - 14 - mw, iy, 14, 14);
      PixelFont.shadow(g, moneyTxt, px + panelW - 16, iy + 2, '#f7e07a', 1, 'right');
      PixelFont.shadow(g, 'SAVED FARM', W / 2, iy + 2, '#8f7f6a', 1, 'center');
      iy += headH;
      g.fillStyle = '#4a3a26';
      g.fillRect(px + 10, iy - 7, panelW - 20, 1);
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const hov = this.mx >= bx && this.mx < bx + bw && this.my >= iy && this.my < iy + bh;
      if (hov) this.titleSel = i;
      const on = hov || i === this.titleSel;
      g.fillStyle = '#0d0a07'; g.fillRect(bx - 2, iy - 2, bw + 4, bh + 4);
      g.fillStyle = on ? '#d9b489' : '#7a5c3a'; g.fillRect(bx - 1, iy - 1, bw + 2, bh + 2);
      g.fillStyle = on ? '#4d3a28' : '#33261b'; g.fillRect(bx, iy, bw, bh);
      if (on) {
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(bx, iy, bw, 1);
        PixelFont.draw(g, '>', bx + 9, iy + Math.floor((bh - 7) / 2), '#f7e07a', 1);
      }
      const ts = bh >= 34 ? 2 : 1;
      PixelFont.shadow(g, it.label, bx + bw / 2, iy + Math.floor((bh - 7 * ts) / 2),
        on ? '#f7e07a' : '#f0e6d0', ts, 'center');
      it.x = bx; it.y = iy; it.w = bw; it.h = bh;
      if (reg) this.region(bx, iy, bw, bh, it.fn);
      iy += bh + gap;
    }

    const sy = iy + 4;
    g.fillStyle = '#0d0a07'; g.fillRect(bx - 2, sy - 2, bw + 4, seedH + 4);
    g.fillStyle = '#7a5c3a'; g.fillRect(bx - 1, sy - 1, bw + 2, seedH + 2);
    g.fillStyle = '#2b2016'; g.fillRect(bx, sy, bw, seedH);
    PixelFont.shadow(g, 'SEED', bx + 9, sy + 7, '#f0d24a', 1);
    const fw = 118, fx = bx + 48;
    g.fillStyle = '#17120e'; g.fillRect(fx, sy + 4, fw, seedH - 8);
    g.fillStyle = '#54412c'; g.fillRect(fx, sy + 4, fw, 1);
    const st = String(Game.seedText || '');
    PixelFont.shadow(g, st, fx + 6, sy + 7, '#f7e07a', 1);
    if (Math.floor(TitleT * 2.6) % 2 === 0) {
      g.fillStyle = '#f7e07a';
      g.fillRect(fx + 8 + PixelFont.measure(st, 1), sy + 6, 2, 8);
    }
    const rw = 76, rx = bx + bw - rw - 6;
    const rhov = this.mx >= rx && this.mx < rx + rw && this.my >= sy + 1 && this.my < sy + seedH - 1;
    g.fillStyle = rhov ? '#4d3a28' : '#3a2c1e'; g.fillRect(rx, sy + 1, rw, seedH - 2);
    g.fillStyle = rhov ? '#d9b489' : '#7a5c3a'; g.fillRect(rx, sy + 1, rw, 1);
    g.fillRect(rx, sy + seedH - 2, rw, 1);
    PixelFont.shadow(g, 'RANDOM', rx + rw / 2, sy + 7, rhov ? '#f7e07a' : '#f0d24a', 1, 'center');
    if (reg) this.region(rx, sy + 1, rw, seedH - 2, function () {
      Game.rollSeed(); AudioSys.play('select'); FX.toast('SEED ' + Game.seedText, '#9fe0c0');
    });
    iy = sy + seedH + gap;

    PixelFont.shadow(g, 'ARROW KEYS + ENTER   TYPE DIGITS FOR SEED', W / 2, iy + 6, '#8f7f6a', 1, 'center');

    if (Game.hasSave) {
      const delTxt = this.arm.del > 0 ? 'CLICK AGAIN TO DELETE SAVE' : 'DELETE SAVE';
      const dw = PixelFont.measure(delTxt, 1);
      const dy = py + ph + 8;
      const hov = this.mx >= W / 2 - dw / 2 - 8 && this.mx < W / 2 + dw / 2 + 8 &&
        this.my >= dy - 4 && this.my < dy + 14;
      PixelFont.shadow(g, delTxt, W / 2, dy,
        (hov || this.arm.del > 0) ? '#e0453f' : '#8a5a54', 1, 'center');
      if (reg) this.region(W / 2 - dw / 2 - 8, dy - 4, dw + 16, 18, function () { UI.deleteSave(); });
    }

    const hintY = H - (small ? 54 : 66);
    if (py + ph + 46 < hintY) {
      PixelFont.shadow(g, Settings.hintLine1(), W / 2, hintY, '#c9bba4', 1, 'center');
      PixelFont.shadow(g, Settings.hintLine2(), W / 2, hintY + 16, '#c9bba4', 1, 'center');
    }
    PixelFont.shadow(g, 'A FAN-MADE COZY FARMING GAME', W / 2, H - 24, '#9c8a70', 1, 'center');
  }
};

