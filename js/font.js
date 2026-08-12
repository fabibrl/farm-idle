/**
 * PixelFont — the game's global 'pixel-art-font'.
 *
 * Every piece of text in the game (HUD, buttons, dialogues, popups, overlays)
 * renders through this module. Glyphs are a hand-authored 5px bitmap grid
 * drawn with fillRect at integer scales, which guarantees zero anti-aliasing
 * and zero sub-pixel blur by construction — no TTF rasterizer involved.
 *
 * - Sizes snap to integer multiples of the 5px glyph grid (5/10/15/20/...),
 *   so arbitrary requests (8, 16, 24, 32) land on a crisp scale.
 * - SIZE tiers define the visual hierarchy: TITLE > SUBTITLE > BUTTON/BODY > CAPTION.
 * - fit / truncate / wrap keep text inside fixed-width containers: fitting
 *   first steps the size down, then falls back to an '…' ellipsis.
 */
const PixelFont = (() => {
  const FAMILY = 'pixel-art-font';
  const GLYPH_H = 5;                 // native glyph grid height in pixels

  // Typography scale (px, all multiples of GLYPH_H so scales stay integer).
  const SIZE = {
    TITLE: 20,      // screen titles (loading, discovery, reward ad)
    SUBTITLE: 15,   // popup / panel titles
    BUTTON: 10,     // interactive button labels
    BODY: 10,       // primary inline text (names, values, counters)
    CAPTION: 5,     // secondary text (stat lines, flavor, hints)
  };

  // ---------------- glyph atlas (5 rows, variable width) ----------------
  const GLYPHS = {
    A: ['.##.', '#..#', '####', '#..#', '#..#'],
    B: ['###.', '#..#', '###.', '#..#', '###.'],
    C: ['.###', '#...', '#...', '#...', '.###'],
    D: ['###.', '#..#', '#..#', '#..#', '###.'],
    E: ['####', '#...', '###.', '#...', '####'],
    F: ['####', '#...', '###.', '#...', '#...'],
    G: ['.###', '#...', '#.##', '#..#', '.###'],
    H: ['#..#', '#..#', '####', '#..#', '#..#'],
    I: ['###', '.#.', '.#.', '.#.', '###'],
    J: ['..##', '...#', '...#', '#..#', '.##.'],
    K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
    L: ['#...', '#...', '#...', '#...', '####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
    O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
    P: ['###.', '#..#', '###.', '#...', '#...'],
    Q: ['.##.', '#..#', '#..#', '#.##', '.###'],
    R: ['###.', '#..#', '###.', '#.#.', '#..#'],
    S: ['.###', '#...', '.##.', '...#', '###.'],
    T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
    V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
    X: ['#..#', '#..#', '.##.', '#..#', '#..#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
    Z: ['####', '...#', '.##.', '#...', '####'],
    0: ['.##.', '#..#', '#..#', '#..#', '.##.'],
    1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['###.', '...#', '.##.', '#...', '####'],
    3: ['###.', '...#', '.##.', '...#', '###.'],
    4: ['#..#', '#..#', '####', '...#', '...#'],
    5: ['####', '#...', '###.', '...#', '###.'],
    6: ['.###', '#...', '###.', '#..#', '.##.'],
    7: ['####', '...#', '..#.', '.#..', '.#..'],
    8: ['.##.', '#..#', '.##.', '#..#', '.##.'],
    9: ['.##.', '#..#', '.###', '...#', '##..'],
    ',': ['.', '.', '.', '#', '#'],
    '+': ['...', '.#.', '###', '.#.', '...'],
    '-': ['...', '...', '###', '...', '...'],
    ':': ['.', '#', '.', '#', '.'],
    '.': ['.', '.', '.', '.', '#'],
    '!': ['#', '#', '#', '.', '#'],
    '?': ['###', '..#', '.#.', '...', '.#.'],
    '/': ['..#', '..#', '.#.', '#..', '#..'],
    '>': ['#..', '.#.', '..#', '.#.', '#..'],
    '<': ['..#', '.#.', '#..', '.#.', '..#'],
    "'": ['#', '#', '.', '.', '.'],
    '"': ['#.#', '#.#', '...', '...', '...'],
    '(': ['.#', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '#.'],
    '=': ['...', '###', '...', '###', '...'],
    '%': ['#..#', '..#.', '.#..', '#..#', '....'],
    '…': ['.....', '.....', '.....', '.....', '#.#.#'],
    ' ': ['..', '..', '..', '..', '..'],
  };

  // ---------------- sizing ----------------
  /** Snap any requested size to the nearest integer glyph scale (min 5px). */
  function snap(size) {
    return Math.max(1, Math.round(size / GLYPH_H)) * GLYPH_H;
  }

  function scaleFor(size) { return snap(size) / GLYPH_H; }

  /** Pixel width of text at a snapped font size. */
  function measure(text, size) {
    const s = scaleFor(size);
    let w = 0;
    for (const ch of String(text).toUpperCase()) {
      const gl = GLYPHS[ch] || GLYPHS['?'];
      w += (gl[0].length + 1) * s;
    }
    return Math.max(0, w - s);
  }

  /** Line advance for stacked lines of this size. */
  function lineHeight(size) { return Math.round(snap(size) * 1.4); }

  /**
   * Largest snapped size <= `size` whose text fits in maxWidth
   * (never below CAPTION size — beyond that, truncate instead).
   */
  function fit(text, size, maxWidth) {
    let px = snap(size);
    while (px > SIZE.CAPTION && measure(text, px) > maxWidth) px -= GLYPH_H;
    return px;
  }

  /** Truncate with an '…' ellipsis so text fits in maxWidth at this size. */
  function truncate(text, size, maxWidth) {
    let t = String(text);
    if (measure(t, size) <= maxWidth) return t;
    while (t.length > 1 && measure(t + '…', size) > maxWidth) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }

  /** Word-wrap text into lines that each fit maxWidth at this size. */
  function wrap(text, size, maxWidth) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const cand = line ? line + ' ' + word : word;
      if (line && measure(cand, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = cand;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---------------- rendering ----------------
  function drawGlyphs(ctx, text, x, y, s, col) {
    ctx.fillStyle = col;
    let cx = x;
    for (const ch of String(text).toUpperCase()) {
      const gl = GLYPHS[ch] || GLYPHS['?'];
      for (let r = 0; r < GLYPH_H; r++) {
        const row = gl[r];
        for (let c = 0; c < row.length; c++) {
          if (row[c] === '#') ctx.fillRect(cx + c * s, y + r * s, s, s);
        }
      }
      cx += (gl[0].length + 1) * s;
    }
  }

  /**
   * Draw one line of pixel-art-font text.
   * align: 'left' | 'center' | 'right'; outline adds a dark border,
   * shadow a soft drop. maxWidth (optional) is the container safety net:
   * the size steps down to fit, then the text is ellipsis-truncated.
   * Returns the rendered width.
   */
  function draw(ctx, text, x, y, size = SIZE.BODY, col = '#fff', align = 'left',
                outline = false, shadow = false, maxWidth = 0) {
    let t = String(text);
    let px = snap(size);
    if (maxWidth > 0) {
      px = fit(t, px, maxWidth);
      if (measure(t, px) > maxWidth) t = truncate(t, px, maxWidth);
    }
    const s = px / GLYPH_H;
    const w = measure(t, px);
    let dx = x;
    if (align === 'center') dx = x - w / 2;
    if (align === 'right') dx = x - w;
    dx = Math.round(dx); y = Math.round(y);
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (outline) {
      for (const [ox, oy] of [[-s, 0], [s, 0], [0, -s], [0, s], [-s, -s], [s, -s], [-s, s], [s, s]]) {
        drawGlyphs(ctx, t, dx + ox, y + oy, s, PIXEL.OUTLINE);
      }
    } else if (shadow) {
      drawGlyphs(ctx, t, dx + s, y + s, s, 'rgba(0,0,0,0.4)');
    }
    drawGlyphs(ctx, t, dx, y, s, col);
    ctx.imageSmoothingEnabled = smoothing;
    return w;
  }

  /**
   * Draw auto-wrapped text (up to maxLines, last line ellipsis-truncated).
   * Returns the y just below the last rendered line.
   */
  function drawWrapped(ctx, text, x, y, size, col, align, maxWidth, maxLines = 2,
                       outline = false, shadow = false) {
    const px = snap(size);
    let lines = wrap(text, px, maxWidth);
    if (lines.length > maxLines) {
      const rest = lines.slice(maxLines - 1).join(' ');
      lines = lines.slice(0, maxLines - 1);
      lines.push(truncate(rest, px, maxWidth));
    }
    const lh = lineHeight(px);
    for (let i = 0; i < lines.length; i++) {
      draw(ctx, lines[i], x, y + i * lh, px, col, align, outline, shadow);
    }
    return y + lines.length * lh;
  }

  return { FAMILY, GLYPH_H, SIZE, snap, scaleFor, measure, lineHeight, fit, truncate, wrap, draw, drawWrapped };
})();
