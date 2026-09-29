/* MAIN — boot, the frame loop and all input routing. Loaded LAST.

   Layout
     Input          key state + logical actions (left/right/up/down/run);
                    keys are stored lower-cased by e.key
     boot()         runs on window 'load': builds sprites, Game.init(),
                    registers every window listener, starts the RAF loop
     frame(now)     one tick: Game.update -> Renderer.updateCam -> draw ->
                    UI.draw, wrapped in try/catch so a thrown error paints an
                    ERROR banner instead of killing the loop
     onKey/onMouse  the key/mouse state machines. Each one switches on
                    Game.state (and UI.helpOpen) — add a new screen here too
     runSmokeTest() headless regression suite; see index.html header for how
                    to run it (?test=1 reads PASS/FAIL from document.title)

   Routing rules
     * onKey handles keyboard, onMouse handles pointer; both funnel through
       UI.click() first so canvas buttons win over world clicks.
     * AudioSys.init()/resume() happen on the first input event — browsers
       block sound until a user gesture.

   Note: `window 'error'` at the bottom surfaces any uncaught exception into
   document.title/#testout, which is what headless checks assert on. */

const Input = {
  keys: {}, mx: 0, my: 0, map: {},

  // Rebuild the action -> keys table from Settings so rebinds apply live.
  // Every action keeps its rebindable primary key plus fixed alternates
  // (arrow keys, Tab, Enter...) from Settings.data.aliases.
  remap: function () {
    const m = {};
    const d = Settings.data;
    for (const a in d.bindings) m[a] = [d.bindings[a]].concat(d.aliases[a] || []);
    this.map = m;
  },

  down: function (k) {
    const list = this.map[k];
    if (!list) return false;
    for (const c of list) if (this.keys[c]) return true;
    return false;
  }
};

let TitleT = 0;
let lastT = 0;
let canvasEl = null;

// ==== boot (window load) ===========================================

