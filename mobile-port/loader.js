/* ------------------------------------------------------------------
   Sunvale mobile port - loader / device detection
   Loaded after the desktop scripts. If the device is a phone the
   port switches the game to a touch interface (see touch.js and
   interface.js) and pulls in mobile-port/mobile.css.
   Override with ?mobile=1 (force on) or ?mobile=0 (force off).
------------------------------------------------------------------- */
(function () {
  var query = null;
  try { query = new URLSearchParams(location.search); } catch (e) { query = null; }

  function isPhone() {
    if (query) {
      if (query.get('mobile') === '1') return true;
      if (query.get('mobile') === '0') return false;
    }
    var ua = navigator.userAgent || '';

    // Real handsets.
    if (/iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry|BB10|Kindle|Silk/i.test(ua)) return true;
    if (/Android/.test(ua) && /Mobile/.test(ua)) return true;

    // iPadOS 13+ claims to be a Macintosh but is touch first.
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
      return Math.min(screen.width, screen.height) <= 1180;
    }

    // Any other touch-first device with a phone sized screen.
    if (navigator.maxTouchPoints > 1 && window.matchMedia) {
      if (!window.matchMedia('(pointer: fine)').matches &&
          Math.min(screen.width, screen.height) <= 560) return true;
    }
    return false;
  }

  var MobilePort = {
    on: isPhone(),
    keys: {},                 // virtual buttons held down
    stick: { x: 0, y: 0, run: false, active: false },
    shown: false,
    layout: { hy: 0, hx: 0, hw: 0 },
    metrics: { stick: 128, cluster: 140, safeB: 0, bar: 152, short: false },
    mailTab: 'list',
    _key: null
  };

  // Sends a key through the normal desktop key handler so every menu,
  // shortcut and gameplay rule stays in one place.
  MobilePort.press = function (k) {
    if (typeof onKey !== 'function') return;
    if (typeof k === 'string' && k.length === 1 && k !== ' ') k = k.toLowerCase();
    onKey({ key: k, repeat: false, preventDefault: function () {} });
  };

  window.MobilePort = MobilePort;

  if (!MobilePort.on) return;

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'mobile-port/mobile.css';
  document.head.appendChild(link);
  document.documentElement.className += ' mobile-port';
})();
