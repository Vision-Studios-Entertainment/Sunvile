/* GAME — the central state machine. Single global object `Game`.

   State fields every other file reads: state ('title'|'play'|'dialogue'|
   'inventory'|'shop'|'mail'|'pause'|'sleep'), day/timeMin/weather/money/
   energy, inv/chest, mail, friendship, dialogue, fade.

   Layout (top to bottom)
     lifecycle   init/newGame/continueGame/save/peekSave
                 -- NEW FIELD? It must be written in save() and read back in
                    continueGame(), or it resets on every reload --
     clock       rollWeather/weatherName/clockText
     inventory   addItem/countItem/removeItem/selItem/useEnergy/frontTile
     tool use    use/swing/useHoe/useCan/useAxe/usePick/plantSeed/harvest/eat
                 -- every tool path must go through useEnergy() and call
                    World.rebuildGrid('farm') after changing props --
     mail        welcomeMail..deliverMail: letters, attachments, requests
     social      befriend/giftGain/giveGift (friendship + milestone gifts)
     interaction interact() switches on nearestInteract().kind — this is the
                 single dispatch point for E; say()/advanceDialogue() run the
                 typewriter dialogue box
     economy     openShop/buy/sellSlot/sellAll
     day cycle   startSleep/advanceDay/passOut (crops, weather, eggs, respawns)
     frame       update() — the per-tick entry point called by main.js

   Save format lives entirely in save()/continueGame(): JSON under
   SAVE_KEY in localStorage, `v: 1` schema version. Bump `v` if you change
   the shape and add a migration there, not in the callers. */

const SAVE_KEY = 'sunvale_save_v1';

const Game = {
  state: 'title',
  day: 1, timeMin: DAY_START, weather: 'sunny', nextWeather: 'sunny',
  money: 500, energy: MAX_ENERGY,
  inv: [], chest: [], selected: 4,
  mail: [], mailSel: 0, mailSeq: 1, tipIdx: 0, reqIdx: 0, friendship: {},
  chestOpen: false, dialogue: null, shopTab: 'buy',
  fade: 0, fadeDir: 0, sleepT: 0, sleepReason: '',
  hasSave: false, clockAcc: 0, hint: 0, flash: 0,
  hoveredSlot: null, msg: null, msgT: 0,

// ==== lifecycle: boot, new game, save/load ==========================

  init: function () {
    this.inv = new Array(30).fill(null);
    this.chest = new Array(20).fill(null);
    this.mail = []; this.mailSel = 0; this.mailSeq = 1;
    this.tipIdx = 0; this.reqIdx = 0; this.friendship = {};
    this.inv[0] = { id: 'hoe', n: 1 };
    this.inv[1] = { id: 'can', n: 1 };
    this.inv[2] = { id: 'axe', n: 1 };
    this.inv[3] = { id: 'pick', n: 1 };
    this.hasSave = !!this.peekSave();
    this.state = 'title';
    World.init(1337);
  },

  peekSave: function () {
    try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  },

  newGame: function () {
    this.day = 1; this.timeMin = DAY_START;
    this.weather = 'sunny'; this.nextWeather = this.rollWeather();
    this.money = 500; this.energy = MAX_ENERGY; this.selected = 4;
    this.inv = new Array(30).fill(null);
    this.chest = new Array(20).fill(null);
    this.inv[0] = { id: 'hoe', n: 1 };
    this.inv[1] = { id: 'can', n: 1 };
    this.inv[2] = { id: 'axe', n: 1 };
    this.inv[3] = { id: 'pick', n: 1 };
    this.inv[4] = { id: 'turnip_seeds', n: 6 };
    this.mail = []; this.mailSel = 0; this.mailSeq = 1;
    this.tipIdx = 0; this.reqIdx = 0; this.friendship = {};
    this.pushMail(this.welcomeMail());
    World.init(1337);
    World.current = 'farm';
    Player.x = 10 * TILE + 8; Player.y = 15 * TILE; Player.dir = 'down';
    FX.clear();
    this.state = 'play';
    AudioSys.init(); AudioSys.resume(); AudioSys.startMusic();
    AudioSys.setRain(false);
    FX.toast('WELCOME TO SUNVALE FARM', '#f7e07a');
    FX.toast('PRESS H FOR CONTROLS', '#f0e6d0');
    this.save();
  },

  continueGame: function () {
    const raw = this.peekSave();
    if (!raw) return this.newGame();
    let d;
    try { d = JSON.parse(raw); } catch (e) { return this.newGame(); }
    World.init(d.seed || 1337);
    World.current = d.map || 'farm';
    World.applySave(d.world);
    this.day = d.day; this.timeMin = d.timeMin;
    this.weather = d.weather; this.nextWeather = d.nextWeather;
    this.money = d.money; this.energy = d.energy; this.selected = d.selected || 4;
    this.inv = (d.inv || []).map(function (s) { return s ? { id: s[0], n: s[1] } : null; });
    while (this.inv.length < 30) this.inv.push(null);
    this.chest = (d.chest || []).map(function (s) { return s ? { id: s[0], n: s[1] } : null; });
    while (this.chest.length < 20) this.chest.push(null);
    this.mail = d.mail || [];
    this.mailSel = 0;
    this.mailSeq = d.mailSeq || (this.mail.length + 1);
    this.friendship = d.friendship || {};
    this.tipIdx = d.tipi || 0;
    this.reqIdx = d.reqi || 0;
    if (!d.mail) this.pushMail(this.welcomeMail());
    const farm = World.maps.farm;
    farm.soil = d.soil || {};
    farm.crops = d.crops || {};
    for (const k in farm.soil) {
      const p = k.split(',');
      World.setTile('farm', +p[0], +p[1], farm.soil[k].w ? T.SOIL_WET : T.SOIL);
    }
    (d.chickens || []).forEach(function (c, i) {
      if (farm.chickens[i]) { farm.chickens[i].x = c[0]; farm.chickens[i].y = c[1]; }
    });
    Player.x = d.px; Player.y = d.py; Player.dir = d.pdir || 'down';
    Player.unstick();
    FX.clear();
    this.state = 'play';
    AudioSys.init(); AudioSys.resume(); AudioSys.startMusic();
    AudioSys.setRain(this.weather === 'rain' || this.weather === 'storm');
    FX.toast('WELCOME BACK TO SUNVALE', '#f7e07a');
  },

  save: function () {
    const farm = World.maps.farm;
    const soil = {};
    for (const k in farm.soil) soil[k] = { o: farm.soil[k].o, w: farm.soil[k].w };
    const data = {
      v: 1, seed: World.seed, day: this.day, timeMin: this.timeMin,
      weather: this.weather, nextWeather: this.nextWeather,
      money: this.money, energy: this.energy, selected: this.selected,
      mail: this.mail, mailSeq: this.mailSeq, friendship: this.friendship,
      tipi: this.tipIdx, reqi: this.reqIdx,
      map: World.current, px: Player.x, py: Player.y, pdir: Player.dir,
      inv: this.inv.map(function (s) { return s ? [s.id, s.n] : null; }),
      chest: this.chest.map(function (s) { return s ? [s.id, s.n] : null; }),
      soil: soil, crops: farm.crops,
      chickens: farm.chickens.map(function (c) { return [c.x, c.y]; }),
      world: World.serialize()
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); this.hasSave = true; }
    catch (e) { FX.toast('SAVE FAILED', '#e0453f'); }
  },

