/* STORY — chapter/objective progression for the campaign.
   Reads STORY[] from data.js (chapter defs) and pushes results back onto
   Game (rewards via Game's mail/shop helpers) — it is the only place that
   knows how chapters advance.

   Flow: tick() is called from Game as events fire (onHarvest/onCook/onSell/
   noteTalk). Use objectiveLabel() + objectiveProgress() for the HUD line.
   state: i = current chapter index, done = campaign finished,
   introShown = which chapter intros already played.
   Persist with Game.save(): serialise()/applySave() carry this across
   sessions — a new field here must be added there too. */

const Story = {
  i: 0, introShown: {}, done: false, busy: false,
  satisfied: {},
  stats: { harvested: 0, cooked: 0, sold: 0 },

  reset: function () {
    this.i = 0;
    this.introShown = {};
    this.done = false;
    this.busy = false;
    this.satisfied = {};
    this.stats = { harvested: 0, cooked: 0, sold: 0 };
  },

  chapter: function () {
    if (this.done) return null;
    return STORY[this.i] || null;
  },

  def: function (id) {
    for (const d of NPC_DEFS) if (d.id === id) return d;
    return null;
  },

// ---- objective helpers --------------------------------------------

  objectiveLabel: function (o) {
    const loc = (typeof L === 'function') ? L : function (k) { return k; };
    if (o.type === 'talk') {
      const d = this.def(o.npc);
      return loc('objective.talk', { x: (d ? d.name.toUpperCase() : o.npc.toUpperCase()) });
    }
    if (o.type === 'collect') return loc('objective.collect', { x: o.n, y: ITEMS[o.id].n.toUpperCase() });
    if (o.type === 'deliver') {
      const d = this.def(o.npc);
      return loc('objective.deliver', { x: o.n, y: ITEMS[o.id].n.toUpperCase(), z: (d ? d.name.toUpperCase() : '') });
    }
    if (o.type === 'cook') return loc('objective.cook', { x: o.n });
    if (o.type === 'sold') return loc('objective.sold', { x: o.n });
    return '';
  },

  objectiveProgress: function (o) {
    if (o.type === 'collect') return Math.min(o.n, Game.countItem(o.id)) + '/' + o.n;
    if (o.type === 'cook') return Math.min(o.n, this.stats.cooked) + '/' + o.n;
    if (o.type === 'sold') return Math.min(o.n, this.stats.sold) + '/' + o.n;
    return null;
  },

  lines: function () {
    const ch = this.chapter();
    if (!ch) return [];
    const out = [];
    for (let i = 0; i < ch.obj.length; i++) {
      const o = ch.obj[i];
      out.push({ text: this.objectiveLabel(o), prog: this.objectiveProgress(o), met: this.met(o, i) });
    }
    return out;
  },

  met: function (o, idx) {
    if (o.type === 'collect') return Game.countItem(o.id) >= o.n;
    if (o.type === 'cook') return this.stats.cooked >= o.n;
    if (o.type === 'sold') return this.stats.sold >= o.n;
    const ch = this.chapter();
    return !!(ch && this.satisfied[ch.id + ':' + idx]);
  },

  ready: function () {
    const ch = this.chapter();
    if (!ch) return false;
    for (let i = 0; i < ch.obj.length; i++) if (!this.met(ch.obj[i], i)) return false;
    return true;
  },

  tick: function () {
    if (this.done || this.busy) return;
    if (Game.state !== 'play') return;
    if (this.ready()) this.complete();
  },

// ---- event hooks (called by Game) ---------------------------------

  onHarvest: function () { this.stats.harvested += 1; },
  onCook: function () { this.stats.cooked += 1; },
  onSell: function (gold) { this.stats.sold += gold || 0; },

  noteTalk: function (npcId) {
    const ch = this.chapter();
    if (!ch || this.done) return false;
    for (let i = 0; i < ch.obj.length; i++) {
      const o = ch.obj[i];
      if (o.type === 'talk' && o.npc === npcId) this.satisfied[ch.id + ':' + i] = true;
      if (o.type === 'deliver' && o.npc === npcId) {
        if (Game.countItem(o.id) >= o.n) {
          Game.removeItem(o.id, o.n);
          FX.toast('DELIVERED ' + o.n + ' ' + ITEMS[o.id].n.toUpperCase(), '#a8e8a0');
          this.satisfied[ch.id + ':' + i] = true;
        } else {
          FX.toast('THEY WANT ' + o.n + ' ' + ITEMS[o.id].n.toUpperCase(), '#e0a0a0');
        }
      }
    }
    if (this.ready()) {
      this.complete();
      return true;
    }
    return false;
  },

  introFor: function (npcId) {
    const ch = this.chapter();
    if (!ch || ch.giver !== npcId || this.introShown[ch.id]) return null;
    this.introShown[ch.id] = true;
    return ['CHAPTER: ' + ch.title, ch.desc + '.'];
  },

  complete: function () {
    const ch = this.chapter();
    if (!ch || this.busy) return;
    this.busy = true;
    if (ch.reward) {
      if (ch.reward.money) {
        Game.money += ch.reward.money;
        FX.toast('+' + ch.reward.money + 'G REWARD', '#f7e07a');
      }
      if (ch.reward.items) {
        for (const id in ch.reward.items) {
          const left = Game.addItem(id, ch.reward.items[id]);
          if (left > 0) FX.toast('REWARD LOST - BAG FULL', '#e0453f');
          else FX.toast('+' + ch.reward.items[id] + ' ' + ITEMS[id].n.toUpperCase(), '#a8e8a0');
        }
      }
    }
    FX.toast('CHAPTER COMPLETE: ' + ch.title, '#7fd06f');
    AudioSys.play('coin');
    this.i += 1;
    if (this.i >= STORY.length) {
      this.done = true;
      FX.toast('STORY COMPLETE - SUNVALE LIVES!', '#f7e07a');
    } else {
      FX.toast('NEW CHAPTER: ' + STORY[this.i].title, '#f7e07a');
    }
    Game.save();
    this.busy = false;
    if (ch.outro && ch.outro.length) {
      const g = this.def(ch.giver);
      if (g) Game.say(g.name.toUpperCase(), g.palette, ch.outro.slice(), g.id);
    }
  },

// ---- persistence ---------------------------------------------------

  serialize: function () {
    return {
      i: this.i, done: this.done, intro: this.introShown,
      stats: this.stats, satisfied: this.satisfied
    };
  },

  applySave: function (d) {
    if (!d) return;
    this.i = d.i || 0;
    this.done = !!d.done;
    this.introShown = d.intro || {};
    this.satisfied = d.satisfied || {};
    this.stats = d.stats || { harvested: 0, cooked: 0, sold: 0 };
    if (this.i >= STORY.length) { this.i = STORY.length - 1; this.done = true; }
  }
};
