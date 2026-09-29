/* ------------------------------------------------------------------
   Sunvale mobile port - touch controls + mobile input
   Builds the on screen stick / action buttons, routes taps into the
   desktop click handler and drives Player through Input.down().
------------------------------------------------------------------- */
(function () {
  if (!window.MobilePort || !MobilePort.on) return;
  var M = MobilePort;

  /* ---------------- input bridge ---------------- */

  Input.down = (function (orig) {
    return function (k) {
      if (M.keys[k]) return true;
      return orig.call(this, k);
    };
  })(Input.down);

  function setMove(nx, ny, run) {
    M.stick.x = nx; M.stick.y = ny; M.stick.run = !!run;
    M.keys.left = nx < -0.16;
    M.keys.right = nx > 0.16;
    M.keys.up = ny < -0.16;
    M.keys.down = ny > 0.16;
    M.keys.run = !!run;
  }

  function clearMove() {
    M.keys.left = M.keys.right = M.keys.up = M.keys.down = M.keys.run = false;
    M.stick.x = M.stick.y = 0; M.stick.run = false; M.stick.active = false;
  }

  /* ---------------- metrics ---------------- */

  function safeInset(prop) {
    var probe = document.getElementById('mp-probe');
    if (!probe) return 0;
    probe.style.paddingBottom = 'env(' + prop + ', 0px)';
    var v = parseFloat(getComputedStyle(probe).paddingBottom);
    return isNaN(v) ? 0 : v;
  }

  M.relayout = function () {
    var h = window.innerHeight;
    var short = h < 540;
    var stick = short ? 104 : 128;
    var cluster = short ? 132 : 142;
    var safeB = Math.max(safeInset('safe-area-inset-bottom'),
      parseFloat(getComputedStyle(document.body).paddingBottom) || 0);
    var m = M.metrics;
    m.stick = stick; m.cluster = cluster; m.safeB = safeB; m.short = short;
    m.bar = safeB + 14 + Math.max(stick, cluster);
    var root = document.getElementById('mp-root');
    if (root) {
      root.style.setProperty('--mp-stick', stick + 'px');
      root.style.setProperty('--mp-cluster', cluster + 'px');
      root.style.setProperty('--mp-safeb', safeB + 'px');
    }
    // Keep the backing store and the CSS box identical so pixels stay square.
    var cv = document.getElementById('game');
    if (cv) {
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
    }
  };

  /* ---------------- world tap ---------------- */

  function updateHover(x, y) {
    Input.mx = x; Input.my = y;
    UI.mx = x; UI.my = y;
  }

  function tileOf(wx, wy) {
    return { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
  }

  // Distance from a world point to whatever sits in front of the player.
  function targetDist(t, wx, wy) {
    if (t.kind === 'npc') return Math.hypot(t.npc.x - wx, t.npc.y - wy);
    if (t.kind === 'chicken') return Math.hypot(t.chicken.x - wx, t.chicken.y - wy);
    var cx, cy;
    if (t.kind === 'harvest') { cx = (t.x + 0.5) * TILE; cy = (t.y + 0.5) * TILE; }
    else if (t.prop) { cx = (t.prop.tx + 0.5) * TILE; cy = (t.prop.ty + 0.5) * TILE; }
    else return Infinity;
    return Math.hypot(cx - wx, cy - wy);
  }

  function worldTap(x, y) {
    var wx = Renderer.cam.x + x / ZOOM;
    var wy = Renderer.cam.y + y / ZOOM;
    var dx = wx - Player.x, dy = wy - (Player.y - 7);
    if (Math.abs(dx) > Math.abs(dy)) Player.dir = dx < 0 ? 'left' : 'right';
    else Player.dir = dy < 0 ? 'up' : 'down';

    // Tapping something you can reach talks / harvests / opens it,
    // anything else swings the held tool.
    if (Game.state === 'play' && !UI.helpOpen) {
      var t = nearestInteract();
      if (t && targetDist(t, wx, wy) < 22) { M.press('e'); return; }
    }
    if (typeof onMouse === 'function') onMouse({ clientX: x, clientY: y, button: 0 });
  }

  function tap(x, y) {
    updateHover(x, y);
    if (Game.state === 'title') {
      // Title buttons register a frame later, same as the desktop path.
      setTimeout(function () { UI.click(x, y); }, 0);
      return;
    }
    if (UI.helpOpen) { UI.click(x, y); return; }
    if (UI.click(x, y)) return;
    if (Game.state === 'play') { worldTap(x, y); return; }
    if (typeof onMouse === 'function') onMouse({ clientX: x, clientY: y, button: 0 });
  }

  /* ---------------- canvas pointer handling ---------------- */

  function bindCanvas() {
    var c = document.getElementById('game');
    if (!c) return;
    c.style.touchAction = 'none';
    var pending = null;

    c.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' || e.isPrimary === false) return;
      pending = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      updateHover(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    c.addEventListener('pointermove', function (e) {
      if (!pending || pending.id !== e.pointerId) return;
      pending.moved = Math.max(pending.moved,
        Math.hypot(e.clientX - pending.x, e.clientY - pending.y));
      updateHover(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    c.addEventListener('pointerup', function (e) {
      if (!pending || pending.id !== e.pointerId) return;
      var quick = performance.now() - pending.t < 650;
      var still = pending.moved < 16;
      pending = null;
      updateHover(e.clientX, e.clientY);
      if (quick && still) tap(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    c.addEventListener('pointercancel', function () { pending = null; }, { passive: false });
  }

  /* ---------------- on screen controls ---------------- */

  var BUTTONS = [
    { key: 'i', label: 'BAG', cls: 'mp-sm', title: 'Inventory' },
    { key: 'g', label: 'GIFT', cls: 'mp-sm', title: 'Give gift' },
    { key: 'escape', label: 'MENU', cls: 'mp-sm', title: 'Pause' },
    { key: ' ', label: 'USE', cls: 'mp-md', title: 'Use tool' },
    { key: 'e', label: 'ACT', cls: 'mp-lg', title: 'Interact' }
  ];

  function build() {
    var probe = document.createElement('div');
    probe.id = 'mp-probe';
    document.body.appendChild(probe);

    var root = document.createElement('div');
    root.id = 'mp-root';
    root.style.display = 'none';

    var pad = document.createElement('div');
    pad.className = 'mp-pad';
    pad.id = 'mp-pad';
    pad.setAttribute('aria-label', 'Move');
    pad.innerHTML = '<span class="mp-ring"></span><span class="mp-knob" id="mp-knob"></span>';
    root.appendChild(pad);

    var side = document.createElement('div');
    side.className = 'mp-side';
    side.id = 'mp-side';
    var rows = [BUTTONS.slice(0, 3), BUTTONS.slice(3)];
    for (var r = 0; r < rows.length; r++) {
      var row = document.createElement('div');
      row.className = 'mp-row';
      for (var i = 0; i < rows[r].length; i++) {
        var b = document.createElement('button');
        var def = rows[r][i];
        b.className = 'mp-btn ' + def.cls;
        b.type = 'button';
        b.textContent = def.label;
        b.title = def.title;
        b.setAttribute('aria-label', def.title);
        b.dataset.key = def.key;
        row.appendChild(b);
      }
      side.appendChild(row);
    }
    root.appendChild(side);
    document.body.appendChild(root);

    M.relayout();
    bindPad(pad, root.querySelector('#mp-knob'));
    bindButtons(root);
  }

  function bindPad(pad, knob) {
    var pid = null;

    function move(e) {
      if (e.pointerId !== pid) return;
      var r = pad.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var max = r.width * 0.36;
      var d = Math.hypot(dx, dy);
      if (d > max) { dx = dx / d * max; dy = dy / d * max; d = max; }
      knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';

      var mag = d / max;
      var dead = 0.2;
      var nx = d ? dx / d : 0, ny = d ? dy / d : 0;
      if (mag <= dead) { setMove(0, 0, false); return; }
      var s = Math.min(1, (mag - dead) / (1 - dead));
      setMove(nx * s, ny * s, s > 0.86);
      if (e.cancelable) e.preventDefault();
    }

    pad.addEventListener('pointerdown', function (e) {
      pid = e.pointerId;
      try { pad.setPointerCapture(pid); } catch (err) {}
      M.stick.active = true;
      AudioSys.init(); AudioSys.resume();
      move(e);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    pad.addEventListener('pointermove', move, { passive: false });

    function end(e) {
      if (e.pointerId !== pid) return;
      pid = null;
      knob.style.transform = 'translate(0px,0px)';
      clearMove();
    }
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
  }

  function bindButtons(root) {
    var list = root.querySelectorAll('.mp-btn');
    for (var i = 0; i < list.length; i++) {
      (function (btn) {
        var key = btn.dataset.key;
        btn.addEventListener('pointerdown', function (e) {
          if (e.isPrimary === false) return;
          btn.classList.add('down');
          AudioSys.init(); AudioSys.resume();
          M.press(key);
          if (e.cancelable) e.preventDefault();
        }, { passive: false });
        function up() { btn.classList.remove('down'); }
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
        btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      })(list[i]);
    }
  }

  /* ---------------- visibility / lifecycle ---------------- */

  M.tick = function () {
    var root = document.getElementById('mp-root');
    if (!root) return;
    var st = Game.state;
    var show = M.on && (st === 'play' || st === 'dialogue') && !UI.helpOpen;
    if (show !== M.shown) {
      M.shown = show;
      root.style.display = show ? 'block' : 'none';
      if (!show) clearMove();
    }
    if (window.innerHeight !== M._h) {
      M._h = window.innerHeight;
      M.relayout();
    }
  };

  function safeSave() {
    try { if (window.Game && Game.state && Game.state !== 'title') Game.save(); }
    catch (e) {}
  }

  window.addEventListener('load', function () {
    build();
    bindCanvas();
    // Safari pinch gesture would zoom the whole page away from the game.
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    window.addEventListener('resize', M.relayout);
    window.addEventListener('orientationchange', function () {
      setTimeout(M.relayout, 60);
      setTimeout(M.relayout, 400);
    });
    // Phone browsers freeze tabs instead of unloading them - save first.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') safeSave();
    });
    window.addEventListener('pagehide', safeSave);
  });
})();