// ==== clock: weather + time of day =================================

  rollWeather: function () {
    const r = Math.random();
    if (r < 0.55) return 'sunny';
    if (r < 0.85) return 'rain';
    return 'storm';
  },

  weatherName: function (w) {
    return w === 'sunny' ? 'SUNNY' : w === 'rain' ? 'RAIN' : 'STORM';
  },

  dayName: function () { return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][(this.day - 1) % 7]; },

  clockText: function () {
    let h = Math.floor(this.timeMin / 60), m = Math.floor(this.timeMin % 60);
    const ap = h >= 12 ? 'PM' : 'AM';
    let hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  },

  stackMax: function (id) { return ITEMS[id] && ITEMS[id].k === 'tool' ? 1 : 99; },

// ==== inventory & energy ===========================================

  addItem: function (id, n) {
    n = n || 1;
    for (let i = 0; i < this.inv.length && n > 0; i++) {
      const s = this.inv[i];
      if (s && s.id === id && s.n < this.stackMax(id)) {
        const add = Math.min(n, this.stackMax(id) - s.n);
        s.n += add; n -= add;
      }
    }
    for (let i = 4; i < this.inv.length && n > 0; i++) {
      if (!this.inv[i]) {
        const add = Math.min(n, this.stackMax(id));
        this.inv[i] = { id: id, n: add };
        n -= add;
      }
    }
    return n;
  },

  countItem: function (id) {
    let c = 0;
    for (const s of this.inv) if (s && s.id === id) c += s.n;
    return c;
  },

  removeItem: function (id, n) {
    for (let i = this.inv.length - 1; i >= 0 && n > 0; i--) {
      const s = this.inv[i];
      if (s && s.id === id) {
        const take = Math.min(n, s.n);
        s.n -= take; n -= take;
        if (s.n <= 0) this.inv[i] = null;
      }
    }
  },

  selItem: function () { return this.inv[this.selected]; },

  useEnergy: function (amt) {
    if (this.energy < amt) {
      if (this.msg !== 'TOO TIRED...') { this.msg = 'TOO TIRED...'; this.msgT = 2; AudioSys.play('error'); }
      return false;
    }
    this.energy = Math.max(0, this.energy - amt);
    return true;
  },

  frontTile: function () {
    const f = Player.front();
    return { x: Math.floor(f.x / TILE), y: Math.floor(f.y / TILE) };
  },

