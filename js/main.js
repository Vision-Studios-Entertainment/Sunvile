const Input = {
  keys: {}, mx: 0, my: 0,
  map: {
    left: ['a', 'arrowleft'], right: ['d', 'arrowright'],
    up: ['w', 'arrowup'], down: ['s', 'arrowdown'], run: ['shift']
  },
  down: function (k) {
    const list = this.map[k];
    for (const c of list) if (this.keys[c]) return true;
    return false;
  }
};

let TitleT = 0;
let lastT = 0;
let canvasEl = null;

function boot() {
  canvasEl = document.getElementById('game');
  Renderer.init(canvasEl);
  buildAllSprites();
  Game.init();
  Renderer.titleCam = true;
  Renderer.updateCam(1, true);

  window.addEventListener('resize', function () { Renderer.resize(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', function (e) { Input.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', function () { Input.keys = {}; });
  window.addEventListener('mousemove', function (e) {
    Input.mx = e.clientX; Input.my = e.clientY;
    UI.mx = e.clientX; UI.my = e.clientY;
  });
  window.addEventListener('mousedown', onMouse);
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('beforeunload', function () {
    if (Game.state !== 'title') Game.save();
  });

  lastT = performance.now();
  requestAnimationFrame(frame);

  const q = new URLSearchParams(location.search);
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
    if (q.get('menu') === 'help') UI.helpOpen = true;
    if (q.get('menu') === 'talk') Game.say('MIRA', 'mira', ['THE SOIL HERE LOVES A GOOD WATERING!']);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  TitleT += dt;
  try {
    Game.update(dt);
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

function onKey(e) {
  const k = e.key.toLowerCase();
  Input.keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].indexOf(e.key.toLowerCase()) >= 0) e.preventDefault();
  if (e.repeat) return;
  AudioSys.init(); AudioSys.resume();

  if (k === 'm') {
    const off = AudioSys.toggleMute();
    FX.toast(off ? 'SOUND MUTED' : 'SOUND ON', '#f0e6d0');
    return;
  }

  if (Game.state === 'title') {
    if (k === 'enter' || k === ' ') {
      if (Game.hasSave) Game.continueGame(); else Game.newGame();
      Renderer.titleCam = false;
      Renderer.updateCam(1, true);
    }
    return;
  }

  if (UI.helpOpen) {
    if (k === 'escape' || k === 'h' || k === 'enter') { UI.helpOpen = false; AudioSys.play('close'); }
    return;
  }

  switch (Game.state) {
    case 'play':
      if (k === 'e' || k === 'enter') Game.interact();
      else if (k === ' ') Game.use();
      else if (k === 'i' || k === 'tab') {
        Game.chestOpen = false;
        Game.state = 'inventory';
        AudioSys.play('open');
      }       else if (k === 'h') { UI.helpOpen = true; AudioSys.play('open'); }
      else if (k === 'g') Game.giveGift();
      else if (k === 'escape') { Game.state = 'pause'; AudioSys.play('open'); }
      else if (k >= '1' && k <= '9') Game.selectSlot(+k - 1);
      else if (k === '0') Game.selectSlot(9);
      break;
    case 'dialogue':
      if (k === 'e' || k === 'enter' || k === ' ') Game.advanceDialogue();
      else if (k === 'escape') { Game.dialogue = null; Game.state = 'play'; AudioSys.play('close'); }
      break;
    case 'inventory':
      if (k === 'i' || k === 'tab' || k === 'escape') {
        UI.held = null; Game.chestOpen = false; Game.state = 'play'; AudioSys.play('close');
      }
      break;
    case 'shop':
      if (k === 'escape' || k === 'e') { Game.state = 'play'; Game.save(); AudioSys.play('close'); }
      break;
    case 'mail':
      if (k === 'escape' || k === 'e') Game.closeMail();
      else if (k === 'arrowup' || k === 'w') {
        if (Game.mail.length) {
          Game.mailSel = Math.max(0, Game.mailSel - 1);
          Game.markRead(Game.mailSel); AudioSys.play('select');
        }
      } else if (k === 'arrowdown' || k === 's') {
        if (Game.mail.length) {
          Game.mailSel = Math.min(Game.mail.length - 1, Game.mailSel + 1);
          Game.markRead(Game.mailSel); AudioSys.play('select');
        }
      } else if (k === 'arrowleft' || k === 'a') {
        Game.mailSel = Math.max(0, Game.mailSel - 5);
        Game.markRead(Game.mailSel); AudioSys.play('select');
      } else if (k === 'arrowright' || k === 'd') {
        Game.mailSel = Math.min(Math.max(0, Game.mail.length - 1), Game.mailSel + 5);
        Game.markRead(Game.mailSel); AudioSys.play('select');
      } else if (k === 'x' || k === 'delete' || k === 'backspace') {
        Game.deleteMail(Game.mailSel);
      } else if (k === 'enter' || k === ' ' || k === 'c') {
        const m = Game.mail[Game.mailSel];
        if (m) {
          if (m.att && !m.attClaimed) Game.claimMail(m);
          else if (m.req && !m.reqDone) Game.deliverReq(m);
          else { Game.markRead(Game.mailSel); AudioSys.play('select'); }
        }
      }
      break;
    case 'pause':
      if (k === 'escape') { Game.state = 'play'; AudioSys.play('close'); }
      break;
  }
}

function onMouse(e) {
  UI.mx = e.clientX; UI.my = e.clientY;
  Input.mx = e.clientX; Input.my = e.clientY;
  AudioSys.init(); AudioSys.resume();
  if (e.button !== 0) return;
  if (Game.state === 'title') { setTimeout(function () { UI.click(e.clientX, e.clientY); }, 0); return; }
  if (UI.click(e.clientX, e.clientY)) return;
  if (Game.state === 'play') {
    const wx = Renderer.cam.x + e.clientX / ZOOM;
    const wy = Renderer.cam.y + e.clientY / ZOOM;
    const dx = wx - Player.x, dy = wy - (Player.y - 7);
    if (Math.abs(dx) > Math.abs(dy)) Player.dir = dx < 0 ? 'left' : 'right';
    else Player.dir = dy < 0 ? 'up' : 'down';
    Game.use();
  }
}

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
  Game.deliverMail();
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
    Game.state = 'mail'; Game.mailSel = 0; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'pause'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'dialogue'; Game.say('TEST', 'mira', ['HELLO WORLD']); UI.draw(Renderer.ctx, 0.016);
    Game.state = 'title'; UI.draw(Renderer.ctx, 0.016);
    Game.state = 'play';
  } catch (e) {
    out.push('FAIL render :: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
  ok('render all states', drew === 3);

  const badRows = [];
  for (const dir of ['down', 'up', 'side']) {
    ART.player[dir].forEach(function (f, i) {
      f.forEach(function (row, ri) { if (row.length !== 16) badRows.push(dir + i + ':' + ri + '=' + row.length); });
    });
  }
  ok('player art widths', badRows.length === 0, badRows.join(','));

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
