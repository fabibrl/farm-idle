/**
 * ENVIRONMENT — pre-rendered backgrounds: the three farm pens (top view,
 * wooden fence perimeter, per-farm ground + decoration set) and the world map.
 * Each is drawn once into an offscreen canvas at virtual resolution.
 */
const ENVIRONMENT = (() => {
  const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
  const cache = {};

  // Per-farm ground palettes (bright green / darker green / brown dirt)
  const GROUNDS = [
    { base: '#79a848', dark: '#6a9840', light: '#8ab656', speck: '#5c8a36', edge: '#55803a' },
    { base: '#5f8c3e', dark: '#537e36', light: '#6f9c4a', speck: '#42682c', edge: '#41652f' },
    { base: '#9a7043', dark: '#8a6238', light: '#aa804f', speck: '#755232', edge: '#6b4d30' },
  ];

  // Playable area inside the fence (virtual px). Wider pen, pushed down a
  // little so the themed farmhouse sits above it as the focal point.
  const PLAY = { x: 22, y: 160, w: W - 44, h: H - 300 };

  /** The full PLAY rect scaled to a fence tier's footprint (top edge fixed,
   *  centered horizontally so the farmhouse path still meets the pen gate). */
  function rectForSize(size) {
    if (!(size < 1)) return PLAY;
    const w = Math.round(PLAY.w * size), h = Math.round(PLAY.h * size);
    return { x: PLAY.x + Math.round((PLAY.w - w) / 2), y: PLAY.y, w, h };
  }

  /**
   * The farm's CURRENT playable area: the full PLAY rect, shrunk to the
   * fence tier's footprint on construction farms. This is the single source
   * for spawn slots, walk bounds and fence rendering, so capacity gained
   * from a fence upgrade is always physically usable. Before the fence
   * exists the whole plot is walkable — that is the area animals escape from.
   */
  function playRect(farmId) {
    const def = Construction.levelDef(farmId);
    return def ? rectForSize(def.size) : PLAY;
  }

  /** Footprint the fence would have at a given tier (1-based) — ghost preview. */
  function rectForLevel(farmId, lv) {
    const def = Construction.levelDef(farmId, lv);
    return def ? rectForSize(def.size) : PLAY;
  }

  /** Screen rect of the farmhouse — also the ghost placeholder's spot. */
  function houseRect(id) {
    const building = [SPRITES.coop, SPRITES.cottage, SPRITES.barn][id]();
    const w = building.width * 3, h = building.height * 3;
    return { x: (W - w) / 2 | 0, y: PLAY.y - 16 - h, w, h, img: building };
  }

  /** Deterministic pseudo-random for stable decoration layouts. */
  function seededRand(seed) {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function noiseGround(g, pal, rnd, x0, y0, w, h) {
    g.fillStyle = pal.base;
    g.fillRect(x0, y0, w, h);
    const n = (w * h) / 90;
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * w, y = y0 + rnd() * h;
      const r = rnd();
      g.fillStyle = r < 0.35 ? pal.dark : r < 0.7 ? pal.light : pal.speck;
      const sz = 2 + ((rnd() * 3) | 0) * 2;
      g.fillRect(x | 0, y | 0, sz, rnd() < 0.5 ? 2 : sz);
    }
  }

  /**
   * Fence art — one look for the whole game. Every farm, built or classic,
   * renders Farm 1's wood fence: same sprite, same palette, same proportions.
   * A fence upgrade grows the enclosure (footprint + segment count, see
   * playRect / rectForLevel); it never changes the material.
   */

  /**
   * Post colors [face, highlight, shadow] — shared by the baked fence and the
   * live ghost preview, so an unbuilt fence previews in the material it will
   * actually be built from.
   */
  function fencePalette() {
    return [SPRITES.P.wood, SPRITES.P.woodHi, SPRITES.P.woodDk];
  }

  /** Fence perimeter around a play rect. */
  function drawFence(g, rect) {
    const f = SPRITES.fenceH(24);
    const sc = 2;
    const { x, y, w, h } = rect;
    const top = y - 20, bot = y + h - 6;
    // back fence (behind animals visually)
    for (let fx = x - 14; fx < x + w + 14; fx += f.width * sc - 2) {
      g.drawImage(f, fx, top, f.width * sc, f.height * sc);
    }
    // side fences (vertical posts made from small segments)
    for (let fy = top + 16; fy < bot; fy += 22) {
      drawPost(g, x - 12, fy); drawPost(g, x + w + 4, fy);
    }
    // side rails
    g.fillStyle = SPRITES.P.woodDk;
    g.fillRect(x - 8, top + 10, 3, bot - top - 4);
    g.fillRect(x + w + 8, top + 10, 3, bot - top - 4);
    g.fillStyle = SPRITES.P.wood;
    g.fillRect(x - 9, top + 10, 1, bot - top - 4);
    g.fillRect(x + w + 7, top + 10, 1, bot - top - 4);
    // front fence
    for (let fx = x - 14; fx < x + w + 14; fx += f.width * sc - 2) {
      g.drawImage(f, fx, bot, f.width * sc, f.height * sc);
    }
  }
  function drawPost(g, x, y) {
    const [face, hi, dk] = fencePalette();
    g.fillStyle = PIXEL.OUTLINE; g.fillRect(x - 1, y - 1, 10, 18);
    g.fillStyle = face; g.fillRect(x, y, 8, 16);
    g.fillStyle = hi; g.fillRect(x, y, 2, 16);
    g.fillStyle = dk; g.fillRect(x + 6, y, 2, 16);
  }

  /** Small stack of planks — construction-site prop for the unbuilt farm. */
  function drawPlankPile(g, x, y) {
    g.fillStyle = PIXEL.OUTLINE;
    g.fillRect(x - 2, y - 2, 48, 20);
    for (let row = 0; row < 3; row++) {
      const px2 = x + (row % 2) * 3, py = y + row * 5;
      g.fillStyle = SPRITES.P.wood; g.fillRect(px2, py, 42, 4);
      g.fillStyle = SPRITES.P.woodHi; g.fillRect(px2, py, 42, 1);
      g.fillStyle = SPRITES.P.woodDk; g.fillRect(px2 + 39, py, 3, 4);
    }
  }

  /**
   * Build one farm background. Construction farms re-render (and re-cache)
   * per build stage: a bare plot has neither house nor pen, a housed-but-
   * unfenced plot is open pasture, and each fence tier bakes its own
   * footprint (see playRect).
   */
  function farm(id) {
    const house = Construction.houseBuilt(id);
    const built = Construction.fenceBuilt(id);
    const fenceLv = Construction.fenceLevel(id);
    const key = 'farm' + id + (!Construction.required(id) ? ''
      : built ? '-f' + fenceLv : house ? '-h' : '-l');
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const pal = GROUNDS[id];
    const rnd = seededRand(1234 + id * 999);
    const R = playRect(id);

    // outer ground (darker border grass/dirt)
    noiseGround(g, { ...pal, base: pal.edge, light: pal.dark, dark: pal.edge, speck: pal.speck }, rnd, 0, 0, W, H);
    if (house) {
      // inner pen ground
      noiseGround(g, pal, rnd, R.x - 16, R.y - 30, R.w + 32, R.h + 30);

      // dirt patches inside pen — just a couple, kept subtle for open grass
      for (let i = 0; i < 2; i++) {
        const px2 = R.x + 40 + rnd() * Math.max(20, R.w - 110), py = R.y + 50 + rnd() * Math.max(20, R.h - 120);
        g.fillStyle = id === 2 ? '#8a6238' : '#8a7a4a';
        g.globalAlpha = 0.4;
        g.beginPath(); g.ellipse(px2, py, 16 + rnd() * 10, 7 + rnd() * 4, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
      }
    }

    // dirt path from the farmhouse door down to the pen gate, then the
    // themed farmhouse itself — the focal point, centered on the grass
    // above the pen (both only once the house has been built)
    if (house) {
      g.fillStyle = '#caa96a';
      g.fillRect(W / 2 - 11, R.y - 34, 22, 40);
      g.beginPath(); g.ellipse(W / 2, R.y + 8, 15, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#b8935a';
      g.fillRect(W / 2 - 7, R.y - 34, 14, 38);
      g.beginPath(); g.ellipse(W / 2, R.y + 6, 10, 5, 0, 0, 7); g.fill();

      const hr = houseRect(id);
      g.drawImage(hr.img, hr.x, hr.y, hr.w, hr.h);
    }

    // trees: one flanking the farmhouse on the left, one on the
    // bottom-right grass — the upper-right corner is kept clear for the
    // UFO's permanent parking spot (see ufo.js spot())
    const treeV = id === 0 ? 0 : 1;
    const treeImg = SPRITES.tree(treeV);
    g.drawImage(treeImg, 6, R.y - 94, 60, 72);
    g.drawImage(treeImg, W - 68, PLAY.y + PLAY.h + 40, 60, 72);

    // flowers beside the path entrance
    g.drawImage(SPRITES.flower(id), W / 2 - 52, R.y - 40, 16, 20);
    g.drawImage(SPRITES.flower((id + 1) % 3), W / 2 + 38, R.y - 38, 16, 20);

    // tidy row of decorations on the grass below the front fence
    const botY = R.y + R.h + 32;
    g.drawImage(SPRITES.bush(id === 0 ? 2 : 1), 28, botY, 36, 24);
    // (kept left of x~250: the relocated tree stands on the bottom-right grass)
    g.drawImage(SPRITES.bush(1), 206, botY + 4, 36, 24);
    if (id === 2) {
      g.drawImage(SPRITES.haystack(), W / 2 - 20, botY - 2, 40, 32);
    } else {
      g.drawImage(SPRITES.rock(1), W / 2 - 16, botY + 8, 32, 20);
    }
    g.drawImage(SPRITES.flower((id + 2) % 3), 78, botY + 10, 16, 20);
    g.drawImage(SPRITES.flower(id), W - 88, botY + 12, 16, 20);

    if (!built) {
      // no fence yet: a construction site waiting for the player — a plank
      // pile and site rubble where the pen will go (the ghosted fence
      // footprint is drawn live, see FarmScene.drawHouse)
      drawPlankPile(g, W / 2 - 74, PLAY.y + PLAY.h - 24);
      g.drawImage(SPRITES.rock(0), W / 2 + 30, PLAY.y + PLAY.h - 34, 28, 20);
      g.drawImage(SPRITES.rock(1), W / 2 + 54, PLAY.y + PLAY.h - 20, 28, 20);
      cache[key] = c;
      return c;
    }

    drawFence(g, R);

    // in-pen props tucked into the top corners, out of the walk area
    g.drawImage(SPRITES.barrel(), R.x + 6, R.y - 2, 28, 32);
    if (id === 2) {
      g.drawImage(SPRITES.haystack(), R.x + R.w - 48, R.y + 2, 40, 32);
    } else {
      g.drawImage(SPRITES.bush(id === 0 ? 2 : 1), R.x + R.w - 44, R.y + 4, 36, 24);
    }
    // a few accents pinned to the pen edges so the middle stays open
    const edge = [
      { x: R.x + 16, y: R.y + R.h - 42 },
      { x: R.x + R.w - 34, y: R.y + R.h - 52 },
      { x: R.x + 18, y: R.y + 64 },
    ];
    for (let i = 0; i < edge.length; i++) {
      const img = id === 2 ? SPRITES.rock(i % 2) : SPRITES.flower((id + i) % 3);
      g.drawImage(img, edge[i].x, edge[i].y, img.width * 2, img.height * 2);
    }

    cache[key] = c;
    return c;
  }

  // ---------------- WORLD MAP ----------------
  // Farm node positions on the map
  const MAP_NODES = [
    { x: 80,  y: 200 },
    { x: 250, y: 330 },
    { x: 110, y: 470 },
  ];

  /**
   * Per-farm themed map anchors: where the species mascot stands, where
   * chimney smoke rises, the windmill hub, and waving grass tufts.
   * All animated in MapScene; static art is baked into worldMap().
   */
  const THEME = [
    { // chicken
      animal: { x: 56, y: 232 },
      grass: [{ x: 38, y: 180 }, { x: 120, y: 184 }, { x: 46, y: 232 }],
    },
    { // sheep
      animal: { x: 278, y: 352 },
      windmill: { x: 188, y: 294 },
      chimney: { x: 266, y: 282 },
      grass: [{ x: 210, y: 302 }, { x: 292, y: 346 }, { x: 206, y: 354 }],
    },
    { // cow
      animal: { x: 140, y: 502 },
      chimney: { x: 96, y: 414 },
      grass: [{ x: 70, y: 444 }, { x: 150, y: 488 }, { x: 66, y: 498 }],
    },
  ];

  /** Road control path between nodes (list of points per segment). */
  const ROADS = [
    [{ x: 80, y: 200 }, { x: 150, y: 230 }, { x: 210, y: 280 }, { x: 250, y: 330 }],
    [{ x: 250, y: 330 }, { x: 230, y: 390 }, { x: 170, y: 440 }, { x: 110, y: 470 }],
  ];

  // Decorative striped flag planted roadside on the Farm 1 → Farm 2 stretch —
  // anchored to the road segment's middle control points so it tracks any
  // road re-routing. Offset perpendicular to the upper-right side of the
  // road, outside every node's tap radius and clear of the windmill blades.
  // Purely visual.
  const FLAG = (() => {
    const a = ROADS[0][1], b = ROADS[0][2];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // unit perpendicular pointing away from the road's upper-right edge
    const px = (b.y - a.y) / len, py = -(b.x - a.x) / len;
    return {
      x: Math.round((a.x + b.x) / 2 + px * 14),
      y: Math.round((a.y + b.y) / 2 + py * 14),
    };
  })();

  function roadPoints(seg, step = 6) {
    // Catmull-rom-ish smooth sampling through control points
    const pts = [];
    const cp = ROADS[seg];
    for (let i = 0; i < cp.length - 1; i++) {
      const a = cp[i], b = cp[i + 1];
      const n = Math.ceil(U.dist(a.x, a.y, b.x, b.y) / step);
      for (let j = 0; j < n; j++) {
        const t = j / n;
        // slight sine wiggle for a hand-drawn curve
        const wig = Math.sin((i + t) * 5) * 6;
        pts.push({ x: U.lerp(a.x, b.x, t) + wig * 0.4, y: U.lerp(a.y, b.y, t) });
      }
    }
    pts.push(cp[cp.length - 1]);
    return pts;
  }

  /**
   * Construction stage of one farm for map rendering: 0 = empty, undeveloped
   * plot (land not bought, or bought but nothing built on it yet), 1 = house
   * standing but no fence, 2 = complete. Classic farms are always 2.
   */
  function mapStage(farmId) {
    if (!Construction.required(farmId)) return 2;
    if (!Construction.houseBuilt(farmId)) return 0;
    return Construction.fenceBuilt(farmId) ? 2 : 1;
  }

  function worldMap() {
    // the map re-bakes (and re-caches) whenever a construction farm's build
    // stage or fence tier changes, so plots develop visibly as the player
    // builds — including the fence ring taking on each new tier's material
    const mapKey = 'map-' + CONFIG.FARMS
      .map(f => mapStage(f.id) + '.' + Construction.fenceLevel(f.id)).join('');
    if (cache[mapKey]) return cache[mapKey];
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rnd = seededRand(777);

    noiseGround(g, GROUNDS[1], rnd, 0, 0, W, H);

    // river on the right
    g.fillStyle = '#3d6f8e';
    g.beginPath();
    g.moveTo(W - 60, 0);
    for (let y = 0; y <= H; y += 20) g.lineTo(W - 55 + Math.sin(y * 0.02) * 16, y);
    g.lineTo(W, H); g.lineTo(W, 0); g.closePath(); g.fill();
    g.fillStyle = '#4d83a3';
    for (let y = 10; y < H; y += 26) {
      g.fillRect(W - 40 + Math.sin(y * 0.05) * 10, y, 10, 3);
    }
    g.fillStyle = '#6ea3bf';
    for (let y = 22; y < H; y += 34) g.fillRect(W - 30 + Math.sin(y * 0.07) * 8, y, 6, 2);

    // roads
    g.strokeStyle = '#caa96a';
    g.lineWidth = 12;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let seg = 0; seg < 2; seg++) {
      const pts = roadPoints(seg);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.stroke();
    }
    g.strokeStyle = '#b8935a';
    g.lineWidth = 8;
    for (let seg = 0; seg < 2; seg++) {
      const pts = roadPoints(seg);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.stroke();
    }

    // farm plots: fenced circles with per-farm ground (an unpurchased
    // construction plot stays an open, unfenced patch of ground)
    for (let i = 0; i < 3; i++) {
      const n = MAP_NODES[i], pal = GROUNDS[i];
      const stage = mapStage(i);
      g.fillStyle = PIXEL.OUTLINE;
      g.beginPath(); g.ellipse(n.x, n.y, 47, 35, 0, 0, 7); g.fill();
      g.fillStyle = pal.base;
      g.beginPath(); g.ellipse(n.x, n.y, 45, 33, 0, 0, 7); g.fill();
      g.fillStyle = pal.dark;
      for (let k = 0; k < 14; k++) {
        g.fillRect(n.x - 40 + rnd() * 78, n.y - 26 + rnd() * 52, 3, 2);
      }
      if (stage < 2) continue; // no fence built yet: no fence ring on the plot
      // fence ring: posts around the ellipse, in the same wood the farm's
      // own fence is built from
      const [face, hi] = fencePalette();
      for (let a = 0; a < 14; a++) {
        const t = a / 14 * Math.PI * 2;
        const px2 = n.x + Math.cos(t) * 44, py = n.y + Math.sin(t) * 32;
        g.fillStyle = PIXEL.OUTLINE; g.fillRect(px2 - 2, py - 7, 6, 12);
        g.fillStyle = face; g.fillRect(px2 - 1, py - 6, 4, 10);
        g.fillStyle = hi; g.fillRect(px2 - 1, py - 6, 1, 10);
      }
    }

    // ---- ground details on the plots (kept procedural; part of the
    // terrain layers in the Figma "World Map — Props" scene) ----
    {
      const n = MAP_NODES[0];
      // scattered feed
      g.fillStyle = '#e0b656';
      for (let k = 0; k < 10; k++) {
        g.fillRect(n.x - 24 + rnd() * 48 | 0, n.y + 8 + rnd() * 18 | 0, 2, 2);
      }
    }
    {
      const n = MAP_NODES[1];
      // pasture tufts (lighter green)
      g.fillStyle = GROUNDS[1].light;
      for (let k = 0; k < 12; k++) {
        g.fillRect(n.x - 36 + rnd() * 72 | 0, n.y - 20 + rnd() * 42 | 0, 3, 2);
      }
    }
    {
      const n = MAP_NODES[2];
      // grazing patches on the dirt plot
      g.fillStyle = '#79a848'; g.globalAlpha = 0.7;
      g.beginPath(); g.ellipse(n.x - 26, n.y + 16, 14, 7, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(n.x + 30, n.y + 8, 11, 6, 0, 0, 7); g.fill();
      g.globalAlpha = 1;
    }

    // ---- props: fixed layout from the Figma "World Map — Props" scene
    // (50:3), Figma px / 2, trim offsets unfolded to full-sprite rects.
    // Layer order here mirrors the design's z-order. ----
    const SPR = {
      haystack: () => SPRITES.haystack(), coop: () => SPRITES.coop(), nest: () => SPRITES.nest(),
      windmillTower: () => SPRITES.windmillTower(), cottage: () => SPRITES.cottage(),
      woolBale: () => SPRITES.woolBale(), flower0: () => SPRITES.flower(0), flower2: () => SPRITES.flower(2),
      silo: () => SPRITES.silo(), barn: () => SPRITES.barn(), milkCan: () => SPRITES.milkCan(),
      tree0: () => SPRITES.tree(0), tree1: () => SPRITES.tree(1),
      bush1: () => SPRITES.bush(1), rock0: () => SPRITES.rock(0),
    };
    // Props tagged with a farm id + the build stage they appear at grow in
    // with that farm's construction: the farmhouse prop arrives with the
    // house (stage 1) and the farm's dressing with the fence (stage 2), so a
    // plot under construction reads as under construction from the map.
    // Farm 1 has no entry and is therefore always fully dressed.
    const MID_PROPS = [
      ['haystack', 47.5, 197, 24, 19], ['coop', 45, 121.84, 71, 62.16], ['nest', 85.5, 194, 32, 20],
      ['windmillTower', 170, 282, 36, 60, 1, 2], ['cottage', 212.3, 248.09, 79.9, 75.26, 1, 1],
      ['woolBale', 268, 342, 28, 22, 1, 2], ['woolBale', 256, 354.36, 22, 18, 1, 2],
      ['flower0', 212, 336, 16, 20, 1, 2], ['flower2', 208, 332, 16, 20, 1, 2],
      ['silo', 37, 397, 32, 68, 2, 2], ['barn', 67.15, 379.22, 88.2, 78.22, 2, 1],
      ['milkCan', 62, 480, 20, 24, 2, 2], ['milkCan', 76, 486, 16, 20, 2, 2],
    ];
    const FG_PROPS = [
      ['tree1', 206, 79.5, 60, 72], ['tree0', 258, 409, 60, 72], ['tree1', 244, 490, 60, 72],
      ['tree1', 16, 511, 60, 72], ['tree0', 168, 490, 60, 72], ['tree1', 84.5, 297, 60, 72],
      ['tree1', 124, 67, 60, 72], ['tree0', 167.5, 125, 60, 72], ['tree0', 72, 1, 60, 72],
      ['tree0', 3, 250, 60, 72], ['tree0', 202, 200, 60, 72], ['tree0', 209, 561, 60, 72],
      ['tree0', 75.5, 556, 60, 72],
      ['bush1', 104, 252, 36, 24], ['bush1', 14, 354, 36, 24], ['bush1', 128, 147, 36, 24],
      ['bush1', 197.5, 43, 36, 24],
      ['rock0', 12, 151, 28, 20], ['rock0', 121, 502, 28, 20], ['bush1', 42, 65, 36, 24],
      ['rock0', 48, 314, 28, 20], ['rock0', 271.5, 554, 28, 20],
    ];
    for (const [kind, x, y, w, h, farmId, needStage] of MID_PROPS) {
      if (farmId !== undefined && mapStage(farmId) < needStage) continue;
      g.drawImage(SPR[kind](), x, y, w, h);
    }
    for (const [kind, x, y, w, h] of FG_PROPS) g.drawImage(SPR[kind](), x, y, w, h);

    cache[mapKey] = c;
    return c;
  }

  return {
    farm, worldMap, mapStage, playRect, rectForLevel, houseRect, fencePalette,
    PLAY, MAP_NODES, THEME, FLAG, roadPoints, GROUNDS,
  };
})();
