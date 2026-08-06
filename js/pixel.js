/**
 * PIXEL — tiny pixel-art authoring engine.
 * Sprites are drawn once at native resolution onto offscreen canvases,
 * auto-outlined in the reference sheet's dark warm-brown line color,
 * cached, and blitted scaled-up with crisp rendering.
 */
const PIXEL = (() => {
  const OUTLINE = '#2a1c12';       // warm dark outline used across the whole art bible
  const cache = new Map();

  /** A tiny drawing surface with pixel-level ops. */
  class Surface {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.c = document.createElement('canvas');
      this.c.width = w; this.c.height = h;
      this.g = this.c.getContext('2d');
      this.g.imageSmoothingEnabled = false;
    }
    px(x, y, col) { this.g.fillStyle = col; this.g.fillRect(x | 0, y | 0, 1, 1); }
    rect(x, y, w, h, col) { this.g.fillStyle = col; this.g.fillRect(x | 0, y | 0, w, h); }
    /** Filled pixel ellipse (cx,cy center; rx,ry radii). */
    ellipse(cx, cy, rx, ry, col) {
      this.g.fillStyle = col;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / (rx + 0.5), dy = (y + 0.5 - cy) / (ry + 0.5);
          if (dx * dx + dy * dy <= 1) this.g.fillRect(x, y, 1, 1);
        }
      }
    }
    /** Ellipse ring segment used for shading crescents. */
    shadeEllipse(cx, cy, rx, ry, col, side = 1, thickness = 0.35) {
      this.g.fillStyle = col;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / (rx + 0.5), dy = (y + 0.5 - cy) / (ry + 0.5);
          const d = dx * dx + dy * dy;
          if (d <= 1 && d >= 1 - thickness && (side > 0 ? (dx + dy) > 0.15 : (dx + dy) < -0.15)) {
            this.g.fillRect(x, y, 1, 1);
          }
        }
      }
    }
    line(x1, y1, x2, y2, col) {
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) || 1;
      for (let i = 0; i <= steps; i++) {
        this.px(Math.round(U.lerp(x1, x2, i / steps)), Math.round(U.lerp(y1, y2, i / steps)), col);
      }
    }
    /** Auto-trace: adds a 1px outline around every opaque region. */
    outline(col = OUTLINE) {
      const img = this.g.getImageData(0, 0, this.w, this.h);
      const d = img.data;
      const solid = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && d[(y * this.w + x) * 4 + 3] > 40;
      const out = [];
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) {
            out.push([x, y]);
          }
        }
      }
      for (const [x, y] of out) this.px(x, y, col);
    }
  }

  /** Build (or fetch cached) sprite. key must be unique per variant. */
  function sprite(key, w, h, drawFn) {
    if (cache.has(key)) return cache.get(key);
    const s = new Surface(w, h);
    drawFn(s);
    cache.set(key, s.c);
    return s.c;
  }

  /** Blit a cached sprite scaled, centered on (x, y-bottom anchored). */
  function blit(ctx, img, x, y, scale = CONFIG.PIXEL_SCALE, flipX = false, squashY = 1, squashX = 1) {
    const w = img.width * scale * squashX, h = img.height * scale * squashY;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
    ctx.restore();
  }

  return { Surface, sprite, blit, OUTLINE, cache };
})();
