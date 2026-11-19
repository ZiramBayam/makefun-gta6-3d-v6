// A small, fast 32-bit generator (mulberry32). The whole city, its traffic and its weather
// derive from one seed, so a reload always produces the very same afternoon.

/** Return a deterministic random source with the documented helper methods. */
export function createRandom(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(a, b) {
    return a + (b - a) * next();
  }

  function int(a, b) {
    return Math.floor(range(a, b + 1));
  }

  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  function chance(p) {
    return next() < p;
  }

  return { next, range, int, pick, chance };
}