// ==== tool use & farming actions ===================================

  use: function () {
    if (this.state !== 'play') return;
    const item = this.selItem();
    const t = this.frontTile();
    const key = t.x + ',' + t.y;
    const map = World.map();
    const grid = World.propAt(null, t.x, t.y);
    let prop = null;
    if (grid) for (const p of grid) if (p.solid && !p.dead) { prop = p; break; }
    if (!prop && grid && grid.length) prop = grid[0];

    if (!item) { this.swing(null); return; }
    const def = ITEMS[item.id];
    Player.useTimer = 0.3;
    Player.useTool = item.id;

    if (def.k === 'seed') {
      this.plantSeed(item, t, key);
      return;
    }
    if (def.k === 'tool') {
      if (def.tool === 'hoe') this.useHoe(t, key, prop);
      else if (def.tool === 'can') this.useCan(t, key);
      else if (def.tool === 'axe') this.useAxe(t, prop);
      else if (def.tool === 'pick') this.usePick(t, prop);
      return;
    }
    this.swing(null);
  },

  swing: function (tool) {
    Player.useTimer = 0.3;
    Player.useTool = tool;
  },

  canTarget: function (t) {
    if (World.current !== 'farm') return false;
    return World.farmable(t.x, t.y) && !World.solidTile(null, t.x, t.y);
  },

  useHoe: function (t, key, prop) {
    const map = World.maps.farm;
    if (World.current === 'farm' && map.crops[key] && this.canTarget2(t)) {
      delete map.crops[key];
      AudioSys.play('till');
      FX.burst(t.x * TILE + 8, t.y * TILE + 10, '#8a6a4a', 8, 40, 0.5);
      return;
    }
    if (!this.canTarget(t)) {
      AudioSys.play('error');
      FX.float(Player.x, Player.y - 24, 'NOT HERE', '#e0a0a0');
      return;
    }
    if (!this.useEnergy(ENERGY.till)) return;
    const cur = World.tileAt('farm', t.x, t.y);
    if (cur === T.SOIL || cur === T.SOIL_WET) return;
    map.soil[key] = { o: cur, w: cur === T.SOIL_WET ? 1 : 0 };
    World.setTile('farm', t.x, t.y, T.SOIL);
    AudioSys.play('till');
    FX.burst(t.x * TILE + 8, t.y * TILE + 12, '#8a6a4a', 10, 46, 0.5);
    this.hinted('till');
  },

  canTarget2: function (t) {
    return World.farmable(t.x, t.y) && !World.solidTile(null, t.x, t.y);
  },

  useCan: function (t, key) {
    const map = World.maps.farm;
    const cur = World.tileAt('farm', t.x, t.y);
    const hasCrop = !!map.crops[key];
    if (World.current !== 'farm') { AudioSys.play('error'); return; }
    if (cur !== T.SOIL && cur !== T.SOIL_WET && !hasCrop) {
      AudioSys.play('error');
      FX.float(Player.x, Player.y - 24, 'DRY GROUND', '#a0c0e0');
      return;
    }
    if (cur === T.SOIL_WET && map.soil[key] && map.soil[key].w) return;
    if (!this.useEnergy(ENERGY.water)) return;
    if (map.soil[key]) map.soil[key].w = 1;
    World.setTile('farm', t.x, t.y, T.SOIL_WET);
    AudioSys.play('water');
    FX.burst(t.x * TILE + 8, t.y * TILE + 10, '#6fb3e8', 9, 34, 0.45, 180);
    this.hinted('water');
  },

  useAxe: function (t, prop) {
    if (!prop || prop.type !== 'tree') {
      if (prop && prop.type === 'bush') {
        if (!this.useEnergy(ENERGY.chop)) return;
        prop.dead = true; prop.dirty = true;
        World.rebuildGrid(World.current);
        AudioSys.play('chop');
        FX.burst(t.x * TILE + 8, t.y * TILE + 8, '#5fae44', 8, 40, 0.5);
        this.addItem('wood', 1);
        FX.float(t.x * TILE + 8, t.y * TILE, '+1 WOOD', '#e0c68f');
        return;
      }
      this.swing(null);
      AudioSys.play('select');
      return;
    }
    if (prop.state === 'sprout') {
      if (!this.useEnergy(ENERGY.chop)) return;
      prop.state = 'full'; prop.hp = prop.maxHp; prop.dirty = true;
      World.rebuildGrid(World.current);
      AudioSys.play('chopTree');
      return;
    }
    if (!this.useEnergy(ENERGY.chop)) return;
    prop.hp -= 1;
    prop.dirty = true;
    AudioSys.play('chop');
    FX.burst(t.x * TILE + 8, t.y * TILE + 4, '#a97c4f', 7, 46, 0.5);
    if (prop.hp <= 0) {
      const wood = prop.state === 'stump' ? 1 : 3 + ((Math.random() * 2) | 0);
      if (prop.state === 'stump') {
        prop.dead = true;
      } else {
        prop.state = 'stump';
        prop.timer = 3;
        prop.hp = 3;
      }
      prop.dirty = true;
      World.rebuildGrid(World.current);
      this.addItem('wood', wood);
      FX.float(t.x * TILE + 8, t.y * TILE - 6, '+' + wood + ' WOOD', '#e0c68f');
      AudioSys.play('chopTree');
      this.hinted('chop');
    }
  },

  usePick: function (t, prop) {
    if (!prop || prop.type !== 'rock' || !prop.alive) {
      this.swing(null);
      AudioSys.play('select');
      return;
    }
    if (!this.useEnergy(ENERGY.mine)) return;
    prop.hp -= 1;
    prop.dirty = true;
    AudioSys.play('mine');
    FX.burst(t.x * TILE + 8, t.y * TILE + 8, '#b0b6bd', 8, 50, 0.5);
    if (prop.hp <= 0) {
      prop.alive = false;
      prop.timer = 5;
      prop.dirty = true;
      World.rebuildGrid(World.current);
      const ore = prop.kind === 'ore';
      const stone = 2 + ((Math.random() * 2) | 0);
      this.addItem('stone', stone);
      FX.float(t.x * TILE + 8, t.y * TILE - 6, '+' + stone + ' STONE', '#d5dbe2');
      if (ore) {
        this.addItem('gem', 1);
        FX.float(t.x * TILE + 8, t.y * TILE - 16, '+1 AMETHYST', '#e0a0ff');
        AudioSys.play('coin');
      }
      AudioSys.play('break');
      this.hinted('mine');
    }
  },

  plantSeed: function (item, t, key) {
    const map = World.maps.farm;
    const def = ITEMS[item.id];
    if (World.current !== 'farm' || World.solidTile(null, t.x, t.y)) {
      AudioSys.play('error');
      FX.float(Player.x, Player.y - 24, 'TILL FIRST', '#e0a0a0');
      return;
    }
    const cur = World.tileAt('farm', t.x, t.y);
    if (cur !== T.SOIL && cur !== T.SOIL_WET) {
      AudioSys.play('error');
      FX.float(Player.x, Player.y - 24, 'TILL FIRST', '#e0a0a0');
      return;
    }
    if (map.crops[key]) { AudioSys.play('error'); return; }
    item.n -= 1;
    if (item.n <= 0) this.inv[this.selected] = null;
    map.crops[key] = { id: def.crop, stage: 0 };
    AudioSys.play('plant');
    FX.burst(t.x * TILE + 8, t.y * TILE + 12, '#5fae44', 6, 30, 0.4);
    this.hinted('plant');
  },

  harvest: function (x, y) {
    const map = World.maps.farm;
    const key = x + ',' + y;
    const cr = map.crops[key];
    if (!cr) return;
    const def = CROPS[cr.id];
    delete map.crops[key];
    const left = this.addItem(cr.id, 1);
    if (left > 0) FX.toast('INVENTORY FULL', '#e0453f');
    else {
      FX.float(x * TILE + 8, y * TILE, '+' + ITEMS[cr.id].n.toUpperCase(), '#a8e8a0');
      AudioSys.play('harvest');
    }
    this.hinted('harvest');
  },

  eat: function () {
    const item = this.selItem();
    if (!item) return false;
    const def = ITEMS[item.id];
    if (!def || !def.food) return false;
    this.energy = Math.min(MAX_ENERGY, this.energy + def.food);
    item.n -= 1;
    if (item.n <= 0) this.inv[this.selected] = null;
    AudioSys.play('eat');
    FX.float(Player.x, Player.y - 26, '+' + def.food + ' ENERGY', '#f7e07a');
    return true;
  },

