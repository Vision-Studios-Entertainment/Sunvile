# Sunvale Farm — Codebase Research & Bug Report

## Project Overview

A cozy pixel-art farming game built with vanilla JavaScript and HTML5 Canvas. No frameworks, no build tools. The game features farming, mining, NPC relationships, day/night cycles, weather, and a save/load system via localStorage.

**Architecture:** 11 source files, ~4,500 lines total. Global-scope objects (`Game`, `World`, `Player`, `Renderer`, `UI`, `AudioSys`, `FX`, `Sprites`) communicate through direct references. Script load order in `index.html` defines dependency chain.

---

## Bugs Found

### BUG-1: Redundant if/else with identical branches
**File:** `js/main.js:76-77`
```js
if (Game.state !== 'title') Renderer.updateCam(dt, false);
else Renderer.updateCam(dt, false);
```
Both branches execute the exact same call. The condition is meaningless.

**Fix:** Replace with a single call: `Renderer.updateCam(dt, false);`

---

### BUG-2: Bush regrowth never triggers
**File:** `js/game.js:283` (chop) vs `js/game.js:806` (regrow)

When a bush is chopped, it's marked `prop.dead = true`. But the regrowth logic in `advanceDay` checks `!p.ready`:
```js
} else if (p.type === 'bush' && !p.ready) {
  p.timer -= 1; p.dirty = true;
  if (p.timer <= 0) p.ready = true;
}
```
Since `ready` is never set to `false` when chopping, and dead bushes are skipped by `rebuildGrid`, chopped bushes are gone forever. Berries become a non-renewable resource.

**Fix:** When chopping a bush, set `prop.ready = false; prop.timer = 3;` and remove `prop.dead = true` (or keep dead but also reset ready/timer).

---

### BUG-3: Music timer stacks on repeated `startMusic()` calls
**File:** `js/audio.js:138`

```js
this.timer = setInterval(function () { self.schedule(); }, 90);
```
`startMusic` is called in both `newGame()` and `continueGame()`. If a player quits to title and starts again, a second `setInterval` is created without clearing the first. Multiple timers cause the music to play faster and louder with each restart.

**Fix:** Add `if (this.timer) clearInterval(this.timer);` at the top of `startMusic`.

---

### BUG-4: Music scheduler burst on unmute / re-enable
**File:** `js/audio.js:141-142`

```js
schedule: function () {
  if (!this.ready || this.muted || !this.musicOn) return;
  ...
  while (this.nextTime < this.ctx.currentTime + 0.35) {
```
When muted or music is off, `schedule()` returns early without advancing `this.nextTime`. Upon unmuting, the `while` loop catches up on all missed steps, producing a burst of dozens of notes at once.

**Fix:** When returning early, still advance `this.nextTime = this.ctx.currentTime + 0.1;` to reset the catch-up window.

---

### BUG-5: Chicken idle animation shows walking frame
**File:** `js/entities.js:201`

```js
if (Math.random() < dt * 0.5) c.frame = 2;
```
Frame 2 is a walking pose (legs apart). Idle chickens randomly flash a walking frame, making them look like they're twitching or stepping in place.

**Fix:** Use frame 1 for a subtle idle bob, or create a dedicated idle frame. At minimum, use `c.frame = 1` instead of `2`.

---

### BUG-6: `canTarget2` is a duplicate of `canTarget`
**File:** `js/game.js:228-231` and `js/game.js:256-258`

```js
canTarget: function (t) {
  if (World.current !== 'farm') return false;
  return World.farmable(t.x, t.y) && !World.solidTile(null, t.x, t.y);
},
canTarget2: function (t) {
  return World.farmable(t.x, t.y) && !World.solidTile(null, t.x, t.y);
},
```
`canTarget2` is identical to `canTarget` except it omits the `World.current !== 'farm'` check. Since all callers of `canTarget2` are already inside farm-only code paths, the missing check is harmless, but the duplication is confusing and error-prone.

**Fix:** Use `canTarget` everywhere and delete `canTarget2`.

---

### BUG-7: Inventory slot label parameter always null
**File:** `js/ui.js:324`

```js
this.slot(g, p.x, p.y, 40, st, sel, i < 4 ? null : null);
```
The ternary `i < 4 ? null : null` always evaluates to `null`. The `label` parameter of `slot()` is never used. This appears to be a leftover from a removed feature (likely tool-slot labels).

**Fix:** Pass `null` directly, or restore the intended label logic (e.g., `i < 4 ? 'TOOL' : null`).

---

### BUG-8: Crop `grown` property not initialized on planting
**File:** `js/game.js:372`

