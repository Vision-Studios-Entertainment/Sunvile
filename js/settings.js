const SETTINGS_KEY = 'sunvale_settings_v1';

const Settings = {
  ACTIONS: [
    { id: 'up', name: 'MOVE UP' },
    { id: 'down', name: 'MOVE DOWN' },
    { id: 'left', name: 'MOVE LEFT' },
    { id: 'right', name: 'MOVE RIGHT' },
    { id: 'run', name: 'RUN' },
    { id: 'interact', name: 'INTERACT' },
    { id: 'use', name: 'USE TOOL' },
    { id: 'inventory', name: 'INVENTORY' },
    { id: 'help', name: 'HOW TO PLAY' },
    { id: 'gift', name: 'GIVE GIFT' },
    { id: 'mute', name: 'MUTE AUDIO' },
    { id: 'pause', name: 'PAUSE / BACK' }
  ],

  DEFAULTS: {
    master: 100, music: 100, sfx: 100,
    musicOn: true, muted: false,
    discordRpc: true,
    bindings: {
      up: 'w', down: 's', left: 'a', right: 'd',
      run: 'shift', interact: 'e', use: ' ',
      inventory: 'i', help: 'h', gift: 'g',
      mute: 'm', pause: 'escape'
    },
    aliases: {
      up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'],
      run: [], interact: ['enter'], use: [], inventory: ['tab'],
      help: [], gift: [], mute: [], pause: []
    }
  },

  data: null,

  load: function () {
    const d = JSON.parse(JSON.stringify(this.DEFAULTS));
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
      const num = function (v) { return typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, v)) : null; };
      if (num(saved.master) !== null) d.master = num(saved.master);
      if (num(saved.music) !== null) d.music = num(saved.music);
      if (num(saved.sfx) !== null) d.sfx = num(saved.sfx);
      if (typeof saved.musicOn === 'boolean') d.musicOn = saved.musicOn;
      if (typeof saved.muted === 'boolean') d.muted = saved.muted;
      if (typeof saved.discordRpc === 'boolean') d.discordRpc = saved.discordRpc;
      if (saved.bindings && typeof saved.bindings === 'object') {
        for (const a in d.bindings) {
          const v = saved.bindings[a];
          if (typeof v === 'string' && v.length) d.bindings[a] = v;
        }
      }
      if (saved.aliases && typeof saved.aliases === 'object') {
        for (const a in d.aliases) {
          const v = saved.aliases[a];
          if (Array.isArray(v)) d.aliases[a] = v.filter(function (x) { return typeof x === 'string' && x.length; });
        }
      }
    }
    this.data = d;
    return d;
  },

  save: function () {
    if (!this.data) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data)); } catch (e) { }
  },

  reset: function () {
    this.data = JSON.parse(JSON.stringify(this.DEFAULTS));
    this.save();
  },

  setVol: function (field, v) {
    if (!this.data) return;
    this.data[field] = Math.max(0, Math.min(100, Math.round(v)));
    this.save();
    AudioSys.applyVolumes();
  },

  actionFor: function (k) {
    const b = this.data.bindings, al = this.data.aliases;
    for (const a in b) if (b[a] === k) return a;
    for (const a in al) if (al[a].indexOf(k) >= 0) return a;
    return null;
  },

  actionName: function (id) {
    for (const a of this.ACTIONS) if (a.id === id) return a.name;
    return id.toUpperCase();
  },

  keyName: function (k) {
    if (!k) return '--';
    const map = {
      ' ': 'SPACE', 'escape': 'ESC', 'arrowup': 'UP', 'arrowdown': 'DOWN',
      'arrowleft': 'LEFT', 'arrowright': 'RIGHT', 'enter': 'ENTER',
      'shift': 'SHIFT', 'control': 'CTRL', 'alt': 'ALT', 'meta': 'META',
      'tab': 'TAB', 'backspace': 'BKSP', 'delete': 'DEL', 'capslock': 'CAPS',
      'insert': 'INS', 'pageup': 'PGUP', 'pagedown': 'PGDN', 'home': 'HOME', 'end': 'END'
    };
    return map[k] || String(k).toUpperCase();
  },

  rebind: function (action, key) {
    const b = this.data.bindings, al = this.data.aliases;
    if (!b.hasOwnProperty(action)) return;
    const prev = b[action];
    if (prev === key) return;
    for (const a in b) {
      if (a !== action && b[a] === key) b[a] = prev;
    }
    for (const a in al) {
      let i;
      while ((i = al[a].indexOf(key)) >= 0) al[a].splice(i, 1);
    }
    const taken = Object.keys(b).some(function (a) { return a !== action && b[a] === prev; });
    if (!taken && al[action].indexOf(prev) < 0) al[action].push(prev);
    b[action] = key;
    this.save();
    if (typeof Input !== 'undefined' && Input.remap) Input.remap();
  },

  resetBindings: function () {
    this.data.bindings = JSON.parse(JSON.stringify(this.DEFAULTS.bindings));
    this.data.aliases = JSON.parse(JSON.stringify(this.DEFAULTS.aliases));
    this.save();
    if (typeof Input !== 'undefined' && Input.remap) Input.remap();
  },

  moveToken: function () {
    const b = this.data.bindings;
    const order = ['up', 'left', 'down', 'right'];
    const ks = order.map(function (a) { return b[a]; });
    if (ks.every(function (k) { return k && k.length === 1; })) return ks.join('').toUpperCase();
    return ks.map(this.keyName, this).join(' ');
  },

  helpLines: function () {
    const b = this.data.bindings, al = this.data.aliases;
    const K = function (a) { return Settings.keyName(b[a]); };
    const AL = function (a) {
      return al[a] && al[a].length ? ' / ' + al[a].map(function (k) { return Settings.keyName(k); }).join(' / ') : '';
    };
    return [
      ['MOVE', this.moveToken() + AL('up')],
      ['USE TOOL', K('use') + ' / CLICK'],
      ['INTERACT', K('interact') + AL('interact')],
      ['GIVE GIFT', K('gift')],
      ['RUN', K('run')],
      ['HOTBAR', '1 - 0 KEYS'],
      ['INVENTORY', K('inventory') + AL('inventory')],
      ['JOURNAL', 'J'],
      ['MAIL', 'MAILBOX / ENVELOPE'],
      ['MUTE AUDIO', K('mute') + AL('mute')],
      ['PAUSE', K('pause') + AL('pause')],
      ['CLOSE', 'ESC']
    ];
  },

  hintLine1: function () {
    return this.moveToken() + (this.data.aliases.up.length ? ' / ARROWS' : '') + ' MOVE   ' +
      this.keyName(this.data.bindings.interact) + ' INTERACT   ' +
      this.keyName(this.data.bindings.use) + ' USE TOOL';
  },

  hintLine2: function () {
    return this.keyName(this.data.bindings.inventory) + ' INVENTORY   ' +
      this.keyName(this.data.bindings.help) + ' HELP   ' +
      this.keyName(this.data.bindings.mute) + ' MUTE   ' +
      this.keyName(this.data.bindings.pause) + ' PAUSE';
  }
};

Settings.load();