// ==== mail: letters, attachments, village requests =================

  welcomeMail: function () {
    return {
      from: 'SUNVALE POST', subject: 'WELCOME TO SUNVALE',
      body: [
        'Welcome to your new farm, farmer!',
        'The mailbox by the path collects your',
        'village mail every morning. A little',
        'gift is enclosed to get you started.'
      ],
      att: { gold: 150 }
    };
  },

  mkMail: function (t) {
    return {
      id: this.mailSeq++, from: t.from, day: this.day,
      subject: t.subject, body: (t.body || []).slice(),
      read: false, npc: t.npc || null,
      att: t.att ? { gold: t.att.gold || 0, item: t.att.item || null, n: t.att.n || 0 } : null,
      req: t.req ? { item: t.req.item, n: t.req.n, gold: t.req.gold } : null,
      attClaimed: false, reqDone: false
    };
  },

  pushMail: function (t) {
    this.mail.unshift(this.mkMail(t));
    while (this.mail.length > 24) this.mail.pop();
    FX.toast('NEW MAIL HAS ARRIVED', '#a0d0f0');
    AudioSys.play('open');
  },

  unreadMail: function () {
    let c = 0;
    for (const m of this.mail) if (!m.read) c += 1;
    return c;
  },

  markRead: function (i) {
    const m = this.mail[i];
    if (m && !m.read) m.read = true;
  },

  openMail: function () {
    if (this.mailSel >= this.mail.length) this.mailSel = 0;
    this.state = 'mail';
    this.markRead(this.mailSel);
    AudioSys.play('open');
  },

  closeMail: function () {
    this.state = 'play';
    AudioSys.play('close');
  },

  claimMail: function (m) {
    if (!m || !m.att || m.attClaimed) return;
    if (m.att.gold) this.money += m.att.gold;
    if (m.att.item) {
      const left = this.addItem(m.att.item, m.att.n);
      if (left > 0) {
        FX.toast('INVENTORY FULL', '#e0453f');
        AudioSys.play('error');
        return;
      }
      FX.toast('+' + m.att.n + ' ' + ITEMS[m.att.item].n.toUpperCase(), '#a8e8a0');
    }
    if (m.att.gold) FX.toast('+' + m.att.gold + 'G', '#f7e07a');
    m.attClaimed = true;
    m.read = true;
    AudioSys.play('coin');
  },

  deliverReq: function (m) {
    if (!m || !m.req || m.reqDone) return;
    const r = m.req;
    if (this.countItem(r.item) < r.n) {
      FX.toast('NEED ' + r.n + ' ' + ITEMS[r.item].n.toUpperCase(), '#e0453f');
      AudioSys.play('error');
      return;
    }
    this.removeItem(r.item, r.n);
    this.money += r.gold;
    m.reqDone = true;
    m.read = true;
    this.befriend(m.npc, 6);
    AudioSys.play('coin');
    FX.toast('DELIVERED! +' + r.gold + 'G', '#f7e07a');
    this.save();
  },

  deleteMail: function (i) {
    if (i < 0 || i >= this.mail.length) return;
    this.mail.splice(i, 1);
    if (this.mailSel >= this.mail.length) this.mailSel = Math.max(0, this.mail.length - 1);
    AudioSys.play('close');
  },

  deliverMail: function () {
    if (this.day === 2) this.pushMail(this.weekMail());
    if (this.day % 2 === 0 || Math.random() < 0.35) {
      this.pushMail(MAIL_TIPS[this.tipIdx % MAIL_TIPS.length]);
      this.tipIdx += 1;
    }
    if (this.day >= 3 && this.day % 3 === 0) {
      this.pushMail(MAIL_REQUESTS[this.reqIdx % MAIL_REQUESTS.length]);
      this.reqIdx += 1;
    }
    while (this.mail.length > 16) {
      let idx = -1;
      for (let i = this.mail.length - 1; i >= 0; i--) {
        const m = this.mail[i];
        if (m.read && (!m.att || m.attClaimed) && (!m.req || m.reqDone)) { idx = i; break; }
      }
      if (idx < 0) break;
      this.mail.splice(idx, 1);
    }
    if (this.mailSel >= this.mail.length) this.mailSel = Math.max(0, this.mail.length - 1);
  },

  weekMail: function () {
    return {
      from: 'SUNVALE POST', subject: 'YOUR FIRST WEEK',
      body: [
        'The village has word of your arrival.',
        'Deliver the requests that arrive here',
        'for gold and goodwill. Talk to the',
        'neighbors - they remember kindness.'
      ],
      att: { gold: 120 }
    };
  },

  friendshipOf: function (id) { return this.friendship[id] || 0; },

  friendshipHearts: function (id) { return Math.floor(this.friendshipOf(id) / 20); },