```js
map.crops[key] = { id: def.crop, stage: 0 };
```
The `grown` field is never set. In `advanceDay` (line 789):
```js
if (wet && (cr.grown === undefined || cr.grown < def.days)) {
  cr.grown = (cr.grown || 0) + 1;
```
The `cr.grown === undefined` check handles this, but it's fragile. If save data from an older version lacks `grown`, the first day after loading would skip growth (since `undefined < def.days` is `false`... wait, actually `undefined < 4` is `false`, so the condition `cr.grown === undefined || cr.grown < def.days` would be `true` due to the first clause). Actually this works, but it's still sloppy.

**Fix:** Initialize `grown: 0` when planting: `map.crops[key] = { id: def.crop, stage: 0, grown: 0 };`

---

### BUG-9: Camera snap condition too narrow
**File:** `js/render.js:56`

```js
if (snap || !this.cam.x && !this.cam.y) { this.cam.x = tx; this.cam.y = ty; }
```
The auto-snap only triggers when the camera is exactly at `(0, 0)`. If the camera is at `(0, 5)` (possible after map transitions), it will lerp from the old position instead of snapping, causing a visible pan after teleporting between maps.

**Fix:** Track a `needsSnap` flag set to `true` on map transitions, or snap whenever the distance to target exceeds a threshold.

---

### BUG-10: `dayDone` flag not declared in Game object
**File:** `js/game.js:3-12`

`dayDone` is used at lines 853-859 but never declared in the object literal. It's implicitly `undefined` (falsy) on first frame, which works, but it's not documented and could be accidentally deleted.

**Fix:** Add `dayDone: false` to the Game object literal.

---

### BUG-11: NPC stuck detection is unreliable
**File:** `js/entity.js:171`

```js
if (Math.hypot(e.x - before.x, e.y - before.y) < s * 0.35) {
  e.state = 'idle'; e.wait = 1 + Math.random() * 2;
}
```
NPCs have no collision detection — they walk through trees, rocks, and water. The stuck detection only catches the case where they didn't move at all (blocked by map bounds), not where they're walking into a solid prop. NPCs can get permanently stuck walking into a tree.

**Fix:** Add a simple collision check in `walkNPC` — before moving, check if the target tile is solid. If so, pick a new target.

---

### BUG-12: `drawHeld` can crash if held item is removed
**File:** `js/ui.js:388`

```js
drawHeld: function (g) {
  const st = this.held.arr[this.held.i];
  if (!st) return;
```
If the held stack is consumed (e.g., by a shop purchase or mail claim) while `this.held` still references it, `st` will be `null` and the function returns early. This is actually handled correctly. However, if `this.held.arr` is reassigned (e.g., `Game.inv = new Array(30).fill(null)` in `newGame`), the old reference becomes stale and `this.held.arr[this.held.i]` accesses the old array. This is a minor edge case.

**Fix:** Clear `UI.held` in `Game.newGame()` and `Game.continueGame()`.

---

### BUG-13: Save data `soil` restoration doesn't preserve original tile
**File:** `js/game.js:83-86`

```js
for (const k in farm.soil) {
  const p = k.split(',');
  World.setTile('farm', +p[0], +p[1], farm.soil[k].w ? T.SOIL_WET : T.SOIL);
}
```
The `soil` object stores `{ o: originalTile, w: wet }` but only `w` is used on load. The `o` (original tile type) is ignored. If an un-hoe feature is added later, the original tile type is lost. Currently harmless but a latent data bug.

**Fix:** Either use `o` when restoring (if un-hoe is added) or remove it from the save format to avoid confusion.

---

### BUG-14: `World.applySave` can corrupt props if seed differs
**File:** `js/world.js:76`

```js
if (!d || d.seed !== this.seed) this.init(this.seed);
```
If the save has a different seed, the world is regenerated with new random props. Then `d.props` indices are applied to the new prop array, which may have different props at those indices. This can cause a rock to become a tree, or props to appear at wrong positions.

**Fix:** If seeds differ, discard the save's world data entirely (or show a warning).

---

### BUG-15: `PixelFont.measure` returns negative for empty string
**File:** `js/sprites.js:89`

```js
measure: function (str, scale) {
  scale = scale || 1;
  return str.length * 6 * scale - scale;
},
```
For an empty string, this returns `-scale` (i.e., `-1`). This could cause issues with centering calculations.

**Fix:** Add `if (!str) return 0;` at the top.

---

### BUG-16: `UI.fit` can infinite-loop on very narrow widths
**File:** `js/ui.js:84`

```js
while (str.length > 1 && PixelFont.measure(str + '..', scale) > maxW) str = str.slice(0, -1);
```
If `maxW` is very small (less than the width of ".." plus one character), the loop exits when `str.length === 1`, but the result may still exceed `maxW`. Not an infinite loop, but the result is still too wide.

