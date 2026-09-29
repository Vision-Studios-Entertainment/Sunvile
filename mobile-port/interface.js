/* ------------------------------------------------------------------
   Sunvale mobile port - phone interface
   Re-draws the HUD and every menu so it fits a phone screen and can
   be tapped comfortably. Only runs when MobilePort.on is true.
------------------------------------------------------------------- */
(function () {
  if (!window.MobilePort || !MobilePort.on) return;
  var M = MobilePort;

  function W() { return Renderer.W; }
  function H() { return Renderer.H; }
  function cen(w) { return Math.floor((W() - w) / 2); }
  function portrait() { return H() >= W(); }

  // Top edge of the touch control zone (kept in sync with mobile.css).
  function barTop() {
    return (M.shown && M.metrics) ? H() - M.metrics.bar : H() - 8;
  }

  function listTop() { return M.layout.hy || (H() - 60); }

  function chevron(g, x, y, s, right, col) {
    PixelFont.draw(g, right ? '>' : '<', x + Math.floor(s / 2),
      y + Math.floor((s - 14) / 2), col, 2, 'center');
  }

  /* ---------------------------------------------------------------- */
  /* HUD                                                               */
  /* ---------------------------------------------------------------- */

  UI.drawHUD = function (g) {
    var hideHud = Game.state === 'dialogue';

    // status panel - top left
    var pw = 176, ph = 66, px = 8, py = 8;
    this.panel(g, px, py, pw, ph);
    PixelFont.shadow(g, 'DAY ' + Game.day + ' ' + Game.dayName(), px + 8, py + 7, '#f0e6d0', 1);
    PixelFont.shadow(g, Game.clockText(), px + 8, py + 21, '#f7e07a', 2);
    var wIco = Game.weather === 'sunny' ? Sprites.ui.sun : Game.weather === 'rain' ? Sprites.ui.rain : Sprites.ui.storm;
    g.drawImage(wIco, px + pw - 32, py + 8, 22, 22);
    PixelFont.shadow(g, Game.weatherName(Game.weather), px + pw - 8, py + 34, '#a0d0f0', 1, 'right');

    // energy - bottom of the status panel
    g.drawImage(Sprites.ui.bolt, px + 8, py + 44, 12, 14);
    var frac = Game.energy / MAX_ENERGY;
    var bx = px + 26, bw = pw - 34, by = py + 46;
    g.fillStyle = '#14100c'; g.fillRect(bx, by, bw, 12);
    g.fillStyle = frac > 0.5 ? '#7fd06f' : frac > 0.25 ? '#f0d24a' : '#e0453f';
    g.fillRect(bx + 1, by + 1, Math.round((bw - 2) * frac), 10);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(bx + 1, by + 1, Math.round((bw - 2) * frac), 3);
    PixelFont.shadow(g, Math.ceil(Game.energy) + '/' + MAX_ENERGY, bx + bw - 3, by + 2, '#14100c', 1, 'right');

    // gold - top right
    var mw = 118, mh = 32, mx = W() - mw - 8, my = 8;
    this.panel(g, mx, my, mw, mh);
    g.drawImage(Sprites.ui.coin, mx + 8, my + 9, 14, 14);
    PixelFont.shadow(g, Game.money.toLocaleString('en-US') + 'G', mx + mw - 8, my + 11, '#f7e07a', 1, 'right');

    // mail button
    var mbw = 56, mbh = 28, mbx = W() - mbw - 8, mby = my + mh + 6;
    var unread = Game.unreadMail();
    var hov = this.mx >= mbx && this.mx < mbx + mbw && this.my >= mby && this.my < mby + mbh;
    g.fillStyle = '#0d0a07'; g.fillRect(mbx - 2, mby - 2, mbw + 4, mbh + 4);
    g.fillStyle = hov ? '#d9b489' : '#7a5c3a'; g.fillRect(mbx - 1, mby - 1, mbw + 2, mbh + 2);
    g.fillStyle = hov ? '#5a4530' : '#3a2c20'; g.fillRect(mbx, mby, mbw, mbh);
    g.drawImage(Sprites.ui.mail, mbx + 6, mby + 8);
    PixelFont.shadow(g, 'MAIL', mbx + 26, mby + 10, unread ? '#f7e07a' : '#9c8a70', 1);
    if (unread > 0) {
      g.fillStyle = '#3d2c1d'; g.fillRect(mbx + mbw - 14, mby - 7, 18, 15);
      g.fillStyle = '#e0453f'; g.fillRect(mbx + mbw - 13, mby - 6, 16, 13);
      g.fillStyle = '#ff9a94'; g.fillRect(mbx + mbw - 13, mby - 6, 16, 1);
      PixelFont.shadow(g, unread > 9 ? '9+' : String(unread), mbx + mbw - 5, mby - 2, '#ffffff', 1, 'center');
    }
    if (Game.state === 'play') this.region(mbx, mby, mbw, mbh, function () { Game.openMail(); });

    if (hideHud) return;

    // hotbar - five slots a page, sitting on top of the thumb zone
    var S = 46, gap = 4, n = 5, arrow = 26;
    var hw = n * S + (n - 1) * gap + arrow * 2;
    var hx = cen(hw), hy = barTop() - S - 10;
    var page = Game.selected < 5 ? 0 : 1;
    M.layout = { hx: hx, hy: hy, hw: hw, S: S };

    // selected item name
    var sel = Game.inv[Game.selected];
    var nm = sel ? ITEMS[sel.id].n.toUpperCase() : 'EMPTY HANDS';
    PixelFont.shadow(g, nm, hx + hw, hy - 14, '#f0e6d0', 1, 'right');

    for (var i = 0; i < n; i++) {
      var idx = page * 5 + i;
      var sx = hx + arrow + i * (S + gap);
      this.slot(g, sx, hy, S, Game.inv[idx], Game.selected === idx, null);
      PixelFont.shadow(g, idx === 9 ? '0' : String(idx + 1), sx + 4, hy + 4,
        Game.selected === idx ? '#f7e07a' : '#9c8a70', 1);
      (function (slotIdx, self) {
        self.region(sx, hy, S, S, function () {
          if (Game.state === 'play') Game.selectSlot(slotIdx);
        });
      })(idx, this);
      var st = Game.inv[idx];
      if (st && this.mx >= sx && this.mx < sx + S && this.my >= hy && this.my < hy + S) {
        this.tip = { id: st.id, n: st.n };
      }
    }

    // page arrows
    var ay = hy + Math.floor((S - arrow) / 2);
    arrowBtn(g, this, hx, ay, arrow, false, page > 0, function () {
      if (Game.state === 'play' && page === 1) Game.selectSlot(0);
    });
    arrowBtn(g, this, hx + hw - arrow, ay, arrow, true, page < 1, function () {
      if (Game.state === 'play' && page === 0) Game.selectSlot(5);
    });

    function arrowBtn(gg, self, ax, ay2, s, right, enabled, fn) {
      gg.fillStyle = '#0d0a07'; gg.fillRect(ax, ay2, s, s);
      gg.fillStyle = '#5a4530'; gg.fillRect(ax + 1, ay2 + 1, s - 2, s - 2);
      gg.fillStyle = '#1c150f'; gg.fillRect(ax + 2, ay2 + 2, s - 4, s - 4);
      chevron(gg, ax, ay2, s, right, enabled ? '#f0e6d0' : '#6a5f52');
      self.region(ax, ay2, s, s, fn);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Context prompt                                                    */
  /* ---------------------------------------------------------------- */

  UI.drawPrompt = function (g) {
    var t = nearestInteract();
    var text = null;
    if (t) {
      var map = {
        door: 'ENTER', exit: 'LEAVE', bed: 'SLEEP', tv: 'WATCH TV',
        chest: 'OPEN CHEST', sign: 'READ', mailbox: 'CHECK MAIL',
        shop: 'SHOP', chicken: 'PET CHICKEN'
      };
      if (t.kind === 'npc') {
        var def = t.npc ? t.npc.def : null;
        text = def ? 'TALK TO ' + def.name.toUpperCase() : null;
      } else if (t.kind === 'harvest') {
        var cr = t.crop ? CROPS[t.crop.id] : null;
        text = cr ? 'HARVEST ' + cr.name.toUpperCase() : 'HARVEST';
      } else text = map[t.kind];
      if (t.kind === 'mailbox') {
        var n = Game.unreadMail();
        if (n > 0) text = 'CHECK MAIL (' + n + ' NEW)';
      }
    } else {
      var s2 = Game.selItem();
      if (s2 && ITEMS[s2.id].food) text = 'EAT ' + ITEMS[s2.id].n.toUpperCase();
    }
    if (!text) return;
    var w = PixelFont.measure('A - ' + text, 1) + 30;
    var x = cen(w), y = listTop() - 44;
    this.panel(g, x, y, w, 22, '#1c150f');
    g.fillStyle = '#7fd06f';
    g.fillRect(x + 6, y + 4, 14, 14);
    PixelFont.draw(g, 'A', x + 13, y + 7, '#14100c', 1, 'center');
    PixelFont.shadow(g, text, x + 26, y + 7, '#f0e6d0', 1);
  };

  /* ---------------------------------------------------------------- */
  /* Toasts / messages                                                 */
  /* ---------------------------------------------------------------- */

  UI.drawToasts = function (g) {
    var y = 86;
    for (var i = FX.toasts.length - 1; i >= 0; i--) {
      var t = FX.toasts[i];
      var a = t.t < 0.25 ? t.t / 0.25 : t.t > t.life - 0.5 ? Math.max(0, (t.life - t.t) / 0.5) : 1;
      g.globalAlpha = a;
      var w = Math.min(W() - 24, PixelFont.measure(t.text, 1) + 20);
      var x = W() - w - 8;
      this.panel(g, x, y, w, 20, '#1c150f');
      PixelFont.draw(g, t.text, x + 10, y + 6, t.col, 1);
      g.globalAlpha = 1;
      y += 26;
    }
    if (Game.msg && Game.msgT > 0) {
      var mw = Math.min(W() - 24, PixelFont.measure(Game.msg, 1) + 24);
      this.panel(g, cen(mw), listTop() - 78, mw, 24, '#2a1a16');
      PixelFont.shadow(g, Game.msg, W() / 2, listTop() - 70, '#e0a0a0', 1, 'center');
    }
  };

  /* ---------------------------------------------------------------- */
  /* Dialogue                                                          */
  /* ---------------------------------------------------------------- */

  UI.drawDialogue = function (g) {
    var d = Game.dialogue;
    if (!d) return;
    var w = Math.min(W() - 20, 700), h = 116;
    var x = cen(w);
    var y = H() - ((M.shown && M.metrics) ? M.metrics.bar : 8) - h - 8;
    this.panel(g, x, y, w, h, '#1e1710');
    var port = charSprite(d.palette, 'down', 0);
    g.fillStyle = '#14100c'; g.fillRect(x + 12, y + 16, 56, 76);
    g.fillStyle = '#5a4530'; g.fillRect(x + 13, y + 17, 54, 74);
    g.fillStyle = '#2b3a2b'; g.fillRect(x + 14, y + 18, 52, 72);
    g.drawImage(port, x + 22, y + 32, port.width * 2, port.height * 2);
    var tagW = PixelFont.measure(d.name.toUpperCase(), 1) + 18;
    this.panel(g, x + 14, y - 12, tagW, 22, '#3a2c20');
    PixelFont.shadow(g, d.name.toUpperCase(), x + 23, y - 5, '#f7e07a', 1);

    if (d.npcId) {
      var fp = Game.friendshipOf(d.npcId);
      var hearts = Math.floor(fp / 20);
      var hx = x + w - 12 - 5 * 11, hy = y + 6;
      for (var i = 0; i < 5; i++) {
        if (i >= hearts) g.globalAlpha = 0.22;
        g.drawImage(Sprites.ui.heart, hx + i * 11, hy, 10, 10);
        g.globalAlpha = 1;
      }
      PixelFont.shadow(g, fp >= 100 ? 'BEST FRIENDS' : 'FRIENDSHIP', hx - 6, hy + 2, '#9c8a70', 1, 'right');
    }

    var text = d.pages[d.i].substring(0, Math.floor(d.chars));
    var lines = this.wrap(text, w - 96, 1);
    var ly = y + 20;
    for (var j = 0; j < lines.length && j < 5; j++) {
      PixelFont.draw(g, lines[j], x + 80, ly, '#f0e6d0', 1);
      ly += 14;
    }
    if (d.chars >= d.pages[d.i].length) {
      var bl = Math.floor(Game.timeMin * 2) % 2;
      if (bl) PixelFont.shadow(g, '>', x + w - 18, y + h - 16, '#f7e07a', 1);
    }
    this.region(x, y, w, h, function () { Game.advanceDialogue(); });
  };

  /* ---------------------------------------------------------------- */
  /* Inventory                                                         */
  /* ---------------------------------------------------------------- */

  UI.drawInventory = function (g) {
    var port = portrait();
    var cols = port ? 6 : 10;
    var gap = 6;
    var availW = Math.min(W() - 16, port ? 372 : 640);
    var slot = Math.floor((availW - 24 - gap * (cols - 1)) / cols);
    if (slot > 46) slot = 46;
    if (slot < 24) slot = 24;
    var cell = slot + gap;
    var w = cols * slot + (cols - 1) * gap + 24;
    var top = 34;
    var invRows = Math.ceil(30 / cols);
    var chestY = 0, chestRows = 0;
    var h = top + invRows * cell + 14;
    if (Game.chestOpen) {
      chestRows = Math.ceil(20 / cols);
      chestY = top + invRows * cell + 10;
      h += 26 + chestRows * cell;
    }
    h += 34;
    var x = cen(w);
    var y = Math.floor((H() - h) / 2);
    if (y < 8) y = 8;
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, Game.chestOpen ? 'INVENTORY + CHEST' : 'INVENTORY',
      x + w / 2, y + 12, '#f7e07a', 1, 'center');

    for (var i = 0; i < 30; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      var sx = x + 12 + col * cell, sy = y + top + row * cell;
      var st = Game.inv[i];
      var sel = this.held && this.held.arr === Game.inv && this.held.i === i;
      this.slot(g, sx, sy, slot, st, sel, null);
      if (i < 4) {
        g.fillStyle = 'rgba(247,224,122,0.5)';
        g.fillRect(sx + 4, sy + 4, 3, 3);
      }
      (function (idx, self) {
        self.region(sx, sy, slot, slot, function () { self.slotClick(Game.inv, idx); });
      })(i, this);
      if (st && this.mx >= sx && this.mx < sx + slot && this.my >= sy && this.my < sy + slot)
        this.tip = { id: st.id, n: st.n };
    }

    if (Game.chestOpen) {
      PixelFont.shadow(g, 'CHEST', x + 12, chestY - 2, '#a0d0f0', 1);
      for (var c = 0; c < 20; c++) {
        var cc = c % cols, cr2 = Math.floor(c / cols);
        var cx2 = x + 12 + cc * cell, cy2 = y + chestY + 16 + cr2 * cell;
        var cst = Game.chest[c];
        var csel = this.held && this.held.arr === Game.chest && this.held.i === c;
        this.slot(g, cx2, cy2, slot, cst, csel, null);
        (function (idx, self) {
          self.region(cx2, cy2, slot, slot, function () { self.slotClick(Game.chest, idx); });
        })(c, this);
        if (cst && this.mx >= cx2 && this.mx < cx2 + slot && this.my >= cy2 && this.my < cy2 + slot)
          this.tip = { id: cst.id, n: cst.n };
      }
    }

    this.button(g, x + w - 100, y + h - 34, 88, 26, 'CLOSE', function () {
      if (UI.held) UI.held = null;
      Game.chestOpen = false;
      Game.state = 'play';
      AudioSys.play('close');
    });
    this.drawTip(g);
  };

  /* ---------------------------------------------------------------- */
  /* Shop                                                              */
  /* ---------------------------------------------------------------- */

  function sellGroups() {
    var groups = [], seen = {};
    for (var i = 4; i < Game.inv.length; i++) {
      var s = Game.inv[i];
      if (!s) continue;
      var def = ITEMS[s.id];
      if (!def || def.sell === undefined) continue;
      if (!seen[s.id]) { seen[s.id] = { id: s.id, n: 0 }; groups.push(seen[s.id]); }
      seen[s.id].n += s.n;
    }
    return groups;
  }

  UI.drawShop = function (g) {
    var port = portrait();
    var w = Math.min(W() - 16, 460);
    var x = cen(w);
    var tab = Game.shopTab === 'sell' ? 'sell' : 'buy';
    var cols = port ? 1 : 2;
    var groups = tab === 'sell' ? sellGroups() : [];
    var n = tab === 'buy' ? SHOP_STOCK.length : Math.max(1, groups.length);
    var rows = Math.max(1, Math.ceil(n / cols));
    var top = 84, foot = 46;
    var avail = H() - 24 - top - foot;
    var rh = Math.floor(avail / rows);
    if (rh > 54) rh = 54;
    if (rh < 18) rh = 18;
    var h = top + rows * rh + foot;
    var y = Math.floor((H() - h) / 2);
    if (y < 8) y = 8;
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'GENERAL STORE', x + w / 2, y + 12, '#f7e07a', 2, 'center');
    PixelFont.shadow(g, 'JUNIPER: "TAKE YOUR PICK, FARMER."', x + w / 2, y + 32, '#c9bba4', 1, 'center');

    var self = this;
    var tw = Math.floor((w - 28) / 2);
    this.tab(g, x + 12, y + 44, tw, 26, 'BUY', tab === 'buy', function () { Game.shopTab = 'buy'; AudioSys.play('select'); });
    this.tab(g, x + 16 + tw, y + 44, tw, 26, 'SELL', tab === 'sell', function () { Game.shopTab = 'sell'; AudioSys.play('select'); });

    var padX = 12, gut = 8;
    var cw = (w - padX * 2 - (cols - 1) * gut) / cols;

    if (tab === 'buy') {
      for (var i = 0; i < SHOP_STOCK.length; i++) {
        var id = SHOP_STOCK[i];
        var col = i % cols, row = Math.floor(i / cols);
        var rx = x + padX + col * (cw + gut), ry = y + top + row * rh;
        g.fillStyle = col % 2 ? '#20180f' : '#1a130e';
        g.fillRect(rx, ry, cw, rh - 3);
        g.fillStyle = '#3d2c1d'; g.fillRect(rx, ry, cw, 1);
        var isChicken = id === 'chicken';
        var icon = isChicken ? Sprites.chicken[0] : Sprites.items[id];
        if (icon) g.drawImage(icon, rx + 6, ry + Math.max(4, (rh - 24) / 2));
        var name = isChicken ? 'CHICKEN' : ITEMS[id].n.toUpperCase();
        PixelFont.shadow(g, this.fit(name, cw - 96), rx + 30, ry + 6, '#f0e6d0', 1);
        var price = isChicken ? 800 : ITEMS[id].buy;
        g.drawImage(Sprites.ui.coin, rx + 30, ry + 22, 12, 12);
        PixelFont.shadow(g, String(price), rx + 46, ry + 24, '#f7e07a', 1);
        (function (itemId, xx, yy) {
          self.button(g, xx, yy, 64, 24, 'BUY', function () { Game.buy(itemId); });
        })(id, rx + cw - 72, ry + Math.max(3, (rh - 24) / 2));
      }
    } else if (!groups.length) {
      PixelFont.draw(g, 'NOTHING TO SELL YET.', x + w / 2, y + top + 20, '#9c8a70', 1, 'center');
      PixelFont.draw(g, 'GROW OR MINE SOMETHING FIRST.', x + w / 2, y + top + 38, '#7a6a56', 1, 'center');
    } else {
      for (var j = 0; j < groups.length; j++) {
        var gr = groups[j];
        var c2 = j % cols, r2 = Math.floor(j / cols);
        var gx = x + padX + c2 * (cw + gut), gy = y + top + r2 * rh;
        g.fillStyle = r2 % 2 ? '#20180f' : '#1a130e';
        g.fillRect(gx, gy, cw, rh - 3);
        g.fillStyle = '#3d2c1d'; g.fillRect(gx, gy, cw, 1);
        var gdef = ITEMS[gr.id];
        var gicon = Sprites.items[gr.id];
        if (gicon) g.drawImage(gicon, gx + 6, gy + Math.max(4, (rh - 20) / 2));
        PixelFont.shadow(g, this.fit(gdef.n.toUpperCase() + ' X' + gr.n, cw - 150),
          gx + 30, gy + 6, '#f0e6d0', 1);
        PixelFont.shadow(g, (gdef.sell * gr.n) + 'G', gx + cw - 78, gy + 6, '#f7e07a', 1, 'right');
        (function (gid, xx, yy) {
          self.button(g, xx, yy, 64, 24, 'SELL', function () {
            var total = 0;
            for (var k = 0; k < Game.inv.length; k++) {
              var s = Game.inv[k];
              if (s && s.id === gid) { total += ITEMS[gid].sell * s.n; Game.inv[k] = null; }
            }
            if (total > 0) {
              Game.money += total;
              AudioSys.play('coin');
              FX.toast('+' + total + 'G', '#f7e07a');
            }
          });
        })(gr.id, gx + cw - 72, gy + Math.max(3, (rh - 24) / 2));
      }
    }

    // footer
    var fy = y + h - foot + 8;
    g.drawImage(Sprites.ui.coin, x + 14, fy + 4, 14, 14);
    PixelFont.shadow(g, Game.money.toLocaleString('en-US') + 'G', x + 32, fy + 6, '#f7e07a', 1);
    if (tab === 'sell') {
      this.button(g, x + w - 194, fy - 2, 96, 28, 'SELL ALL', function () { Game.sellAll(); });
    }
    this.button(g, x + w - 92, fy - 2, 80, 28, 'CLOSE', function () {
      Game.state = 'play'; Game.save(); AudioSys.play('close');
    });
    this.drawTip(g);
  };

  UI.tab = function (g, x, y, w, h, label, active, fn) {
    var hov = this.mx >= x && this.mx < x + w && this.my >= y && this.my < y + h;
    g.fillStyle = '#0d0a07'; g.fillRect(x, y, w, h);
    g.fillStyle = active ? '#7a5c3a' : hov ? '#5a4530' : '#2a2018';
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = active ? '#f7e07a' : hov ? '#d9b489' : '#7a6a56';
    g.fillRect(x + 4, y + h - 4, w - 8, 2);
    PixelFont.shadow(g, label, x + w / 2, y + Math.floor((h - 7) / 2),
      active ? '#f7e07a' : '#c9bba4', 1, 'center');
    this.region(x, y, w, h, fn);
  };

  /* ---------------------------------------------------------------- */
  /* Mail                                                              */
  /* ---------------------------------------------------------------- */

  var origOpenMail = Game.openMail;
  Game.openMail = function () {
    M.mailTab = 'list';
    return origOpenMail.apply(this, arguments);
  };

  UI.drawMail = function (g) {
    var w = Math.min(W() - 16, 460);
    var h = Math.min(H() - 24, 580);
    var x = cen(w), y = Math.floor((H() - h) / 2);
    if (y < 8) y = 8;
    this.panel(g, x, y, w, h, '#241a14');

    PixelFont.shadow(g, 'MAILBOX', x + 14, y + 14, '#f7e07a', 2);
    var un = Game.unreadMail();
    PixelFont.shadow(g, un ? un + ' UNREAD' : 'ALL CAUGHT UP', x + 128, y + 18,
      un ? '#f7e07a' : '#7fd06f', 1);
    g.drawImage(Sprites.ui.mail, x + w - 34, y + 14);
    g.fillStyle = '#5a4530'; g.fillRect(x + 12, y + 36, w - 24, 1);

    var tab = M.mailTab === 'letter' ? 'letter' : 'list';
    var tw = Math.floor((w - 28) / 2);
    this.tab(g, x + 12, y + 42, tw, 24, 'LETTERS', tab === 'letter', function () {
      M.mailTab = 'letter'; AudioSys.play('select');
    });
    this.tab(g, x + 16 + tw, y + 42, tw, 24, 'LIST', tab === 'list', function () {
      M.mailTab = 'list'; AudioSys.play('select');
    });

    var bodyTop = y + 76;
    var footH = 40;
    var m = Game.mail[Game.mailSel];

    if (tab === 'list') {
      var rh = 42;
      var count = Math.max(1, Math.floor((h - 76 - footH) / rh));
      var start = Math.max(0, Math.min(Game.mailSel - Math.floor(count / 2),
        Math.max(0, Game.mail.length - count)));
      if (!Game.mail.length) {
        PixelFont.draw(g, 'NO MAIL YET.', x + 20, bodyTop + 16, '#9c8a70', 1);
        PixelFont.draw(g, 'LETTERS ARRIVE EACH MORNING.', x + 20, bodyTop + 36, '#7a6a56', 1);
      }
      for (var i = start; i < start + count && i < Game.mail.length; i++) {
        var ry = bodyTop + (i - start) * rh;
        var letter = Game.mail[i];
        var selRow = i === Game.mailSel;
        g.fillStyle = selRow ? '#3f2f22' : (i % 2 ? '#1a130e' : '#20180f');
        g.fillRect(x + 12, ry, w - 24, rh - 4);
        if (selRow) { g.fillStyle = '#f7e07a'; g.fillRect(x + 12, ry, 3, rh - 4); }
        var tx = x + 22;
        if (!letter.read) {
          g.fillStyle = '#f7e07a'; g.fillRect(x + 21, ry + 8, 6, 6);
          tx = x + 32;
        }
        PixelFont.draw(g, this.fit(letter.from, Math.floor((w - 120) / 6)), tx, ry + 7,
          letter.read ? '#c9bba4' : '#f0e6d0', 1);
        PixelFont.draw(g, 'D' + letter.day, x + w - 44, ry + 7, '#7a6a56', 1);
        PixelFont.draw(g, this.fit(letter.subject, Math.floor((w - 80) / 6)), tx, ry + 22,
          selRow ? '#f7e07a' : '#9c8a70', 1);
        if (letter.att && !letter.attClaimed && !letter.req)
          g.drawImage(Sprites.ui.coin, x + w - 60, ry + 20, 12, 12);
        else if (letter.req && !letter.reqDone) {
          g.fillStyle = '#7fd06f'; g.fillRect(x + w - 58, ry + 22, 8, 8);
        }
        (function (idx, self) {
          self.region(x + 12, ry, w - 24, rh - 4, function () {
            Game.mailSel = idx; Game.markRead(idx);
            M.mailTab = 'letter';
            AudioSys.play('select');
          });
        })(i, this);
      }
      PixelFont.draw(g, Game.mail.length + ' LETTER' + (Game.mail.length === 1 ? '' : 'S'),
        x + 14, bodyTop + Math.min(Game.mail.length, count) * rh + 8, '#7a6a56', 1);
    } else if (!m) {
      PixelFont.draw(g, 'THE MAILBOX IS EMPTY.', x + 20, bodyTop + 16, '#9c8a70', 1);
      PixelFont.draw(g, 'VILLAGE REQUESTS AND GIFTS', x + 20, bodyTop + 36, '#7a6a56', 1);
      PixelFont.draw(g, 'ARRIVE HERE AFTER YOU SLEEP.', x + 20, bodyTop + 52, '#7a6a56', 1);
    } else {
      var pW = w - 28;
      PixelFont.shadow(g, this.fit(m.subject, pW), x + 14, bodyTop, '#f7e07a', 1);
      PixelFont.draw(g, 'FROM ' + m.from + '   DAY ' + m.day, x + 14, bodyTop + 16, '#9c8a70', 1);
      if (m.npc && Game.friendshipOf(m.npc) > 0) {
        var hearts = Game.friendshipHearts(m.npc);
        var hx = x + w - 14 - 5 * 11;
        for (var hi = 0; hi < 5; hi++) {
          if (hi >= hearts) g.globalAlpha = 0.22;
          g.drawImage(Sprites.ui.heart, hx + hi * 11, bodyTop + 14, 10, 10);
          g.globalAlpha = 1;
        }
      }
      g.fillStyle = '#5a4530'; g.fillRect(x + 14, bodyTop + 30, pW, 1);

      var attTop = y + h - footH - 104;
      var ly = bodyTop + 40;
      for (var b = 0; b < m.body.length && ly < attTop - 14; b++) {
        var wrapLines = this.wrap(m.body[b], pW, 1);
        for (var wl = 0; wl < wrapLines.length && ly < attTop - 14; wl++) {
          PixelFont.draw(g, wrapLines[wl], x + 14, ly, '#f0e6d0', 1);
          ly += 14;
        }
      }

      if (m.att || m.req) {
        var ax = x + 14, ay = attTop, aw = pW, ah = 96;
        this.panel(g, ax, ay, aw, ah, '#1a130e');
        var bx = ax + aw - 126;
        if (m.req) {
          var r = m.req, rdef = ITEMS[r.item], have = Game.countItem(r.item);
          PixelFont.shadow(g, 'REQUEST FROM ' + m.from, ax + 10, ay + 9, '#7fd06f', 1);
          var ricon = Sprites.items[r.item];
          if (ricon) g.drawImage(ricon, ax + 8, ay + 26);
          PixelFont.shadow(g, rdef.n.toUpperCase() + '   X' + r.n, ax + 30, ay + 28, '#f0e6d0', 1);
          PixelFont.shadow(g, 'HAVE ' + have + ' OF ' + r.n, ax + 30, ay + 44,
            have >= r.n ? '#7fd06f' : '#e0453f', 1);
          g.drawImage(Sprites.ui.coin, ax + 8, ay + 62, 12, 12);
          PixelFont.shadow(g, 'REWARD ' + r.gold + 'G', ax + 24, ay + 64, '#f7e07a', 1);
          if (m.reqDone) PixelFont.shadow(g, 'DELIVERED', bx + 56, ay + 44, '#7fd06f', 1, 'center');
          else {
            (function (letter, self) {
              self.button(g, bx, ay + ah - 32, 116, 26, have >= r.n ? 'DELIVER' : 'NEED MORE',
                function () { Game.deliverReq(letter); });
            })(m, this);
          }
        } else {
          var a = m.att;
          PixelFont.shadow(g, 'ENCLOSED WITH ' + m.from, ax + 10, ay + 9, '#f7e07a', 1);
          var iy = ay + 30;
          if (a.gold) {
            g.drawImage(Sprites.ui.coin, ax + 8, iy - 2, 14, 14);
            PixelFont.shadow(g, '+' + a.gold + 'G', ax + 28, iy + 1, '#f7e07a', 1);
            iy += 22;
          }
          if (a.item) {
            var aicon = Sprites.items[a.item];
            if (aicon) g.drawImage(aicon, ax + 8, iy - 4);
            PixelFont.shadow(g, ITEMS[a.item].n.toUpperCase() + '   X' + a.n,
              ax + 30, iy, '#a8e8a0', 1);
          }
          if (m.attClaimed) PixelFont.shadow(g, 'TAKEN', bx + 56, ay + 44, '#9c8a70', 1, 'center');
          else {
            (function (letter, self) {
              self.button(g, bx, ay + ah - 32, 116, 26, 'CLAIM', function () { Game.claimMail(letter); });
            })(m, this);
          }
        }
      } else {
        PixelFont.draw(g, '- NOTHING ENCLOSED -', x + 14, bodyTop + 44, '#7a6a56', 1);
      }
    }

    var fy = y + h - footH + 6;
    if (tab === 'letter') {
      this.button(g, x + 12, fy, 84, 28, 'DELETE', function () {
        Game.deleteMail(Game.mailSel);
      });
      this.button(g, x + 104, fy, 76, 28, 'BACK', function () {
        M.mailTab = 'list'; AudioSys.play('select');
      });
    }
    this.button(g, x + w - 92, fy, 80, 28, 'CLOSE', function () { Game.closeMail(); });
  };

  /* ---------------------------------------------------------------- */
  /* Pause                                                             */
  /* ---------------------------------------------------------------- */

  UI.drawPause = function (g) {
    var w = Math.min(W() - 24, 320);
    var bh = 30;
    var avail = H() - 16 - 56 - 30;
    var step = Math.min(40, Math.floor(avail / 5));
    if (step < bh + 4) { step = bh + 4; }
    var h = 56 + 5 * step + 30;
    var x = cen(w), y = Math.max(8, Math.floor((H() - h) / 2));
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'PAUSED', x + w / 2, y + 16, '#f7e07a', 2, 'center');
    var bw = w - 44, bx = x + 22;
    var by = y + 52;
    this.button(g, bx, by, bw, bh, 'RESUME', function () { Game.state = 'play'; AudioSys.play('close'); });
    by += step;
    this.button(g, bx, by, bw, bh, 'SAVE GAME', function () {
      Game.save(); FX.toast('GAME SAVED', '#7fd06f'); AudioSys.play('coin');
    });
    by += step;
    this.button(g, bx, by, bw, bh, 'HOW TO PLAY', function () { UI.helpOpen = true; AudioSys.play('open'); });
    by += step;
    this.button(g, bx, by, bw, bh, AudioSys.musicOn ? 'MUSIC: ON' : 'MUSIC: OFF', function () {
      AudioSys.toggleMusic(); AudioSys.play('select');
    });
    by += step;
    this.button(g, bx, by, bw, bh, 'QUIT TO TITLE', function () {
      Game.save();
      Game.state = 'title';
      Renderer.titleCam = true;
      AudioSys.play('close');
    });
    PixelFont.shadow(g, 'PROGRESS SAVES WHEN YOU SLEEP', x + w / 2, y + h - 16, '#9c8a70', 1, 'center');
  };

  /* ---------------------------------------------------------------- */
  /* Help                                                              */
  /* ---------------------------------------------------------------- */

  UI.drawHelp = function (g) {
    var lines = [
      ['MOVE', 'DRAG THE STICK'],
      ['RUN', 'PUSH THE STICK FAR'],
      ['USE TOOL', 'USE BUTTON OR TAP'],
      ['INTERACT', 'ACT BUTTON'],
      ['GIVE GIFT', 'GIFT BUTTON'],
      ['HOTBAR', 'TAP SLOT OR ARROWS'],
      ['INVENTORY', 'BAG BUTTON'],
      ['MAIL', 'TAP THE ENVELOPE'],
      ['PAUSE', 'MENU BUTTON']
    ];
    var tips = [
      'TAP A TILE TO FACE IT AND SWING.',
      'PLANT SEEDS ON TILLED SOIL AND WATER DAILY.',
      'SLEEP IN YOUR BED TO ADVANCE THE DAY.',
      'SELL CROPS AT THE GENERAL STORE.',
      'EATING FOOD RESTORES ENERGY.',
      'READ YOUR MAIL FOR VILLAGE REQUESTS.'
    ];
    var w = Math.min(W() - 20, 340);
    var head = 48;
    var tipsH = tips.length * 14;
    var h = head + lines.length * 18 + 6 + tipsH + 40;
    if (h > H() - 16) {
      var extra = h - (H() - 16);
      var drop = Math.ceil(extra / 14);
      tips = tips.slice(0, Math.max(0, tips.length - drop));
      h = head + lines.length * 18 + 6 + tips.length * 14 + 40;
    }
    var x = cen(w), y = Math.max(8, Math.floor((H() - h) / 2));
    this.panel(g, x, y, w, h, '#241a14');
    PixelFont.shadow(g, 'HOW TO PLAY', x + w / 2, y + 16, '#f7e07a', 2, 'center');
    var ly = y + head;
    for (var i = 0; i < lines.length; i++) {
      PixelFont.draw(g, lines[i][0], x + 16, ly, '#f0d24a', 1);
      PixelFont.draw(g, lines[i][1], x + 126, ly, '#f0e6d0', 1);
      ly += 18;
    }
    ly += 6;
    for (var t = 0; t < tips.length; t++) {
      PixelFont.draw(g, tips[t], x + 16, ly, '#9c8a70', 1);
      ly += 14;
    }
    this.button(g, x + w / 2 - 52, y + h - 32, 104, 24, 'CLOSE', function () {
      UI.helpOpen = false; AudioSys.play('close');
    });
  };

  /* ---------------------------------------------------------------- */
  /* Title                                                             */
  /* ---------------------------------------------------------------- */

  UI.drawTitle = function (g) {
    var Wd = W(), Hd = H();
    g.fillStyle = 'rgba(8,10,20,0.42)';
    g.fillRect(0, 0, Wd, Hd);
    var bob = Math.sin(TitleT * 1.6) * 4;
    PixelFont.shadow(g, 'SUNVALE', Wd / 2, Math.max(24, Hd * 0.16) + bob, '#f7e07a', 6, 'center');
    PixelFont.shadow(g, 'A COZY PIXEL FARM LIFE', Wd / 2, Math.max(24, Hd * 0.16) + 54 + bob, '#f0e6d0', 1, 'center');

    var bw = Math.min(260, Wd - 40), bx = cen(bw);
    var by = Math.floor(Hd * 0.46);
    if (Game.hasSave) {
      this.button(g, bx, by, bw, 36, 'CONTINUE FARM', function () {
        Game.continueGame();
        Renderer.titleCam = false;
        Renderer.updateCam(1, true);
      }, 2);
      by += 50;
      this.button(g, bx, by, bw, 36, 'NEW FARM', function () {
        Game.newGame();
        Renderer.titleCam = false;
        Renderer.updateCam(1, true);
      }, 2);
    } else {
      this.button(g, bx, by, bw, 40, 'START FARM', function () {
        Game.newGame();
        Renderer.titleCam = false;
        Renderer.updateCam(1, true);
      }, 2);
    }
    by += 64;
    PixelFont.shadow(g, 'DRAG THE STICK TO MOVE', Wd / 2, by, '#c9bba4', 1, 'center');
    by += 16;
    PixelFont.shadow(g, 'ACT TO TALK   USE TO SWING   TAP TO PICK', Wd / 2, by, '#c9bba4', 1, 'center');
    PixelFont.shadow(g, 'A FAN-MADE COZY FARMING GAME', Wd / 2, Hd - 28, '#9c8a70', 1, 'center');
  };

  /* ---------------------------------------------------------------- */
  /* Frame hook                                                        */
  /* ---------------------------------------------------------------- */

  var origDraw = UI.draw;
  UI.draw = function (g, dt) {
    if (M.tick) M.tick();
    return origDraw.call(this, g, dt);
  };
})();