// ==== social: friendship + gifts ===================================

  befriend: function (id, amt) {
    const def = NPC_DEFS.find(function (d) { return d.id === id; });
    if (!def) return;
    const before = this.friendshipOf(id);
    const after = Math.min(100, before + amt);
    this.friendship[id] = after;
    for (const m of FRIEND_MILESTONES) {
      if (before < m.at && after >= m.at) {
        this.pushMail({
          from: def.name.toUpperCase(), npc: def.id, subject: m.subject,
          body: m.body.slice(), att: { item: m.item, n: m.n }
        });
      }
    }
    if (this.friendshipHearts(id) > Math.floor(before / 20)) {
      FX.toast(def.name.toUpperCase() + ' IS A CLOSER FRIEND', '#ff9a94');
    }
  },

  giftGain: function (npc, item) {
    const def = ITEMS[item.id];
    if (def.k === 'tool') return 0;
    let gain = def.k === 'crop' ? 5 : def.k === 'seed' ? 3 : 4;
    if (npc.def.loves && npc.def.loves.indexOf(item.id) >= 0) gain = 14;
    else if (npc.def.likes && npc.def.likes.indexOf(def.k) >= 0) gain += 3;
    return gain;
  },

  giveGift: function () {
    const t = nearestInteract();
    if (!t || t.kind !== 'npc') {
      FX.float(Player.x, Player.y - 24, 'NO ONE NEARBY', '#e0a0a0');
      AudioSys.play('error');
      return;
    }
    const item = this.selItem();
    if (!item) {
      FX.float(Player.x, Player.y - 24, 'HOLD A GIFT FIRST', '#e0a0a0');
      AudioSys.play('error');
      return;
    }
    const gain = this.giftGain(t.npc, item);
    if (gain <= 0) {
      FX.float(Player.x, Player.y - 24, 'NOT A GIFT', '#e0a0a0');
      AudioSys.play('error');
      return;
    }
    item.n -= 1;
    if (item.n <= 0) this.inv[this.selected] = null;
    this.befriend(t.npc.def.id, gain);
    t.npc.talked = true;
    t.npc.giftT = 1;
    AudioSys.play('pet');
    FX.hearts.push({ x: t.npc.x, y: t.npc.y - 14, t: 0 });
    FX.hearts.push({ x: t.npc.x - 7, y: t.npc.y - 8, t: 0.25 });
    FX.float(t.npc.x, t.npc.y - 26, '+' + gain + ' FRIENDSHIP', '#ff9a94');
    FX.float(t.npc.x, t.npc.y - 38, GIFT_THANKS[(Math.random() * GIFT_THANKS.length) | 0], '#f7e07a');
    if (Math.random() < 0.4) this.say(t.npc.def.name, t.npc.def.palette,
      ['What a lovely gift! Thank you, farmer.'], t.npc.def.id);
  },

  hinted: function (k) { },