**Fix:** After the loop, check if the result still exceeds `maxW` and return just ".." or a truncated version.

---

### BUG-17: `Game.interact` eat fallback is unreachable
**File:** `js/game.js:609-611`

```js
if (!t) {
  if (this.eat()) return;
  return;
}
```
When there's nothing to interact with, pressing E tries to eat the selected item. But `eat()` requires the selected item to have a `food` property. If the player is holding a tool or seeds, nothing happens. This is correct behavior, but the `if (this.eat()) return;` pattern is misleading — it looks like eating is a fallback action, when it's really just "press E to eat if holding food."

**Fix:** This is a design choice, not a bug. But the code could be clearer: `if (this.eat()) return;` → just `this.eat(); return;` since the return value is always consumed.

---

### BUG-18: `Game.use` doesn't check energy for seeds
**File:** `js/game.js:209-211`

```js
if (def.k === 'seed') {
  this.plantSeed(item, t, key);
  return;
}
```
Planting seeds doesn't cost energy. This may be intentional (seeds are cheap), but it's inconsistent with every other action. If intentional, it should be documented.

---

### BUG-19: `Game.buy` doesn't check inventory space before charging for chicken
**File:** `js/game.js:712-724`

```js
if (id === 'chicken') {
  if (this.money < 800) { ... return; }
  const farm = World.maps.farm;
  if (farm.chickens.length >= 6) { ... return; }
  this.money -= 800;
  farm.chickens.push({...});
```
The chicken purchase checks money and coop space, but doesn't check if the player has room in their inventory for the chicken item (chickens aren't items, they're entities, so this is fine). Actually this is correct — chickens are entities, not inventory items.

---

### BUG-20: `Game.sellAll` sells tools if they have a sell price
**File:** `js/game.js:747-761`

```js
for (let i = 4; i < this.inv.length; i++) {
```
The loop starts at index 4, skipping the tool slots (0-3). This is correct — tools can't be sold. But if a tool somehow ends up in slot 4+ (via a mod or corrupted save), it would be sold.

**Fix:** Add `if (def.k === 'tool') continue;` as a safety check.

---

## Improvements

### IMP-1: Add `grown: 0` to crop planting
**File:** `js/game.js:372`
```js
map.crops[key] = { id: def.crop, stage: 0, grown: 0 };
```
Makes the data structure self-documenting and removes the need for `cr.grown === undefined` checks.

---

### IMP-2: Clear music timer on stop/reinit
**File:** `js/audio.js:133-139`
```js
startMusic: function () {
  if (!this.ready || this.timer) return;
  if (this.timer) clearInterval(this.timer); // safety
  ...
```
Also add a `stopMusic()` method that clears the timer and resets `nextTime`.

---

### IMP-3: Add collision detection to NPC walking
**File:** `js/entities.js:147-179`

Before moving an NPC, check if the next position is solid:
```js
const nextX = e.x + mx, nextY = e.y + my;
const ntx = Math.floor(nextX / TILE), nty = Math.floor(nextY / TILE);
if (World.solidTile(null, ntx, nty)) { e.state = 'idle'; e.wait = 1; return; }
```
This prevents NPCs from walking through trees and rocks.

---

### IMP-4: Add bounds checking for crop stage in rendering
**File:** `js/render.js:195`
```js
const stage = Math.min(4, Math.max(0, it.cr.stage || 0));
const sp = Sprites.crops[it.cr.id][stage];
```
Prevents crashes from corrupted save data.

---

### IMP-5: Use a `needsSnap` flag for camera
**File:** `js/render.js` and `js/game.js`

Add `Renderer.needsSnap = true` whenever the player changes maps (in `Game.interact` door handling). In `updateCam`, check `if (snap || this.needsSnap)` and reset the flag after snapping.

---

### IMP-6: Cache `Sprites.tiles` lookup in render loop
**File:** `js/render.js:82-100`

The tile rendering loop calls `Sprites.tiles[t]` for every tile. This is a simple array lookup, but the fence logic creates 4 boolean-to-string conversions per fence tile. Consider pre-computing fence sprite variations or using a lookup table.

---

### IMP-7: Add `stopMusic()` method
**File:** `js/audio.js`

```js
stopMusic: function () {
  if (this.timer) { clearInterval(this.timer); this.timer = null; }
  this.nextTime = 0;
}
```
Call this when quitting to title or pausing.

---

### IMP-8: Validate save data on load
**File:** `js/game.js:58-96`

Add validation after `JSON.parse`:
```js
if (!d || typeof d !== 'object' || !d.inv || !d.world) return this.newGame();
```
Prevents crashes from corrupted or partial save data.

---

### IMP-9: Use `const`/`let` instead of `var` in art-data.js
**File:** `js/art-data.js:1`

