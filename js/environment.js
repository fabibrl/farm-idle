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

  // Playable area inside the fence (virtual px)
  const PLAY = { x: 34, y: 130, w: W - 68, h: H - 300 };

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

  /** Wooden fence perimeter around the play area. */
  function drawFence(g, farmId) {
    const f = SPRITES.fenceH(24);
    const sc = 2;
    const { x, y, w, h } = PLAY;
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
    g.fillStyle = PIXEL.OUTLINE; g.fillRect(x - 1, y - 1, 10, 18);
    g.fillStyle = SPRITES.P.wood; g.fillRect(x, y, 8, 16);
    g.fillStyle = SPRITES.P.woodHi; g.fillRect(x, y, 2, 16);
    g.fillStyle = SPRITES.P.woodDk; g.fillRect(x + 6, y, 2, 16);
  }

  function scatter(g, rnd, img, count, scale, minY, maxY, pad = 20) {
    for (let i = 0; i < count; i++) {
      const x = pad + rnd() * (W - pad * 2 - img.width * scale);
      const y = minY + rnd() * (maxY - minY);
      g.drawImage(img, x | 0, y | 0, img.width * scale, img.height * scale);
    }
  }

  /** Build one farm background. */
  function farm(id) {
    const key = 'farm' + id;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const pal = GROUNDS[id];
    const rnd = seededRand(1234 + id * 999);

    // outer ground (darker border grass/dirt)
    noiseGround(g, { ...pal, base: pal.edge, light: pal.dark, dark: pal.edge, speck: pal.speck }, rnd, 0, 0, W, H);
    // inner pen ground
    noiseGround(g, pal, rnd, PLAY.x - 16, PLAY.y - 30, PLAY.w + 32, PLAY.h + 30);

    // dirt patches inside pen
    for (let i = 0; i < 4; i++) {
      const px2 = PLAY.x + 20 + rnd() * (PLAY.w - 70), py = PLAY.y + 20 + rnd() * (PLAY.h - 60);
      g.fillStyle = id === 2 ? '#8a6238' : '#8a7a4a';
      g.globalAlpha = 0.5;
      g.beginPath(); g.ellipse(px2, py, 18 + rnd() * 14, 8 + rnd() * 5, 0, 0, 7); g.fill();
      g.globalAlpha = 1;
    }

    // decorations outside the pen — per farm flavour
    const treeV = id === 0 ? 0 : 1;
    scatter(g, rnd, SPRITES.tree(treeV), 3, 2, 8, 40);
    scatter(g, rnd, SPRITES.tree(treeV), 2, 2, H - 130, H - 90);
    scatter(g, rnd, SPRITES.bush(id === 0 ? 2 : 1), 4, 2, H - 100, H - 60);
    if (id === 0) {
      scatter(g, rnd, SPRITES.flower(0), 6, 2, 90, 116);
      scatter(g, rnd, SPRITES.flower(1), 5, 2, H - 110, H - 70);
    } else if (id === 1) {
      scatter(g, rnd, SPRITES.flower(2), 5, 2, 90, 116);
      scatter(g, rnd, SPRITES.rock(0), 4, 2, H - 110, H - 70);
      scatter(g, rnd, SPRITES.rock(1), 2, 2, 92, 112);
    } else {
      scatter(g, rnd, SPRITES.rock(1), 4, 2, 90, 116);
      scatter(g, rnd, SPRITES.haystack(), 1, 2, H - 120, H - 100);
      scatter(g, rnd, SPRITES.rock(0), 3, 2, H - 100, H - 70);
    }

    drawFence(g, id);

    // in-pen props (corners)
    const barrelImg = SPRITES.barrel();
    g.drawImage(barrelImg, PLAY.x + 6, PLAY.y - 2, 28, 32);
    if (id === 2) {
      const hay = SPRITES.haystack();
      g.drawImage(hay, PLAY.x + PLAY.w - 48, PLAY.y + 2, 40, 32);
    } else {
      const bushImg = SPRITES.bush(id === 0 ? 2 : 1);
      g.drawImage(bushImg, PLAY.x + PLAY.w - 44, PLAY.y + 4, 36, 24);
    }
    // in-pen flowers/rocks
    for (let i = 0; i < 5; i++) {
      const img = id === 2 ? SPRITES.rock(0) : SPRITES.flower(U.randInt(0, 2));
      const x = PLAY.x + 14 + rnd() * (PLAY.w - 50);
      const y = PLAY.y + 30 + rnd() * (PLAY.h - 80);
      g.drawImage(img, x | 0, y | 0, img.width * 2, img.height * 2);
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

  /** Road control path between nodes (list of points per segment). */
  const ROADS = [
    [{ x: 80, y: 200 }, { x: 150, y: 230 }, { x: 210, y: 280 }, { x: 250, y: 330 }],
    [{ x: 250, y: 330 }, { x: 230, y: 390 }, { x: 170, y: 440 }, { x: 110, y: 470 }],
  ];

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

  function worldMap() {
    if (cache.map) return cache.map;
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

    // farm plots: fenced circles with per-farm ground
    for (let i = 0; i < 3; i++) {
      const n = MAP_NODES[i], pal = GROUNDS[i];
      g.fillStyle = PIXEL.OUTLINE;
      g.beginPath(); g.ellipse(n.x, n.y, 47, 35, 0, 0, 7); g.fill();
      g.fillStyle = pal.base;
      g.beginPath(); g.ellipse(n.x, n.y, 45, 33, 0, 0, 7); g.fill();
      g.fillStyle = pal.dark;
      for (let k = 0; k < 14; k++) {
        g.fillRect(n.x - 40 + rnd() * 78, n.y - 26 + rnd() * 52, 3, 2);
      }
      // fence ring: posts around ellipse
      for (let a = 0; a < 14; a++) {
        const t = a / 14 * Math.PI * 2;
        const px2 = n.x + Math.cos(t) * 44, py = n.y + Math.sin(t) * 32;
        g.fillStyle = PIXEL.OUTLINE; g.fillRect(px2 - 2, py - 7, 6, 12);
        g.fillStyle = SPRITES.P.wood; g.fillRect(px2 - 1, py - 6, 4, 10);
        g.fillStyle = SPRITES.P.woodHi; g.fillRect(px2 - 1, py - 6, 1, 10);
      }
    }

    // farm 1 building
    const house = SPRITES.farmhouse();
    g.drawImage(house, MAP_NODES[0].x - 34, MAP_NODES[0].y - 62, 68, 60);

    // trees scattered
    for (let i = 0; i < 9; i++) {
      const img = SPRITES.tree(rnd() < 0.5 ? 0 : 1);
      let x, y, tries = 0;
      do {
        x = 8 + rnd() * (W - 90); y = 8 + rnd() * (H - 140);
        tries++;
      } while (tries < 20 && MAP_NODES.some(n => U.dist(x + 30, y + 36, n.x, n.y) < 90));
      g.drawImage(img, x | 0, y | 0, 60, 72);
    }
    // bushes & rocks
    for (let i = 0; i < 6; i++) {
      const img = rnd() < 0.5 ? SPRITES.bush(1) : SPRITES.rock(0);
      const x = 10 + rnd() * (W - 100), y = 20 + rnd() * (H - 120);
      if (MAP_NODES.some(n => U.dist(x, y, n.x, n.y) < 70)) continue;
      g.drawImage(img, x | 0, y | 0, img.width * 2, img.height * 2);
    }

    cache.map = c;
    return c;
  }

  return { farm, worldMap, PLAY, MAP_NODES, roadPoints, GROUNDS };
})();
