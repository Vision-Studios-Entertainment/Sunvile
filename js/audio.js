/* AUDIO — WebAudio synthesis. No audio files exist: SFX are short oscillator
   envelopes (tone/noise) and the music is a generative loop scheduled
   ahead of time (schedule/note), not a playlist.

   Typical use: AudioSys.init() + resume() on the first key/click (browsers
   block audio before a user gesture), then AudioSys.play('<name>').

   State you may toggle
     muted      kills everything (M key)      musicOn  music bus on/off
     setRain(on) crossfades a filtered-noise rain bed during rain/storm

   Gotcha: init() is idempotent and failure-tolerant — if AudioContext is
   unavailable the game must keep running, so never assume this.ctx exists;
   every entry point guards on this.ready. */

const AudioSys = {
  ctx: null, master: null, sfxGain: null, musicGain: null, rainGain: null,
  muted: Settings.data.muted, musicOn: Settings.data.musicOn, ready: false,
  step: 0, nextTime: 0, timer: null, rainSrc: null,

  init: function () {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.75;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.42 : 0;
      this.musicGain.connect(this.master);
      this.ready = true;
      this.applyVolumes();
    } catch (e) { this.ready = false; }
  },

  applyVolumes: function () {
    const s = Settings.data;
    this.muted = !!s.muted;
    this.musicOn = !!s.musicOn;
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : (s.master / 100) * 0.5, now, 0.02);
    this.sfxGain.gain.setTargetAtTime((s.sfx / 100) * 0.75, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.musicOn ? (s.music / 100) * 0.42 : 0, now, 0.05);
  },

  resume: function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

// ---- synth primitives: oscillator + noise bursts -------------------

  tone: function (freq, dur, type, vol, slide, delay) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise: function (dur, freq, vol, q, delay) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200; f.Q.value = q || 1;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },

// ---- SFX table: AudioSys.play('<name>') ----------------------------

  play: function (name) {
    if (!this.ready || this.muted) return;
    switch (name) {
      case 'till': this.tone(150, 0.1, 'square', 0.18, -60); this.noise(0.12, 700, 0.2); break;
      case 'water': this.noise(0.3, 1600, 0.22, 0.7); this.tone(420, 0.18, 'sine', 0.06, -160); break;
      case 'plant': this.tone(520, 0.07, 'triangle', 0.2, 180); break;
      case 'chop': this.tone(180, 0.09, 'square', 0.22, -90); this.noise(0.1, 900, 0.25); break;
      case 'mine': this.tone(900, 0.05, 'square', 0.16, -400); this.noise(0.14, 2600, 0.2); break;
      case 'break': this.noise(0.3, 1400, 0.3); this.tone(300, 0.2, 'square', 0.12, -200); break;
      case 'chopTree': this.tone(120, 0.16, 'square', 0.2, -50); this.noise(0.22, 800, 0.28); break;
      case 'coin': this.tone(880, 0.06, 'square', 0.18); this.tone(1320, 0.09, 'square', 0.16, 0, 0.06); break;
      case 'pick': this.tone(660, 0.05, 'triangle', 0.15); break;
      case 'select': this.tone(720, 0.03, 'square', 0.08); break;
      case 'open': this.tone(300, 0.08, 'triangle', 0.15, 200); break;
      case 'close': this.tone(400, 0.08, 'triangle', 0.14, -180); break;
      case 'door': this.tone(220, 0.18, 'sawtooth', 0.09, -60); break;
      case 'eat': this.noise(0.1, 500, 0.2); this.tone(300, 0.1, 'triangle', 0.12, 80); break;
      case 'error': this.tone(180, 0.14, 'square', 0.14, -40); break;
      case 'sleep': [660, 590, 520, 440].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, 0, i * 0.14)); break;
      case 'wake': [440, 550, 660, 880].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.13, 0, i * 0.09)); break;
      case 'harvest': this.tone(520, 0.06, 'triangle', 0.16); this.tone(780, 0.08, 'triangle', 0.14, 0, 0.05); break;
      case 'pet': this.tone(700, 0.05, 'sine', 0.14); this.tone(950, 0.07, 'sine', 0.12, 0, 0.06); break;
      case 'thunder': this.noise(1.1, 240, 0.4, 0.4); this.tone(60, 0.9, 'sine', 0.25, -20); break;
      case 'splash': this.noise(0.16, 2200, 0.14); break;
      case 'cluck': this.tone(560, 0.05, 'square', 0.1, -160); this.tone(480, 0.06, 'square', 0.09, -120, 0.07); break;
      case 'heartbeat': this.tone(90, 0.16, 'sine', 0.3); this.tone(80, 0.16, 'sine', 0.26, 0, 0.2); break;
    }
  },

// ---- rain bed -----------------------------------------------------

  setRain: function (on) {
    if (!this.ready) return;
    if (on && !this.rainSrc) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1100;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      this.rainSrc = src; this.rainGain = g;
    }
    if (this.rainGain) {
      const target = on && !this.muted ? 0.11 : 0;
      this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
    }
  },

  toggleMute: function () {
    Settings.data.muted = !Settings.data.muted;
    Settings.save();
    this.applyVolumes();
    return this.muted;
  },

  toggleMusic: function () {
    Settings.data.musicOn = !Settings.data.musicOn;
    Settings.save();
    this.applyVolumes();
    return this.musicOn;
  },

  mtof: function (m) { return 440 * Math.pow(2, (m - 69) / 12); },

  melody: [76, null, 74, 72, null, 69, 72, null, 71, null, 69, 67, null, 64, 67, null,
    72, null, 74, 77, null, 76, 74, null, 72, null, 71, 69, null, 71, null, null],
  chords: [48, 45, 41, 43],

// ---- generative music loop (lookahead scheduler) ------------------

  startMusic: function () {
    if (!this.ready || this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    const self = this;
    this.timer = setInterval(function () { self.schedule(); }, 90);
  },

  schedule: function () {
    if (!this.ready || this.muted || !this.musicOn) return;
    const eighth = 0.3;
    while (this.nextTime < this.ctx.currentTime + 0.35) {
      const s = this.step % 32;
      const bar = Math.floor(s / 8);
      const chord = this.chords[bar];
      const t = this.nextTime - this.ctx.currentTime;
      const self = this;
      if (s % 8 === 0) this.note(chord, 0.8, 'triangle', 0.18, t);
      if (s % 8 === 4) this.note(chord, 0.7, 'triangle', 0.14, t);
      if (s % 2 === 0) {
        const arp = chord + 12 + [0, 7, 12, 7][(s / 2) % 4];
        this.note(arp, 0.26, 'triangle', 0.07, t);
      }
      const m = this.melody[s];
      if (m !== null && m !== undefined) this.note(m, 0.3, 'triangle', 0.1, t + 0.01);
      this.step++;
      this.nextTime += eighth;
    }
  },

  note: function (midi, dur, type, vol, delay) {
    const t = this.ctx.currentTime + Math.max(0, delay);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = this.mtof(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
};
