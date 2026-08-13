/** Small shared helpers. */
const U = {
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(U.rand(a, b + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },
  // Smooth ease helpers for juicy animation
  easeOutBack(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInCubic(t) { return t * t * t; },
  easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
  // Format 12450 -> "12,450"
  fmt(n) { return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); },
  // Compact 250000 -> "250,000" (kept full per reference HUD style)
  fmtCost(n) { return U.fmt(n); },
};

/** Simple object pool to avoid per-frame allocations. */
class Pool {
  constructor(factory, reset) {
    this.factory = factory;
    this.reset = reset;
    this.items = [];
  }
  get() {
    const it = this.items.pop() || this.factory();
    this.reset(it);
    return it;
  }
  release(it) { this.items.push(it); }
}