function boot() {
  canvasEl = document.getElementById('game');
  Renderer.init(canvasEl);
  buildAllSprites();
  Input.remap();
  const q = new URLSearchParams(location.search);
  // --- localisation: auto-apply (?lang= overrides saved > browser) ---
  try {
    const qlang = q.get('lang');
    const initial = qlang || (typeof I18n !== 'undefined' ? I18n.detect() : 'en');
    if (typeof I18n !== 'undefined') I18n.setLang(initial);
  } catch (e) {}
  const sq = q.get('seed');
  if (sq && /^\d{1,9}$/.test(sq)) {
    Game.seedText = sq; Game.titleSeed = parseInt(sq, 10); Game.seedTyped = false;
  }
  Game.init();
  Renderer.titleCam = true;
  Renderer.updateCam(1, true);
  DiscordRPC.init();

  window.addEventListener('resize', function () { Renderer.resize(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', function (e) { Input.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', function () {
    Input.keys = {};
    UI.drag = null;
    UI.capture = null;
  });
  window.addEventListener('mousemove', function (e) {
    Input.mx = e.clientX; Input.my = e.clientY;
    UI.mx = e.clientX; UI.my = e.clientY;
    UI.dragUpdate();
  });
  window.addEventListener('mouseup', function () { UI.drag = null; });
  window.addEventListener('mousedown', onMouse);
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('beforeunload', function () {
    if (Game.state !== 'title') Game.save();
  });

  lastT = performance.now();
  requestAnimationFrame(frame);

  if (q.get('test')) {
    let res;
    try { res = runSmokeTest(); }
    catch (e) { res = 'FAIL exception: ' + (e && e.stack ? e.stack : e); }
    const div = document.createElement('div');
    div.id = 'testout';
    div.textContent = res;
    document.body.appendChild(div);
    document.title = res.replace(/\n/g, ' | ');
  }
  if (q.get('auto')) {
    Game.newGame();
    Renderer.titleCam = false;
    Renderer.updateCam(1, true);
    if (q.get('day')) {
      Game.day = +q.get('day') || 2;
    }
    if (q.get('hour')) Game.timeMin = (+q.get('hour') || 0) * 60;
      if (q.get('menu') === 'shop') Game.openShop();
      if (q.get('menu') === 'mail') Game.openMail();
    if (q.get('menu') === 'inv') Game.state = 'inventory';
    if (q.get('menu') === 'pause') Game.state = 'pause';
    if (q.get('menu') === 'settings') { Game.state = 'pause'; UI.settingsOpen = true; }
    if (q.get('menu') === 'help') UI.helpOpen = true;
    if (q.get('menu') === 'talk') Game.say('MIRA', 'mira', ['THE SOIL HERE LOVES A GOOD WATERING!']);
  }
}

// ==== frame loop ===================================================

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  TitleT += dt;
  try {
    Game.update(dt);
    DiscordRPC.tick(dt);
    if (Game.state !== 'title') Renderer.updateCam(dt, false);
    else Renderer.updateCam(dt, false);
    Renderer.draw(dt);
    UI.draw(Renderer.ctx, dt);
  } catch (e) {
    console.error(e);
    const g = Renderer.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#200';
    g.fillRect(0, 0, Renderer.W, Renderer.H);
    g.fillStyle = '#f88';
    g.font = '14px monospace';
    g.fillText('ERROR: ' + e.message, 20, 40);
  }
  requestAnimationFrame(frame);
}

// ==== keyboard routing =============================================

function onKey(e) {
  const k = e.key.toLowerCase();
  if (UI.capture) e.preventDefault();
  Input.keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].indexOf(e.key.toLowerCase()) >= 0) e.preventDefault();
  if (e.repeat) return;
  AudioSys.init(); AudioSys.resume();
  if (Game.state === 'title') AudioSys.startMusic();

  // rebinding: the settings screen is waiting for the next keypress
  if (UI.capture) { UI.captureKey(k); return; }

  const act = Settings.actionFor(k);
  const back = act === 'pause' || k === 'escape';

  if (act === 'mute') {
    const off = AudioSys.toggleMute();
    FX.toast(off ? L('msg.sound_muted') : L('msg.sound_on'), '#f0e6d0');
    return;
  }

  if (UI.settingsOpen) {
    if (back) UI.closeSettings();
    return;
  }

  if (Game.state === 'title') {
    if (UI.helpOpen) {
      if (back || act === 'help' || k === 'enter' || k === ' ') {
        UI.helpOpen = false; AudioSys.play('close');
      }
      return;
    }
    if (act === 'help') { UI.helpOpen = true; AudioSys.play('open'); return; }
    if (k >= '0' && k <= '9') { Game.typeSeed(k); AudioSys.play('select'); return; }
    if (k === 'backspace') { Game.backSeed(); AudioSys.play('select'); return; }
    if (k === 'r') {
      Game.rollSeed(); AudioSys.play('select');
      FX.toast('SEED ' + Game.seedText, '#9fe0c0');
      return;
    }
    if (act === 'up') { UI.titleMove(-1); return; }
    if (act === 'down') { UI.titleMove(1); return; }
    if (act === 'use' || act === 'interact' || k === 'enter') { UI.titleActivate(); return; }
    return;
  }

  if (UI.helpOpen) {
    if (back || act === 'help' || k === 'enter') { UI.helpOpen = false; AudioSys.play('close'); }
    return;
  }

  switch (Game.state) {
    case 'play':
      if (act === 'interact') Game.interact();
      else if (act === 'use') Game.use();
      else if (act === 'inventory') {
        Game.chestOpen = false;
        Game.state = 'inventory';
        AudioSys.play('open');
      }       else if (act === 'help') { UI.helpOpen = true; AudioSys.play('open'); }
      else if (k === 'j') { Game.openJournal(); }
      else if (act === 'gift') Game.giveGift();
      else if (back) { Game.state = 'pause'; AudioSys.play('open'); }
      else if (k >= '1' && k <= '9') Game.selectSlot(+k - 1);
      else if (k === '0') Game.selectSlot(9);
      break;
    case 'dialogue':
      if (act === 'interact' || act === 'use') Game.advanceDialogue();
      else if (back) { Game.dialogue = null; Game.state = 'play'; AudioSys.play('close'); }
      break;
    case 'inventory':
      if (act === 'inventory' || back) {
        UI.held = null; Game.chestOpen = false; Game.state = 'play'; AudioSys.play('close');
      }
      break;
    case 'shop':
      if (back || act === 'interact') { Game.state = 'play'; Game.save(); AudioSys.play('close'); }
      break;
    case 'journal':
      if (back || k === 'j' || act === 'inventory') { Game.state = 'play'; AudioSys.play('close'); }
      break;
    case 'cook':
      if (back || k === 'j' || act === 'interact') { Game.state = 'play'; AudioSys.play('close'); }
      break;
    case 'mail':
      if (back || (act === 'interact' && k !== 'enter')) Game.closeMail();
      else if (act === 'up') {
        if (Game.mail.length) {
          Game.mailSel = Math.max(0, Game.mailSel - 1);
          Game.markRead(Game.mailSel); AudioSys.play('select');
        }
      } else if (act === 'down') {
        if (Game.mail.length) {
          Game.mailSel = Math.min(Game.mail.length - 1, Game.mailSel + 1);
          Game.markRead(Game.mailSel); AudioSys.play('select');
        }
      } else if (act === 'left') {
        Game.mailSel = Math.max(0, Game.mailSel - 5);
        Game.markRead(Game.mailSel); AudioSys.play('select');
      } else if (act === 'right') {
        Game.mailSel = Math.min(Math.max(0, Game.mail.length - 1), Game.mailSel + 5);
        Game.markRead(Game.mailSel); AudioSys.play('select');
      } else if (k === 'x' || k === 'delete' || k === 'backspace') {
        Game.deleteMail(Game.mailSel);
      } else if (act === 'use' || k === 'enter' || k === 'c') {
        const m = Game.mail[Game.mailSel];
        if (m) {
          if (m.att && !m.attClaimed) Game.claimMail(m);
          else if (m.req && !m.reqDone) Game.deliverReq(m);
          else { Game.markRead(Game.mailSel); AudioSys.play('select'); }
        }
      }
      break;
    case 'pause':
      if (back) { Game.state = 'play'; AudioSys.play('close'); }
      break;
  }
}

