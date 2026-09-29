const DiscordRPC = {
  url: 'ws://127.0.0.1:6464',
  ws: null, bridge: null,
  enabled: false, connected: false, connecting: false,
  status: 'OFF', started: 0, t: 0, retry: 0, sig: '',

  init: function () {
    this.enabled = !!(Settings.data && Settings.data.discordRpc);
    this.started = Math.floor(Date.now() / 1000);
    this.status = 'OFF';
    if (this.enabled) { this.connect(); this.push(true); }
  },

  setEnabled: function (on) {
    Settings.data.discordRpc = !!on;
    Settings.save();
    this.enabled = !!on;
    if (this.enabled) {
      this.started = Math.floor(Date.now() / 1000);
      this.status = 'CONNECTING';
      this.connect();
      this.push(true);
    } else {
      if (this.connected) this.send({ cmd: 'CLEAR_ACTIVITY', args: {} });
      this.disconnect();
      this.status = 'OFF';
    }
  },

  connect: function () {
    if (!this.enabled || this.connected || this.connecting) return;
    if (window.AetherRPC && typeof window.AetherRPC.send === 'function') {
      this.bridge = window.AetherRPC;
      this.connected = true;
      this.status = 'LAUNCHER';
      this.push(true);
      return;
    }
    let ws = null;
    try { ws = new WebSocket(this.url); } catch (e) { this.status = 'NO BRIDGE'; return; }
    this.connecting = true;
    this.status = 'CONNECTING';
    this.ws = ws;
    const self = this;
    ws.onopen = function () {
      self.connecting = false;
      self.connected = true;
      self.status = 'ONLINE';
      self.push(true);
    };
    ws.onerror = function () { };
    ws.onclose = function () {
      self.connecting = false;
      self.connected = false;
      self.ws = null;
      self.status = self.enabled ? 'NO BRIDGE' : 'OFF';
      self.retry = 20;
    };
  },

  disconnect: function () {
    this.connecting = false;
    this.connected = false;
    this.bridge = null;
    if (this.ws) {
      try { this.ws.onclose = null; this.ws.close(); } catch (e) { }
    }
    this.ws = null;
  },

  send: function (payload) {
    if (!this.connected) return false;
    const raw = JSON.stringify(payload);
    try {
      if (this.bridge) { this.bridge.send(raw); return true; }
      if (this.ws && this.ws.readyState === 1) { this.ws.send(raw); return true; }
    } catch (e) { }
    return false;
  },

  place: function () {
    const m = World.current;
    if (m === 'house') return 'AT HOME';
    if (m === 'shop') return 'AT THE GENERAL STORE';
    return 'ON THE FARM';
  },

  activity: function () {
    if (Game.state === 'title') {
      return {
        details: 'BROWSING THE MENU',
        state: 'SUNVALE - A COZY PIXEL FARM',
        timestamps: { start: this.started }
      };
    }
    return {
      details: 'DAY ' + Game.day + ' ' + Game.dayName() + ' - ' + Game.clockText(),
      state: this.place() + ' - ' + Game.weatherName(Game.weather),
      timestamps: { start: this.started }
    };
  },

  push: function (force) {
    if (!this.enabled || !this.connected) return;
    const a = this.activity();
    const sig = a.details + '|' + a.state;
    if (!force && sig === this.sig) return;
    this.sig = sig;
    this.send({ cmd: 'SET_ACTIVITY', args: { pid: 1, activity: a } });
  },

  tick: function (dt) {
    if (!this.enabled) return;
    if (this.retry > 0) this.retry -= dt;
    if (!this.connected) {
      if (!this.connecting && this.retry <= 0) { this.connect(); this.retry = 20; }
      return;
    }
    this.t += dt;
    if (this.t >= 4) { this.t = 0; this.push(false); }
  }
};