// ==== interaction dispatch (E) + dialogue ==========================

  interact: function () {
    if (this.state !== 'play') return;
    const t = nearestInteract();
    if (!t) {
      if (this.eat()) return;
      return;
    }
    if (t.kind === 'door' || t.kind === 'exit') {
      const p = t.prop;
      if (!p.target) return;
      AudioSys.play('door');
      World.current = p.target;
      Player.x = p.spawn.x; Player.y = p.spawn.y;
      Player.unstick();
      Player.dir = 'down';
      this.fade = 1; this.fadeDir = -1;
      return;
    }
    if (t.kind === 'bed') {
      this.sleepReason = 'rest';
      this.startSleep();
      return;
    }
    if (t.kind === 'tv') {
      AudioSys.play('open');
      this.say('TV', 'juniper', [
        'WEATHER REPORT FOR TOMORROW...',
        'EXPECT ' + this.weatherName(this.nextWeather) + '. PLAN ACCORDINGLY!',
        'AND NOW, BACK TO OUR PROGRAMMING.'
      ]);
      return;
    }
    if (t.kind === 'chest') {
      this.chestOpen = true;
      this.state = 'inventory';
      AudioSys.play('open');
      return;
    }
    if (t.kind === 'sign') {
      this.say('SIGN', 'mira', [t.prop.text || 'A WEATHERED SIGN.']);
      AudioSys.play('open');
      return;
    }
    if (t.kind === 'mailbox') {
      this.openMail();
      return;
    }
    if (t.kind === 'shop') {
      this.openShop();
      return;
    }
    if (t.kind === 'npc') {
      const n = t.npc;
      const line = n.def.lines[(Math.random() * n.def.lines.length) | 0];
      if (!n.talked) {
        n.talked = true;
        this.befriend(n.def.id, 2);
        FX.float(Player.x, Player.y - 28, '+2 FRIENDSHIP', '#ff9a94');
      }
      this.say(n.def.name, n.def.palette, [line], n.def.id);
      AudioSys.play('pet');
      return;
    }
    if (t.kind === 'chicken') {
      const c = t.chicken;
      if (!c.petted) {
        c.petted = true;
        AudioSys.play('cluck');
        FX.hearts.push({ x: c.x, y: c.y - 10, t: 0 });
        FX.float(c.x, c.y - 16, 'CLUCK!', '#f0e6d0');
      } else {
        AudioSys.play('cluck');
        FX.float(c.x, c.y - 16, 'CLUCK', '#f0e6d0');
      }
      return;
    }
    if (t.kind === 'harvest') {
      this.harvest(t.x, t.y);
      return;
    }
  },

  say: function (name, palette, pages, npcId) {
    this.dialogue = { name: name, palette: palette, pages: pages, i: 0, chars: 0, npcId: npcId || null };
    this.state = 'dialogue';
  },

  advanceDialogue: function () {
    const d = this.dialogue;
    if (!d) { this.state = 'play'; return; }
    const full = d.pages[d.i].length;
    if (d.chars < full) { d.chars = full; return; }
    d.i += 1; d.chars = 0;
    if (d.i >= d.pages.length) {
      this.dialogue = null;
      this.state = 'play';
      AudioSys.play('close');
    } else AudioSys.play('select');
  },