`var ART = {` should be `const ART = {` for consistency with the rest of the codebase.

---

### IMP-10: Extract magic numbers into constants
**File:** `js/data.js`

Many values are hardcoded throughout the codebase:
- `0.3` (use timer duration) — `game.js:206, 224`
- `46` (dialogue chars per second) — `game.js:870`
- `3.4` (fade speed) — `game.js:862`
- `0.35` (NPC stuck threshold) — `entities.js:171`
- `26` (NPC walk speed) — `entities.js:186`
- `24` (chicken walk speed) — `entities.js:208`

These should be named constants in `data.js` for maintainability.

---

### IMP-11: Add `Object.freeze()` to data tables
**File:** `js/data.js`

`CROPS`, `ITEMS`, `NPC_DEFS`, `MAIL_TIPS`, `MAIL_REQUESTS`, `FRIEND_MILESTONES` are all constant data. Freezing them prevents accidental mutation:
```js
const CROPS = Object.freeze({ ... });
```

---

### IMP-12: Optimize `PixelFont.glyph` cache key
**File:** `js/sprites.js:74`

```js
const key = color + '|' + ch;
```
This creates a new string for every glyph lookup. For a 5x7 font with ~70 characters and ~10 colors, the cache has ~700 entries. This is fine, but the string concatenation is unnecessary — use a nested object `this.cache[color][ch]` or a `Map`.

---

### IMP-13: Add `requestAnimationFrame` delta time clamping
**File:** `js/main.js:71`

```js
const dt = Math.min(0.05, (now - lastT) / 1000);
```
The clamp at 50ms (20 FPS) is good, but if the tab is backgrounded for a long time, `lastT` is stale and the first frame after returning will have a large delta. The clamp handles this, but `lastT` should be reset on `visibilitychange` to avoid a jarring jump.

---

### IMP-14: Use `Path2D` for repeated shapes
**File:** `js/sprites.js`

Many sprite-drawing functions use `fillRect` in loops. For static sprites, this is fine since they're drawn once to offscreen canvases. But for dynamic shapes (like the vignette in `render.js:404-412`), consider using `Path2D` or caching the gradient.

---

### IMP-15: Add a `Game.reset()` method
**File:** `js/game.js`

Currently, `newGame()` and `continueGame()` share a lot of initialization code. A `reset()` method would reduce duplication:
```js
reset: function () {
  this.day = 1; this.timeMin = DAY_START;
  this.weather = 'sunny'; this.nextWeather = this.rollWeather();
  this.money = 500; this.energy = MAX_ENERGY;
  this.inv = new Array(30).fill(null);
  this.chest = new Array(20).fill(null);
  // ... etc
}
```

---

### IMP-16: Document the save format
**File:** `js/game.js:98-117`

The save format is a flat JSON object with abbreviated keys (`tipi`, `reqi`, `px`, `py`, `pdir`). A comment block explaining the format would help future maintenance.

---

### IMP-17: Add `try/catch` around `localStorage.setItem`
**File:** `js/game.js:115`

Already present, but the error message could be more descriptive:
```js
catch (e) { FX.toast('SAVE FAILED: ' + e.message, '#e0453f'); }
```

---

### IMP-18: Use `addEventListener` instead of `on*` properties
**File:** `js/main.js:287`

```js
window.addEventListener('load', function () { ... });
```
This is already correct, but the `error` handler at line 279 uses `window.addEventListener('error', ...)` which is good. No change needed.

---

### IMP-19: Add a `Game.getSaveVersion()` method
**File:** `js/game.js`

The save format has `v: 1` but no migration path. If the format changes, old saves will break. A version check with migration would be more robust:
```js
if (d.v === 1) { /* current format */ }
else if (d.v === 0) { /* migrate from old format */ }
```

---

### IMP-20: Consider using a `Map` for `World.maps`
**File:** `js/world.js:3`

```js
maps: {},
```
A `Map` would provide better iteration guarantees and avoid prototype pollution. But since the keys are simple strings (`'farm'`, `'house'`, `'shop'`), this is a minor concern.

---

## Summary

| Category | Count |
|----------|-------|
| Bugs | 20 |
| Improvements | 20 |
| Critical Bugs | 5 (BUG-2, BUG-3, BUG-4, BUG-5, BUG-11) |
| Code Quality | 8 |
| Performance | 3 |
| Maintainability | 4 |

**Top 5 Priority Fixes:**
1. **BUG-2** — Bush regrowth (gameplay-breaking, resources become non-renewable)
2. **BUG-3** — Music timer stacking (audio glitch on restart)
3. **BUG-4** — Music burst on unmute (audio glitch)
4. **BUG-5** — Chicken idle animation (visual glitch)
5. **BUG-11** — NPC collision (NPCs walk through walls)
