/**
 * PixelFont — the game's global text engine, rendering the embedded
 * "Press Start 2P" typeface (assets/fonts/PressStart2P-Regular.ttf), the
 * exact font used by the Figma designs (single source of truth).
 *
 * Font metrics (parsed from the TTF): unitsPerEm 1000, ascent 1000,
 * descent 0 — the baseline sits exactly 1em below the glyph-box top, and
 * the font is strictly monospaced with advance = 1em. This makes layout
 * fully deterministic: measure(text, size) = text.length * size, and
 * draw(x, y, size) places the glyph em-box top at y (baseline at y + size),
 * mirroring how Figma positions text nodes.
 *
 * - Sizes are in canvas px and may be fractional (Figma px / 2), snapped
 *   to 0.5 so they land on whole device pixels at the 2x render scale.
 * - SIZE tiers define the visual hierarchy: TITLE > SUBTITLE > BUTTON/BODY > CAPTION.
 * - fit / truncate / wrap keep text inside fixed-width containers: fitting
 *   first steps the size down, then falls back to an '…' ellipsis.
 */
const PixelFont = (() => {
  const FAMILY = 'Press Start 2P';

  // Typography scale (canvas px = Figma px / 2, from the Figma file).
  const SIZE = {
    TITLE: 17,      // screen titles (loading, discovery, reward ad) — Figma 34px
    SUBTITLE: 15,   // popup / panel titles
    BUTTON: 10,     // interactive button labels — Figma 20px
    BODY: 10,       // primary inline text (names, values, counters)
    CAPTION: 7.5,   // secondary text (stat lines, flavor, hints) — Figma 15px
  };

  // ---------------- font loading ----------------
  let loaded = false;
  const ready = (typeof FontFace !== 'undefined' && typeof document !== 'undefined')
    ? new FontFace(FAMILY, "url('assets/fonts/PressStart2P-Regular.ttf')")
        .load()
        .then(face => { document.fonts.add(face); loaded = true; })
        .catch(() => { loaded = true; })
    : Promise.resolve();

  // ---------------- sizing ----------------
  /** Snap any requested size to the 0.5px grid (whole device pixels at 2x). */
  function snap(size) {
    return Math.max(2, Math.round(size * 2) / 2);
  }

  /** Pixel width of text at this size (monospace: advance = 1em). */
  function measure(text, size) {
    return String(text).length * snap(size);
  }

  /** Line advance for stacked lines of this size. */
  function lineHeight(size) { return Math.round(snap(size) * 1.4); }

  /**
   * Largest 0.5-snapped size <= `size` whose text fits in maxWidth
   * (never below 5px — beyond that, truncate instead).
   */
  function fit(text, size, maxWidth) {
    const n = String(text).length || 1;
    const px = Math.min(snap(size), Math.floor((maxWidth / n) * 2) / 2);
    return Math.max(5, px);
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
  function setFont(ctx, px) {
    ctx.font = px + 'px "' + FAMILY + '"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * Draw one line of text. (x, y) is the glyph em-box top-left (baseline is
   * at y + size, matching Figma's text node top + half-leading).
   * align: 'left' | 'center' | 'right'; outline adds a dark border,
   * shadow a soft drop. maxWidth (optional) is the container safety net:
   * the size steps down to fit, then the text is ellipsis-truncated.
   * Returns the rendered width.
   */
  function draw(ctx, text, x, y, size = SIZE.BODY, col = '#fff', align = 'left',
                outline = false, shadow = false, maxWidth = 0) {
    let t = String(text).toUpperCase();
    let px = snap(size);
    if (maxWidth > 0) {
      px = fit(t, px, maxWidth);
      if (measure(t, px) > maxWidth) t = truncate(t, px, maxWidth);
    }
    const w = measure(t, px);
    let dx = x;
    if (align === 'center') dx = x - w / 2;
    if (align === 'right') dx = x - w;
    dx = Math.round(dx * 2) / 2;
    const by = Math.round((y + px) * 2) / 2;   // baseline
    setFont(ctx, px);
    if (outline) {
      const o = Math.max(1, Math.round(px / 8));
      ctx.fillStyle = PIXEL.OUTLINE;
      for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) {
        ctx.fillText(t, dx + ox, by + oy);
      }
    } else if (shadow) {
      const o = Math.max(1, Math.round(px / 8));
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(t, dx + o, by + o);
    }
    ctx.fillStyle = col;
    ctx.fillText(t, dx, by);
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

  return { FAMILY, SIZE, ready, snap, measure, lineHeight, fit, truncate, wrap, draw, drawWrapped,
           get loaded() { return loaded; } };
})();