// ==== economy: shop =================================================

  openShop: function () {
    this.state = 'shop';
    this.shopTab = 'buy';
    AudioSys.play('open');
  },

  buy: function (id) {
    if (id === 'chicken') {
      if (this.money < 800) { AudioSys.play('error'); FX.toast('NOT ENOUGH GOLD', '#e0453f'); return; }
      const farm = World.maps.farm;
      if (farm.chickens.length >= 6) { AudioSys.play('error'); FX.toast('COOP IS FULL', '#e0453f'); return; }
      this.money -= 800;
      farm.chickens.push({
        x: 42 * TILE, y: 26 * TILE, dir: -1, frame: 0, anim: 0,
        tx: 42, ty: 26, state: 'idle', wait: 1, petted: false, moving: false
      });
      AudioSys.play('coin');
      FX.toast('A CHICKEN JOINS YOUR COOP!', '#f7e07a');
      this.save();
      return;
    }
    const def = ITEMS[id];
    if (!def || def.buy === undefined) return;
    if (this.money < def.buy) { AudioSys.play('error'); FX.toast('NOT ENOUGH GOLD', '#e0453f'); return; }
    const left = this.addItem(id, 1);
    if (left > 0) { FX.toast('INVENTORY FULL', '#e0453f'); AudioSys.play('error'); return; }
    this.money -= def.buy;
    AudioSys.play('coin');
  },

  sellSlot: function (i) {
    const s = this.inv[i];
    if (!s) return;
    const def = ITEMS[s.id];
    if (!def || def.sell === undefined) return;
    const total = def.sell * s.n;
    this.money += total;
    FX.float(Player.x, Player.y - 24, '+' + total + 'G', '#f7e07a');
    this.inv[i] = null;
    AudioSys.play('coin');
  },

  sellAll: function () {
    let total = 0;
    for (let i = 4; i < this.inv.length; i++) {
      const s = this.inv[i];
      if (!s) continue;
      const def = ITEMS[s.id];
      if (!def || def.sell === undefined) continue;
      total += def.sell * s.n;
      this.inv[i] = null;
    }
    if (total <= 0) { AudioSys.play('error'); return; }
    this.money += total;
    FX.toast('SOLD EVERYTHING FOR ' + total + 'G', '#f7e07a');
    AudioSys.play('coin');
  },