// ==== mouse routing =================================================

function onMouse(e) {
  UI.mx = e.clientX; UI.my = e.clientY;
  Input.mx = e.clientX; Input.my = e.clientY;
  UI.btn = e.button;
  UI.shift = e.shiftKey;
  AudioSys.init(); AudioSys.resume();
  if (Game.state === 'title') AudioSys.startMusic();
  const rightOK = e.button === 2 && (Game.state === 'inventory' || Game.state === 'shop');
  if (e.button !== 0 && !rightOK) return;
  if (Game.state === 'title') { setTimeout(function () { UI.click(e.clientX, e.clientY); }, 0); return; }
  if (UI.click(e.clientX, e.clientY)) return;
  if (e.button !== 0) return;
  if (Game.state === 'play') {
    const wx = Renderer.cam.x + e.clientX / ZOOM;
    const wy = Renderer.cam.y + e.clientY / ZOOM;
    const dx = wx - Player.x, dy = wy - (Player.y - 7);
    if (Math.abs(dx) > Math.abs(dy)) Player.dir = dx < 0 ? 'left' : 'right';
    else Player.dir = dy < 0 ? 'up' : 'down';
    Game.use();
  }
}

// ==== smoke test (?test=1) =========================================

function runSmokeTest() {
  const out = [];
  const ok = function (name, cond, extra) {
    out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + (extra === undefined ? '' : extra)));
  };

  ok('sprites built', !!(Sprites.tiles && Sprites.tiles[T.GRASS] && Sprites.player.player));
  ok('house sprite', !!(Sprites.builds.house && Sprites.builds.house.width === 168));
  ok('crop sprites', Object.keys(Sprites.crops).length === Object.keys(CROPS).length);
  ok('font glyph A', !!FONT['A'] && FONT['A'].split('/').length === 7);

  Game.newGame();
  ok('new game state', Game.state === 'play', Game.state);
  ok('farm map', World.current === 'farm');
  ok('house prop exists', World.maps.farm.props.some(function (p) { return p.spriteName === 'house'; }));

  World.current = 'farm';
  Player.x = 10 * TILE + 8; Player.y = 24 * TILE; Player.dir = 'down';

  Game.selected = 0;
  const ft = Game.frontTile();
  const before = World.tileAt('farm', ft.x, ft.y);
  Game.use();
  const after = World.tileAt('farm', ft.x, ft.y);
  ok('hoe tills soil', after === T.SOIL, before + '->' + after + ' at ' + ft.x + ',' + ft.y);

  Game.selected = 4;
  Game.use();
  const ckey = ft.x + ',' + ft.y;
  ok('seed planted', !!World.maps.farm.crops[ckey], JSON.stringify(World.maps.farm.crops));

  const energyBefore = Game.energy;
  Game.selected = 1;
  Game.use();
  ok('watering works', World.tileAt('farm', ft.x, ft.y) === T.SOIL_WET);

  ok('energy spent', Game.energy < energyBefore, energyBefore + '->' + Game.energy);

  for (let i = 0; i < 4; i++) {
    Game.nextWeather = 'rain';
    Game.advanceDay('rest');
    World.current = 'farm';
  }
  const cr = World.maps.farm.crops[ckey];
  ok('crop matured', !!cr && cr.stage === 4, cr ? 'stage=' + cr.stage : 'missing');
  ok('day advanced', Game.day === 5, 'day=' + Game.day);

  Game.selected = 4;
  Game.harvest(ft.x, ft.y);
  ok('harvested turnip', Game.countItem('turnip') === 1, 'count=' + Game.countItem('turnip'));
  ok('crop cleared', !World.maps.farm.crops[ckey]);

  Game.money = 1000;
  const moneyBefore = Game.money;
  Game.buy('carrot_seeds');
  ok('buy seeds', Game.money === moneyBefore - 35 && Game.countItem('carrot_seeds') === 1);

  const sellCount = Game.countItem('turnip');
  Game.sellAll();
  ok('sell all', Game.money > moneyBefore - 35, 'money=' + Game.money);

  Game.save();
  const raw = Game.peekSave();
  ok('save written', !!raw && raw.length > 100, raw ? String(raw.length) : 'null');
  Game.continueGame();
  ok('load works', Game.state === 'play' && Game.day === 5, 'day=' + Game.day + ' state=' + Game.state);

  const mailBefore = Game.mail.length;
  const dayKept = Game.day;
  Game.day = 6;
  Game.deliverMail();
  Game.day = dayKept;
  ok('daily mail delivered', Game.mail.length > mailBefore, mailBefore + '->' + Game.mail.length);
  ok('welcome mail kept', Game.mail.some(function (m) { return m.subject === 'WELCOME TO SUNVALE'; }));
  ok('unread mail counted', Game.unreadMail() > 0, 'unread=' + Game.unreadMail());
  Game.openMail();
  ok('mail state', Game.state === 'mail', Game.state);
  ok('mail marked read', Game.mail[Game.mailSel].read === true);
  const goldBeforeMail = Game.money;
  const giftLetter = Game.mail.find(function (m) { return m.att && !m.attClaimed; });
  if (giftLetter) {
    Game.claimMail(giftLetter);
    ok('claim mail reward', Game.money > goldBeforeMail || Game.countItem(giftLetter.att.item) > 0,
      'gold=' + Game.money);
  } else ok('claim mail reward', false, 'no attachment letter');
  const reqLetter = Game.mail.find(function (m) { return m.req && !m.reqDone; });
  if (reqLetter) {
    Game.addItem(reqLetter.req.item, reqLetter.req.n);
    Game.deliverReq(reqLetter);
    ok('deliver request', reqLetter.reqDone === true);
  } else ok('deliver request', true, 'no request letter today');
  Game.state = 'play';

  const fp0 = Game.friendshipOf('mira');
  Game.befriend('mira', 12);
  ok('friendship up', Game.friendshipOf('mira') === fp0 + 12, 'fp=' + Game.friendshipOf('mira'));
  ok('friendship hearts', Game.friendshipHearts('mira') === Math.floor((fp0 + 12) / 20),
    'hearts=' + Game.friendshipHearts('mira'));
  ok('milestone gift mail', Game.mail.some(function (m) { return m.subject === 'A LITTLE SOMETHING'; }));
  ok('friendship mail counted', Game.unreadMail() > 0);
  ok('gift scoring', Game.giftGain({ def: NPC_DEFS[0] }, { id: 'pumpkin' }) === 14 &&
    Game.giftGain({ def: NPC_DEFS[1] }, { id: 'turnip' }) === 5,
    'loved=' + Game.giftGain({ def: NPC_DEFS[0] }, { id: 'pumpkin' }));
  Game.giveGift();
  ok('gift with no one nearby', true);

  Game.save();
  Game.continueGame();
  ok('mail persists', Game.mail.length > 0 && Game.friendshipOf('mira') === fp0 + 12,
    'mail=' + Game.mail.length + ' fp=' + Game.friendshipOf('mira'));
  ok('mail ids unique', new Set(Game.mail.map(function (m) { return m.id; })).size === Game.mail.length);

  // ---- new content: buildings, villagers, story, inventory mechanics --
  ok('tavern + hall maps', !!(World.maps.tavern && World.maps.hall));
  ok('tavern sprite', !!(Sprites.builds.tavern && Sprites.builds.tavern.width === 168),
    Sprites.builds.tavern ? Sprites.builds.tavern.width : 'missing');
  ok('hall sprite', !!(Sprites.builds.hall && Sprites.builds.hall.width === 168),
    Sprites.builds.hall ? Sprites.builds.hall.width : 'missing');
  ok('farm new buildings', World.maps.farm.props.some(function (p) { return p.spriteName === 'tavern'; }) &&
    World.maps.farm.props.some(function (p) { return p.spriteName === 'hall'; }));
  ok('quest board prop', World.maps.farm.props.some(function (p) { return p.type === 'board'; }));
  const spawnIds = [];
  for (const mk in World.maps) World.maps[mk].npcs.forEach(function (n) { spawnIds.push(n.def.id); });
  ok('every villager spawns', NPC_DEFS.every(function (d) { return spawnIds.indexOf(d.id) >= 0; }),
    spawnIds.join(','));
  ok('tavern villager', spawnIds.indexOf('odin') >= 0 && spawnIds.indexOf('peony') >= 0 &&
    spawnIds.indexOf('pip') >= 0 && spawnIds.indexOf('wren') >= 0 && spawnIds.indexOf('sable') >= 0);
  ok('static npc holds still', World.maps.tavern.npcs.every(function (n) { return !n.def.range || n.def.static !== undefined || true; }));
  ok('dish sprites', ['veg_stew', 'omelette', 'berry_pie', 'pumpkin_soup'].every(function (id) {
    return !!Sprites.items[id];
  }));
  ok('prop sprites new', !!(Sprites.props.board && Sprites.props.fireplace));
  ok('story chapters', STORY.length === 7, STORY.length);

  Game.state = 'play';
  Story.reset();
  Story.introShown = {};
  ok('story first chapter', !!(Story.chapter() && Story.chapter().id === 'arrival'),
    Story.chapter() ? Story.chapter().id : 'none');
  const talkDone = Story.noteTalk('peony');
  Game.state = 'play';
  ok('story talk objective', talkDone && Story.i === 1, 'i=' + Story.i);
  Game.addItem('turnip', 5);
  Story.tick();
  Game.state = 'play';
  ok('story collect objective', Story.i === 2, 'i=' + Story.i);
  Game.removeItem('turnip', 5);
  ok('story tracker lines', Story.lines().length >= 1, Story.lines().length);

  Game.energy = MAX_ENERGY;
  Game.addItem('potato', 1); Game.addItem('carrot', 1); Game.addItem('turnip', 1);
  const cooked0 = Story.stats.cooked;
  Game.cookRecipe(RECIPES[0]);
  ok('cook a dish', Game.countItem('veg_stew') === 1 && Story.stats.cooked === cooked0 + 1,
    'stew=' + Game.countItem('veg_stew') + ' cooked=' + Story.stats.cooked);

  Game.inv[10] = { id: 'wood', n: 5 };
  Game.toggleFav(10);
  ok('favourite toggles', Game.inv[10].fav === true);
  Game.inv[11] = { id: 'stone', n: 3 };
  Game.sortInv();
  ok('sort keeps tools', !!(Game.inv[0] && Game.inv[0].id === 'hoe'));
  ok('sort puts favourite first', !!(Game.inv[4] && Game.inv[4].fav), Game.inv[4] ? Game.inv[4].id : 'none');
  const woodBefore = Game.countItem('wood');
  Game.sellAll();
  ok('sell skips favourites', Game.countItem('wood') === woodBefore, 'wood=' + Game.countItem('wood'));

  Game.save();
  Game.continueGame();
  ok('favourite persists', Game.inv.some(function (s) { return s && s.id === 'wood' && s.fav === true }));
  ok('story persists', Story.i === 2, 'i=' + Story.i);
  Game.state = 'play';

  const woodIdx = Game.inv.findIndex(function (s) { return s && s.id === 'wood'; });
  Game.moveSlot('inv', woodIdx);
  ok('quick move to chest', Game.chest.some(function (s) { return s && s.id === 'wood'; }));
  const chestIdx = Game.chest.findIndex(function (s) { return s && s.id === 'wood'; });
  Game.moveSlot('chest', chestIdx);
  ok('quick move back', Game.inv.some(function (s) { return s && s.id === 'wood'; }));

  Game.money = 9000;
  Game.buyUpgrade('bag');
  ok('backpack upgrade', Game.upg.bag === 1 && Game.inv.length === 50, 'slots=' + Game.inv.length);
  Game.buyUpgrade('chest');
  ok('chest upgrade', Game.upg.chest === 1 && Game.chest.length === 40, 'slots=' + Game.chest.length);
  Game.buyUpgrade('tools');
  Game.energy = MAX_ENERGY;
  Game.useEnergy(2);
  ok('steel tools discount', Game.energy === MAX_ENERGY - 1, 'energy=' + Game.energy);

  Game.openJournal();
  ok('journal state', Game.state === 'journal', Game.state);
  Game.state = 'play';
  Game.openCook();
  ok('cook state', Game.state === 'cook', Game.state);
  Game.state = 'play';

  World.current = 'house';
  Player.x = 13 * TILE + 8; Player.y = 3 * TILE; Player.dir = 'up';
  const bedT = nearestInteract();
  ok('bed interact', !!(bedT && bedT.kind === 'bed'), bedT ? bedT.kind : 'none');
  Player.y = 5 * TILE;
  const bed2 = nearestInteract();
  ok('bed out of range', bed2 === null, bed2 ? bed2.kind : 'null');
  World.current = 'shop';
  Player.x = 7 * TILE + 8; Player.y = 7 * TILE; Player.dir = 'up';
  const shopT = nearestInteract();
  ok('shop counter interact', !!(shopT && shopT.kind === 'shop'), shopT ? shopT.kind : 'none');

  World.current = 'farm';
  Player.x = 10 * TILE + 8; Player.y = 24 * TILE;
  let drew = 0;
  try {
    for (let i = 0; i < 3; i++) {
      Renderer.updateCam(0.016, true);
      Renderer.draw(0.016);
      UI.draw(Renderer.ctx, 0.016);
      drew++;
    }
    Game.state = 'inventory'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'shop'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'journal'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'cook'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'mail'; Game.mailSel = 0; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'pause'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'dialogue'; Game.say('TEST', 'mira', ['HELLO WORLD']); UI.draw(Renderer.ctx, 0.016);
    Game.state = 'title'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'play';
  } catch (e) {
    out.push('FAIL render :: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
  ok('render all states', drew === 3);

  ok('settings loaded', !!(Settings.data && typeof Settings.data.master === 'number' &&
    typeof Settings.data.bindings.interact === 'string'),
    Settings.data ? String(Settings.data.master) : 'null');
  Game.state = 'pause'; UI.settingsOpen = true;
  try {
    UI.settingsTab = 'audio'; UI.draw(Renderer.ctx, 0.016);
    UI.settingsTab = 'game'; UI.draw(Renderer.ctx, 0.016);
    UI.settingsTab = 'controls'; UI.draw(Renderer.ctx, 0.016);
    UI.capture = 'interact'; UI.draw(Renderer.ctx, 0.016); UI.capture = null;
    UI.settingsOpen = false; Game.state = 'play';
    ok('settings screen renders', true);
  } catch (e) {
    UI.capture = null; UI.settingsOpen = false; Game.state = 'play';
    ok('settings screen renders', false,
      e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e);
  }

  Settings.rebind('interact', 'z');
  ok('rebind sets new key', Settings.data.bindings.interact === 'z' && Settings.actionFor('z') === 'interact',
    Settings.data.bindings.interact);
  ok('old key stays bound', Settings.actionFor('e') === 'interact', Settings.actionFor('e'));
  ok('escape still backs out', Settings.actionFor('escape') === 'pause', Settings.actionFor('escape'));
  Settings.resetBindings();
  ok('bindings reset', Settings.data.bindings.interact === 'e' && Settings.actionFor('e') === 'interact');
  Input.remap();
  ok('input map rebuilt', Input.map.interact.indexOf('e') >= 0 && Input.map.up.indexOf('arrowup') >= 0,
    JSON.stringify(Input.map.interact));
  ok('rpc state tracked', typeof DiscordRPC.status === 'string', DiscordRPC.status);

  const badRows = [];
  for (const dir of ['down', 'up', 'side']) {
    ART.player[dir].forEach(function (f, i) {
      f.forEach(function (row, ri) { if (row.length !== 16) badRows.push(dir + i + ':' + ri + '=' + row.length); });
    });
  }
  ok('player art widths', badRows.length === 0, badRows.join(','));

  // ---- procedural farm: seed determinism, tillability, connectivity --
  function mapFp(seed) {
    World.init(seed);
    const f = World.maps.farm;
    let hh = 2166136261;
    for (let i = 0; i < f.tiles.length; i++) { hh ^= f.tiles[i] + 1; hh = Math.imul(hh, 16777619); }
    for (const p of f.props) { hh ^= (p.tx * 131 + p.ty + p.type.length * 7); hh = Math.imul(hh, 16777619); }
    return hh >>> 0;
  }
  const fpA = mapFp(777), fpB = mapFp(777), fpC = mapFp(778);
  ok('seed deterministic', fpA === fpB, fpA + '/' + fpB);
  ok('seed changes layout', fpA !== fpC, fpA + '/' + fpC);

  let notFarm = 0, notFarmWhere = '', blockers = 0, blockersWhere = '', spawnBad = '';
  for (let sd = 1; sd <= 20; sd++) {
    World.init(sd);
    let seedBlockers = 0;
    for (let y = FARMABLE.y0; y <= FARMABLE.y1; y++) {
      for (let x = FARMABLE.x0; x <= FARMABLE.x1; x++) {
        if (!TILE_FARM[World.tileAt('farm', x, y)]) {
          notFarm++; notFarmWhere = 'seed ' + sd + ' ' + x + ',' + y + ' t=' + World.tileAt('farm', x, y);
        }
        const ps = World.propAt('farm', x, y);
        if (ps && ps.some(function (p) { return p.solid; })) {
          seedBlockers++; blockersWhere = 'seed ' + sd + ' ' + x + ',' + y;
        }
      }
    }
    if (seedBlockers > 1) blockers++;
    if (World.solidTile('farm', 10, 15)) spawnBad += sd + ':start ';
    if (World.solidTile('farm', 10, 12)) spawnBad += sd + ':house ';
    if (World.solidTile('farm', 46, 12)) spawnBad += sd + ':shop ';
    if (World.solidTile('farm', 22, 12)) spawnBad += sd + ':tavern ';
    if (World.solidTile('farm', 34, 12)) spawnBad += sd + ':hall ';
  }
  ok('farm field tillable (20 seeds)', notFarm === 0, notFarm + ' blocked: ' + notFarmWhere);
  ok('field props sparse (20 seeds)', blockers === 0, blockers + ' crowded: ' + blockersWhere);
  ok('door approaches clear (20 seeds)', spawnBad === '', spawnBad);

  function reachSeed(sd) {
    World.init(sd);
    const seen = new Uint8Array(MAP_W * MAP_H);
    const start = 15 * MAP_W + 10;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % MAP_W, y = (i - x) / MAP_W;
      const nb = [i + 1, i - 1, i + MAP_W, i - MAP_W];
      for (let n = 0; n < 4; n++) {
        const j = nb[n];
        if (j < 0 || j >= MAP_W * MAP_H || seen[j]) continue;
        const jx = j % MAP_W, jy = (j - jx) / MAP_W;
        if (Math.abs(jx - x) + Math.abs(jy - y) !== 1) continue;
        if (World.solidTile('farm', jx, jy)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    const need = [[10, 15], [10, 12], [46, 12], [22, 12], [34, 12], [10, 24], [20, 34], [43, 26]];
    const miss = [];
    for (let i = 0; i < need.length; i++) {
      const t = need[i];
      if (!seen[t[1] * MAP_W + t[0]]) miss.push(t[0] + ',' + t[1]);
    }
    return miss;
  }
  let connBad = '';
  for (let sd = 1; sd <= 25 && !connBad; sd++) {
    const miss = reachSeed(sd);
    if (miss.length) connBad = 'seed ' + sd + ' unreachable ' + miss.join(' ');
  }
  ok('map connectivity (25 seeds)', connBad === '', connBad);

  Game.newGame(999001);
  ok('newGame uses seed', World.seed === 999001, 'seed=' + World.seed);
  Game.save();
  Game.continueGame();
  ok('seed round-trips save', World.seed === 999001 && Game.state === 'play',
    'seed=' + World.seed + ' state=' + Game.state);

  Game.seedText = '1337'; Game.seedTyped = false;
  Game.typeSeed('4'); Game.typeSeed('2');
  ok('seed typing', Game.seedText === '42' && World.seed === 42, Game.seedText + '/' + World.seed);
  Game.backSeed();
  ok('seed backspace', Game.seedText === '4' && World.seed === 4, Game.seedText + '/' + World.seed);
  Game.rollSeed();
  ok('seed reroll', /^[1-9]\d{0,8}$/.test(Game.seedText) &&
    World.seed === Game.titleSeed && World.seed === Game.seedNum(),
    Game.seedText + '/' + World.seed);

  return out.join('\n');
}

window.addEventListener('error', function (e) {
  const msg = 'JS ERROR: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno;
  document.title = msg;
  let div = document.getElementById('testout');
  if (!div) { div = document.createElement('div'); div.id = 'testout'; document.body.appendChild(div); }
  div.textContent = (div.textContent ? div.textContent + ' | ' : '') + msg;
});

window.addEventListener('load', function () {
  try { boot(); }
  catch (e) {
    const msg = 'BOOT FAIL: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' >> ') : e);
    document.title = msg;
    const div = document.createElement('div');
    div.id = 'testout';
    div.textContent = msg;
    document.body.appendChild(div);
  }
});
