// Procedural noise functions - shared between server and client

function noiseHash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, y, s, scale) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = noiseHash(x0, y0, s), b = noiseHash(x0 + 1, y0, s);
  const c = noiseHash(x0, y0 + 1, s), d = noiseHash(x0 + 1, y0 + 1, s);
  const p = a + (b - a) * sx, q = c + (d - c) * sx;
  return p + (q - p) * sy;
}

function fbm2(x, y, s, scale, oct) {
  let sum = 0, amp = 0.5, tot = 0, sc = scale;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x, y, s + i * 977, sc) * amp;
    tot += amp; amp *= 0.5; sc = Math.max(1, sc * 0.5);
  }
  return sum / tot;
}

function rngf(seed) {
  let s = seed >>> 0;
  return function () {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 4294967296;
  };
}

function shuffleArr(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

module.exports = { noiseHash, noise2, fbm2, rngf, shuffleArr };