// ==== day cycle: sleep, advance day, pass out ======================

  startSleep: function () {
    this.state = 'sleep';
    this.sleepT = 0;
    this.fadeDir = 1;
    this.fade = 0;
    AudioSys.play('sleep');
  },

  advanceDay: function (reason) {
    this.day += 1;
    this.timeMin = DAY_START;
    this.weather = this.nextWeather;
    this.nextWeather = this.rollWeather();
    const rainy = this.weather === 'rain' || this.weather === 'storm';
    AudioSys.setRain(rainy);

    const farm = World.maps.farm;
    for (const k in farm.soil) {
      farm.soil[k].w = rainy ? 1 : 0;
      const p = k.split(',');
      World.setTile('farm', +p[0], +p[1], rainy ? T.SOIL_WET : T.SOIL);
    }
    for (const k in farm.crops) {
      const cr = farm.crops[k];
      const wet = farm.soil[k] && farm.soil[k].w;
      const def = CROPS[cr.id];
      if (wet && (cr.grown === undefined || cr.grown < def.days)) {
        cr.grown = (cr.grown || 0) + 1;
        cr.stage = cr.grown >= def.days ? 4 : Math.min(3, Math.floor(cr.grown / def.days * 4));
      }
    }

    for (const p of farm.props) {
      if (!p.dirty && p.type !== 'tree' && p.type !== 'rock' && p.type !== 'bush') continue;
      if (p.type === 'tree' && p.state === 'stump') {
        p.timer -= 1; p.dirty = true;
        if (p.timer <= 0) { p.state = 'sprout'; p.timer = 3; }
      } else if (p.type === 'tree' && p.state === 'sprout') {
        p.timer -= 1; p.dirty = true;
        if (p.timer <= 0) { p.state = 'full'; p.hp = p.maxHp; p.timer = 0; }
      } else if (p.type === 'rock' && !p.alive) {
        p.timer -= 1; p.dirty = true;
        if (p.timer <= 0) { p.alive = true; p.hp = p.maxHp; }
      } else if (p.type === 'bush' && !p.ready) {
        p.timer -= 1; p.dirty = true;
        if (p.timer <= 0) p.ready = true;
      }
    }
    World.rebuildGrid('farm');

    let eggs = 0;
    for (const c of farm.chickens) {
      c.petted = false;
      if (Math.random() < 0.65) eggs += 1;
    }
    if (eggs > 0) {
      const left = this.addItem('egg', eggs);
      const got = eggs - left;
      if (got > 0) FX.toast('YOUR CHICKENS LAID ' + got + (got === 1 ? ' EGG' : ' EGGS'), '#f0e6d0');
      if (left > 0) FX.toast('EGGS SPOILED - INVENTORY FULL', '#e0453f');
    }

    for (const n of farm.npcs) { n.talked = false; n.giftT = 0; }

    this.deliverMail();

    if (reason === 'passout') {
      this.energy = Math.round(MAX_ENERGY * 0.55);
    } else this.energy = MAX_ENERGY;

    this.fade = 1; this.fadeDir = -1;
    this.state = 'play';
    AudioSys.play('wake');
    this.save();
    FX.toast('DAY ' + this.day + ' - ' + this.weatherName(this.weather), '#f7e07a');
    if (rainy) FX.toast('RAIN WATERS YOUR CROPS', '#a0d0f0');
  },

  passOut: function () {
    this.sleepReason = 'passout';
    this.startSleep();
  },

// ==== frame update ==================================================

  update: function (dt) {
    FX.update(dt);
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = null; }

    if (this.state === 'sleep') {
      this.sleepT += dt;
      if (this.sleepT < 1.1) this.fade = Math.min(1, this.sleepT / 1.1);
      else if (!this.dayDone) {
        this.dayDone = true;
        this.advanceDay(this.sleepReason);
      }
      return;
    }
    this.dayDone = false;

    if (this.fadeDir === -1) {
      this.fade = Math.max(0, this.fade - dt * 3.4);
      if (this.fade <= 0) this.fadeDir = 0;
    }

    if (this.state === 'dialogue') {
      const d = this.dialogue;
      if (d) {
        const full = d.pages[d.i].length;
        d.chars = Math.min(full, d.chars + dt * 46);
      }
      return;
    }

    if (this.state !== 'play') return;

    Player.update(dt);
    updateNPCs(dt);
    updateChickens(dt);

    this.timeMin += dt / SEC_PER_MIN;
    this.clockAcc += dt;
    if (this.timeMin >= DAY_END) {
      this.timeMin = DAY_END;
      FX.toast('YOU PASSED OUT FROM EXHAUSTION', '#e0453f');
      this.passOut();
      return;
    }
    if (this.energy <= 0) {
      FX.toast('YOU PASSED OUT FROM EXHAUSTION', '#e0453f');
      this.passOut();
    }
  },

// ==== hotbar helpers ===============================================

  selectSlot: function (i) {
    if (i < 0 || i > 9) return;
    if (this.selected === i) return;
    this.selected = i;
    AudioSys.play('select');
  },

  moveStack: function (arr, from, to) {
    if (from === to) return;
    if (arr === this.inv && from < 4) { AudioSys.play('error'); return; }
    const a = arr[from], b = arr[to];
    if (b && a && b.id === a.id && b.n < this.stackMax(a.id)) {
      const max = this.stackMax(a.id);
      const move = Math.min(a.n, max - b.n);
      b.n += move; a.n -= move;
      if (a.n <= 0) arr[from] = null;
    } else {
      if (arr === this.inv && to < 4 && b) { AudioSys.play('error'); return; }
      arr[from] = b; arr[to] = a;
    }
    AudioSys.play('select');
  }
};
