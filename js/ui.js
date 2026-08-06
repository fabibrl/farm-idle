/**
 * UIManager — HUD, buttons, popups, wooden panels, and a hand-authored
 * bitmap pixel font so typography matches the art bible.
 */
const UI = (() => {
  const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
  const P = () => SPRITES.P;

  // ---------------- pixel font (5px tall, variable width) ----------------
  const FONT = {
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
    ' ': ['..', '..', '..', '..', '..'],
  };

  function measure(text, s) {
    let w = 0;
    for (const ch of String(text).toUpperCase()) {
      const gl = FONT[ch] || FONT['?'];
      w += (gl[0].length + 1) * s;
    }
    return w - s;
  }

  function drawGlyphs(ctx, text, x, y, s, col) {
    ctx.fillStyle = col;
    let cx = x;
    for (const ch of String(text).toUpperCase()) {
      const gl = FONT[ch] || FONT['?'];
      for (let r = 0; r < 5; r++) {
        const row = gl[r];
        for (let c = 0; c < row.length; c++) {
          if (row[c] === '#') ctx.fillRect(cx + c * s, y + r * s, s, s);
        }
      }
      cx += (gl[0].length + 1) * s;
    }
  }

  /**
   * drawText: size = glyph pixel scale * 5 (approx height in px).
   * align: 'left' | 'center' | 'right'; outline adds dark border.
   */
  function drawText(ctx, text, x, y, size = 10, col = '#fff', align = 'left', outline = false, shadow = false) {
    const s = Math.max(1, Math.round(size / 5));
    const w = measure(text, s);
    let px = x;
    if (align === 'center') px = x - w / 2;
    if (align === 'right') px = x - w;
    px = Math.round(px); y = Math.round(y);
    if (outline) {
      for (const [ox, oy] of [[-s, 0], [s, 0], [0, -s], [0, s], [-s, -s], [s, -s], [-s, s], [s, s]]) {
        drawGlyphs(ctx, text, px + ox, y + oy, s, PIXEL.OUTLINE);
      }
    } else if (shadow) {
      drawGlyphs(ctx, text, px + s, y + s, s, 'rgba(0,0,0,0.4)');
    }
    drawGlyphs(ctx, text, px, y, s, col);
    return w;
  }

  // ---------------- wooden panels ----------------
  function woodPanel(ctx, x, y, w, h, opts = {}) {
    const p = P();
    // outline
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    // base
    ctx.fillStyle = opts.dark ? p.woodDk : p.wood;
    ctx.fillRect(x, y, w, h);
    // top light bevel, bottom dark bevel
    ctx.fillStyle = opts.dark ? p.wood : p.woodHi;
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = p.woodDkr;
    ctx.fillRect(x, y + h - 3, w, 3);
    // plank seams
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let py = y + 12; py < y + h - 6; py += 14) ctx.fillRect(x, py, w, 1);
    // wood grain flecks
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < w * h / 260; i++) {
      ctx.fillRect(x + ((i * 53) % (w - 8)) + 4, y + ((i * 37) % (h - 10)) + 5, 4, 1);
    }
    if (opts.gold) {
      // gold corner studs
      ctx.fillStyle = p.gold;
      for (const [cx, cy] of [[x + 4, y + 4], [x + w - 7, y + 4], [x + 4, y + h - 7], [x + w - 7, y + h - 7]]) {
        ctx.fillRect(cx, cy, 3, 3);
        ctx.fillStyle = p.goldHi; ctx.fillRect(cx, cy, 1, 1); ctx.fillStyle = p.gold;
      }
    }
  }

  /** Dark inset capsule (coin counter background). */
  function inset(ctx, x, y, w, h) {
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a2817';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2e1f10';
    ctx.fillRect(x, y, w, 2);
  }

  /** Colored button (green/gray/red) with bevel + icon + label. */
  function drawButton(ctx, b) {
    const p = P();
    const cols = {
      green: ['#5e9c31', '#7dbb4a', '#41701f'],
      gray: ['#8c8678', '#aaa596', '#635e52'],
      red: ['#c0453a', '#dd6a56', '#8e2f27'],
      wood: [p.wood, p.woodHi, p.woodDk],
    }[b.color];
    const pr = b.pressed ? 2 : 0;
    const y = b.y + pr;
    // outline + drop
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    ctx.fillStyle = cols[2];
    ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    // face
    ctx.fillStyle = cols[0];
    ctx.fillRect(b.x, y, b.w, b.h - 4 - pr + 2);
    ctx.fillStyle = cols[1];
    ctx.fillRect(b.x, y, b.w, 3);
    ctx.fillRect(b.x, y, 3, b.h - 6);
    if (b.disabled) {
      ctx.fillStyle = 'rgba(40,30,20,0.45)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    // content
    let tx = b.x + b.w / 2;
    const ty = y + (b.h - 4) / 2;
    if (b.icon) {
      const img = b.icon();
      const iw = img.width * 2, ih = img.height * 2;
      if (b.label) {
        const lw = measure(b.label, 2);
        const total = iw + 6 + lw;
        ctx.drawImage(img, Math.round(tx - total / 2), Math.round(ty - ih / 2), iw, ih);
        drawText(ctx, b.label, tx - total / 2 + iw + 6, ty - 5, 10, '#fff6e8', 'left', true);
      } else {
        ctx.drawImage(img, Math.round(tx - iw / 2), Math.round(ty - ih / 2), iw, ih);
      }
    } else if (b.label) {
      drawText(ctx, b.label, tx, ty - 5, 10, '#fff6e8', 'center', true);
    }
  }

  /** Small wooden sign with 1-2 lines (used on world map). */
  function woodSign(ctx, cx, cy, line1, line2, cost) {
    const w = Math.max(measure(line1, 2), line2 ? measure(line2, 1) : 0, cost ? measure(cost, 1) + 12 : 0) + 18;
    const h = 18 + (line2 ? 9 : 0) + (cost ? 11 : 0);
    woodPanel(ctx, cx - w / 2, cy, w, h, {});
    drawText(ctx, line1, cx, cy + 5, 10, '#f4e8cc', 'center', true);
    let yy = cy + 17;
    if (line2) { drawText(ctx, line2, cx, yy, 5, '#e0cfa8', 'center'); yy += 10; }
    if (cost) {
      const img = SPRITES.coin(1);
      const tw = measure(cost, 1);
      ctx.drawImage(img, cx - tw / 2 - 12, yy - 3, 10, 10);
      drawText(ctx, cost, cx - tw / 2, yy, 5, '#ffe98a', 'left');
    }
    // legs
    ctx.fillStyle = P().woodDk;
    ctx.fillRect(cx - w / 2 + 4, cy + h, 3, 5);
    ctx.fillRect(cx + w / 2 - 7, cy + h, 3, 5);
  }

  // ---------------- upgrade panel cards ----------------
  /**
   * One parchment card in the upgrade panel: label + level, stat lines with
   * next-level preview, BUY button + cost. Registers its hit rect on
   * popup.cards and applies the purchase flash from popup.fx.
   * Returns the card's bottom y.
   */
  function upgradeCard(ctx, popup, x, y, w, h, inf) {
    // parchment card
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#e8d8b4'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(x, y, w, 3);

    drawText(ctx, inf.label + ' LV ' + inf.level, x + 10, y + 9, 10, '#5c3a1d');
    let ly = y + 28;
    for (const line of inf.lines) { drawText(ctx, line, x + 10, ly, 5, '#7d5027'); ly += 12; }

    // buy button + cost tag
    const fx = popup.fx[inf.key] || 0;
    const bw = 58, bh = 26;
    const btn = { x: x + w - bw - 10, y: y + 9, w: bw, h: bh };
    const afford = SaveManager.data.coins >= inf.cost;
    drawButton(ctx, {
      ...btn, color: 'green',
      label: inf.maxed ? 'MAX' : 'BUY',
      disabled: inf.maxed || !afford,
      pressed: fx > 0.85,
    });
    if (!inf.maxed) {
      const cost = U.fmt(inf.cost);
      const tw = measure(cost, 1);
      const cx = btn.x + btn.w / 2;
      ctx.drawImage(SPRITES.coin(1), cx - tw / 2 - 12, btn.y + bh + 6, 10, 10);
      drawText(ctx, cost, cx - tw / 2, btn.y + bh + 8, 5, afford ? '#b8860b' : '#b0442f', 'left');
    }

    // purchase highlight flash
    if (fx > 0) {
      popup.fx[inf.key] = Math.max(0, fx - Game.dt * 2);
      ctx.globalAlpha = fx * 0.45;
      ctx.fillStyle = '#ffe98a';
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }

    popup.cards.push({ key: inf.key, btn });
    return y + h;
  }

  // sparkle particles drawn above the popup (VFXManager renders below it)
  let panelFx = [];
  function spawnPanelFx(x, y) {
    for (let i = 0; i < 12; i++) {
      panelFx.push({
        x: x + U.rand(-16, 16), y: y + U.rand(-8, 8),
        vx: U.rand(-30, 30), vy: U.rand(-70, -20),
        t: U.rand(0.35, 0.6), max: 0.6,
        col: U.pick(['#ffe98a', '#f4c437', '#fff6d0', '#ffffff']),
      });
    }
  }
  function drawPanelFx(ctx) {
    for (let i = panelFx.length - 1; i >= 0; i--) {
      const p = panelFx[i];
      p.t -= Game.dt;
      if (p.t <= 0) { panelFx.splice(i, 1); continue; }
      p.x += p.vx * Game.dt; p.y += p.vy * Game.dt;
      ctx.globalAlpha = Math.min(1, p.t / p.max * 2);
      ctx.fillStyle = p.col;
      const s = p.t > p.max * 0.5 ? 3 : 2;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- state ----------------
  let buttons = [];
  let popup = null;         // {type:'unlock'|'settings'|'confirm-reset', ...}
  let toast = null;         // {text, t}
  let displayedCoins = 0;
  let coinPulse = 0;

  const COIN_POS = { x: 30, y: 27 };
  function coinTarget() { return { x: COIN_POS.x, y: COIN_POS.y }; }

  function makeButtons() {
    const bw = 100, bh = 40, gap = 10, y = H - bh - 14;
    const total = bw * 3 + gap * 2;
    const x0 = (W - total) / 2;
    buttons = [
      { id: 'upgrade', color: 'green', x: x0, y, w: bw, h: bh, label: 'UPGRADE', icon: () => SPRITES.arrowUp(), scene: 'farm' },
      { id: 'unlock', color: 'gray', x: x0 + bw + gap, y, w: bw, h: bh, label: 'UNLOCK', icon: () => SPRITES.lock(), scene: 'farm' },
      { id: 'exit', color: 'red', x: x0 + (bw + gap) * 2, y, w: bw, h: bh, label: 'EXIT', icon: () => SPRITES.xIcon(), scene: 'farm' },
      { id: 'settings', color: 'wood', x: W - 46, y: 12, w: 34, h: 32, icon: () => SPRITES.gear(), scene: 'both' },
    ];
  }
  makeButtons();

  /** Red notification badge with a white "!", centered at (cx, cy). */
  function drawBadge(ctx, cx, cy) {
    const pulse = 1 + Math.sin(performance.now() / 220) * 0.08;
    const r = Math.round(8 * pulse);
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0453a';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#dd6a56';
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1, r - 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0453a';
    ctx.beginPath(); ctx.arc(cx, cy + 1, r - 2, 0, 7); ctx.fill();
    drawText(ctx, '!', cx, cy - 5, 10, '#fff6e8', 'center');
  }

  // ---------------- HUD ----------------
  function drawHUD(ctx, scene) {
    const p = P();
    // top bar backdrop
    ctx.fillStyle = 'rgba(26,20,14,0.35)';
    ctx.fillRect(0, 0, W, 56);

    // coin capsule
    displayedCoins = U.lerp(displayedCoins, SaveManager.data.coins, Math.min(1, CONFIG.COIN_COUNT_LERP * Game.dt));
    if (Math.abs(displayedCoins - SaveManager.data.coins) < 1) displayedCoins = SaveManager.data.coins;
    inset(ctx, 14, 12, 118, 30);
    const coinImg = SPRITES.coin(3);
    coinPulse = Math.max(0, coinPulse - Game.dt * 4);
    const cs = 26 + coinPulse * 8;
    ctx.drawImage(coinImg, COIN_POS.x - cs / 2, COIN_POS.y - cs / 2, cs, cs);
    drawText(ctx, U.fmt(displayedCoins), 48, 21, 10, '#fff6e8', 'left', false, true);

    // farm name plaque
    const name = scene === 'map' ? 'WORLD MAP' : CONFIG.FARMS[SaveManager.data.currentFarm].name;
    const nw = measure(name, 2) + 28;
    woodPanel(ctx, Math.round(W / 2 - nw / 2) + 20, 12, nw, 30, { gold: true });
    drawText(ctx, name, W / 2 + 20, 22, 10, '#f4e8cc', 'center', true);

    // buttons for this scene
    for (const b of buttons) {
      if (b.scene !== 'both' && b.scene !== scene) continue;
      drawButton(ctx, b);
      // red "!" badge on UPGRADE while an upgrade is affordable
      // (only after the first-upgrade tutorial has been completed)
      if (b.id === 'upgrade' && SaveManager.data.upgradeTutorialDone &&
          Upgrades.anyAffordable(SaveManager.data.currentFarm)) {
        drawBadge(ctx, b.x + b.w - 2, b.y - 2);
      }
    }

    // toast
    if (toast) {
      toast.t -= Game.dt;
      if (toast.t <= 0) toast = null;
      else {
        const a = Math.min(1, toast.t * 2);
        ctx.globalAlpha = a;
        const tw2 = measure(toast.text, 2) + 24;
        inset(ctx, W / 2 - tw2 / 2, 84, tw2, 22);
        drawText(ctx, toast.text, W / 2, 90, 10, '#ffb0a0', 'center');
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------------- discovery celebration popup ----------------
  /**
   * Full-screen celebration for a first-time evolution: golden frame around
   * big animal art, sparkles + confetti, name, stage, flavor and CONTINUE.
   */
  function drawDiscovery(ctx, px, py, pw, ph) {
    const p = P();
    popup.fxT += Game.dt;
    const t = popup.fxT;
    const cx = px + pw / 2;

    drawText(ctx, 'NEW EVOLUTION', cx, py - 2, 10, '#ffe98a', 'center', true);
    drawText(ctx, 'DISCOVERED!', cx, py + 22, 15, '#ffe98a', 'center', true);

    // golden frame
    const fs = 150, fx = cx - fs / 2, fy = py + 48;
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(fx - 4, fy - 4, fs + 8, fs + 8);
    ctx.fillStyle = p.gold;        ctx.fillRect(fx - 2, fy - 2, fs + 4, fs + 4);
    ctx.fillStyle = p.goldHi;      ctx.fillRect(fx - 2, fy - 2, fs + 4, 2);
    ctx.fillStyle = p.goldDk;      ctx.fillRect(fx - 2, fy + fs, fs + 4, 2);
    ctx.fillStyle = '#3a2c1c';     ctx.fillRect(fx + 2, fy + 2, fs - 4, fs - 4);
    // corner studs
    ctx.fillStyle = p.goldHi;
    for (const [sx, sy] of [[fx - 2, fy - 2], [fx + fs - 2, fy - 2], [fx - 2, fy + fs - 2], [fx + fs - 2, fy + fs - 2]]) {
      ctx.fillRect(sx, sy, 4, 4);
    }

    // magical glow behind the animal
    ctx.save();
    ctx.beginPath(); ctx.rect(fx + 2, fy + 2, fs - 4, fs - 4); ctx.clip();
    const pulse = 0.30 + Math.sin(t * 4) * 0.12;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath(); ctx.arc(cx, fy + fs / 2 + 8, 56, 0, 7); ctx.fill();
    ctx.globalAlpha = pulse * 0.7;
    ctx.beginPath(); ctx.arc(cx, fy + fs / 2 + 8, 34, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    // rotating god-rays
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#fff6d0';
    for (let i = 0; i < 6; i++) {
      const a = t * 0.6 + (i / 6) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, fy + fs / 2 + 8);
      ctx.rotate(a);
      ctx.fillRect(-7, -fs, 14, fs * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // the star of the show, gently bobbing
    const img = SPRITES.animal(popup.species, popup.stage, 'idle', false);
    const bob = Math.sin(t * 3) * 2;
    const sc = Math.min(3.4, (fs - 34) / img.height);
    PIXEL.blit(ctx, img, cx, fy + fs - 18 + bob, sc * Math.min(1, U.easeOutBack(Math.min(t * 2.5, 1))));
    // sparkles twinkling inside the frame
    ctx.fillStyle = '#fff6d0';
    for (let i = 0; i < 7; i++) {
      const tw = (Math.sin(t * 5 + i * 2.1) + 1) / 2;
      if (tw < 0.55) continue;
      const sx = fx + 12 + ((i * 47) % (fs - 24));
      const sy = fy + 12 + ((i * 71) % (fs - 24));
      const ss = tw > 0.8 ? 2 : 1;
      ctx.fillRect(sx - ss, sy, ss * 2 + 1, 1);
      ctx.fillRect(sx, sy - ss, 1, ss * 2 + 1);
    }
    ctx.restore();

    // name, stage, flavor
    drawText(ctx, Discovery.displayName(popup.species, popup.stage), cx, fy + fs + 14, 10, '#ffe98a', 'center', true);
    drawText(ctx, 'STAGE ' + (popup.stage + 1) + ' - ' + CONFIG.STAGE_NAMES[popup.stage], cx, fy + fs + 32, 5, '#f4e8cc', 'center');
    drawText(ctx, Discovery.flavor(popup.species, popup.stage), cx, fy + fs + 46, 5, '#e0cfa8', 'center');

    // CONTINUE
    popup.okRect = { x: px + 50, y: py + ph - 56, w: pw - 100, h: 40 };
    drawButton(ctx, { ...popup.okRect, color: 'green', label: 'CONTINUE' });

    // confetti raining over the whole popup
    if (popup.confetti.length < 60 && Math.random() < 0.5) {
      popup.confetti.push({
        x: px + Math.random() * pw, y: py - 14,
        vx: U.rand(-14, 14), vy: U.rand(36, 70),
        sway: Math.random() * Math.PI * 2,
        col: U.pick(['#ffe98a', '#f4c437', '#dd6a56', '#7dbb4a', '#a07cc0', '#7ec8e0']),
        s: U.randInt(2, 4),
      });
    }
    for (let i = popup.confetti.length - 1; i >= 0; i--) {
      const c = popup.confetti[i];
      c.sway += Game.dt * 4;
      c.x += (c.vx + Math.sin(c.sway) * 16) * Game.dt;
      c.y += c.vy * Game.dt;
      if (c.y > py + ph + 10) { popup.confetti.splice(i, 1); continue; }
      ctx.fillStyle = c.col;
      const wob = Math.abs(Math.sin(c.sway));
      ctx.fillRect(Math.round(c.x), Math.round(c.y), c.s, Math.max(1, Math.round(c.s * wob)));
    }
  }

  // ---------------- popups ----------------
  function drawPopup(ctx) {
    if (!popup) return;
    ctx.fillStyle = popup.type === 'discovery' ? 'rgba(16,10,6,0.75)' : 'rgba(16,10,6,0.55)';
    ctx.fillRect(0, 0, W, H);

    const pw = popup.type === 'upgrades' ? 324 : popup.type === 'discovery' ? 280 : 240;
    const ph = popup.type === 'upgrades' ? 470
             : popup.type === 'discovery' ? 344
             : popup.type === 'unlock' ? 210 : 190;
    const px = (W - pw) / 2, py = (H - ph) / 2 - 20;
    popup.rect = { x: px, y: py, w: pw, h: ph };
    woodPanel(ctx, px, py, pw, ph, { gold: true });
    // title bar
    woodPanel(ctx, px + 10, py - 10, pw - 20, 26, { dark: true });

    // close X (discovery must be dismissed with CONTINUE)
    if (popup.type === 'discovery') {
      popup.closeRect = null;
    } else {
      popup.closeRect = { x: px + pw - 16, y: py - 16, w: 28, h: 26 };
      drawButton(ctx, { ...popup.closeRect, color: 'red', icon: () => SPRITES.xIcon(), pressed: false });
    }

    if (popup.type === 'unlock') {
      const f = CONFIG.FARMS[popup.farmId];
      drawText(ctx, 'UNLOCK ' + f.name, px + pw / 2, py - 2, 10, '#ffe98a', 'center', true);
      // inner parchment card
      ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 28, pw - 36, 104);
      ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 30, pw - 40, 100);
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 30, pw - 40, 3);
      // animal preview
      const img = SPRITES.animal(f.species, 1, 'idle', false);
      PIXEL.blit(ctx, img, px + 58, py + 116, 2.6);
      drawText(ctx, f.label.replace(/S$/, '') + ' FARM', px + 144, py + 48, 10, '#5c3a1d', 'center');
      drawText(ctx, 'UNLOCK COST:', px + 144, py + 72, 5, '#7d5027', 'center');
      const cost = U.fmt(CONFIG.UNLOCK_COSTS[popup.farmId]);
      const cw = measure(cost, 2);
      ctx.drawImage(SPRITES.coin(2), px + 144 - cw / 2 - 20, py + 84, 16, 16);
      drawText(ctx, cost, px + 144 - cw / 2, py + 88, 10, '#b8860b', 'left');
      // unlock button
      const can = SaveManager.data.coins >= CONFIG.UNLOCK_COSTS[popup.farmId];
      popup.okRect = { x: px + 40, y: py + ph - 60, w: pw - 80, h: 40 };
      drawButton(ctx, { ...popup.okRect, color: 'green', label: 'UNLOCK', disabled: !can });
    } else if (popup.type === 'upgrades') {
      const f = CONFIG.FARMS[popup.farmId];
      drawText(ctx, f.name + ' UPGRADES', px + pw / 2, py - 2, 10, '#ffe98a', 'center', true);
      popup.cards = [];
      let yy = py + 20;
      drawText(ctx, 'FARM', px + 14, yy, 5, '#e0cfa8'); yy += 12;
      yy = upgradeCard(ctx, popup, px + 12, yy, pw - 24, 62, Upgrades.info(popup.farmId, 'spawn')) + 10;
      drawText(ctx, f.label, px + 14, yy, 5, '#e0cfa8'); yy += 12;
      for (let s = 0; s < CONFIG.UPGRADES.STAGES.length; s++) {
        yy = upgradeCard(ctx, popup, px + 12, yy, pw - 24, 78, Upgrades.info(popup.farmId, s)) + 8;
      }
      drawPanelFx(ctx);
    } else if (popup.type === 'discovery') {
      drawDiscovery(ctx, px, py, pw, ph);
    } else if (popup.type === 'settings') {
      drawText(ctx, 'SETTINGS', px + pw / 2, py - 2, 10, '#ffe98a', 'center', true);
      popup.musicRect = { x: px + 30, y: py + 34, w: pw - 60, h: 34 };
      popup.sfxRect = { x: px + 30, y: py + 78, w: pw - 60, h: 34 };
      popup.resetRect = { x: px + 30, y: py + 128, w: pw - 60, h: 34 };
      drawButton(ctx, { ...popup.musicRect, color: 'wood', label: 'MUSIC: ' + (AudioManager.musicOn ? 'ON' : 'OFF') });
      drawButton(ctx, { ...popup.sfxRect, color: 'wood', label: 'SOUND: ' + (AudioManager.sfxOn ? 'ON' : 'OFF') });
      drawButton(ctx, { ...popup.resetRect, color: 'red', label: 'RESET SAVE' });
    } else if (popup.type === 'confirm-reset') {
      drawText(ctx, 'RESET GAME?', px + pw / 2, py - 2, 10, '#ffe98a', 'center', true);
      drawText(ctx, 'ALL PROGRESS WILL', px + pw / 2, py + 44, 5, '#f4e8cc', 'center');
      drawText(ctx, 'BE LOST!', px + pw / 2, py + 56, 5, '#f4e8cc', 'center');
      popup.okRect = { x: px + 30, y: py + 84, w: pw - 60, h: 36 };
      popup.cancelRect = { x: px + 30, y: py + 130, w: pw - 60, h: 36 };
      drawButton(ctx, { ...popup.okRect, color: 'red', label: 'YES, RESET' });
      drawButton(ctx, { ...popup.cancelRect, color: 'gray', label: 'CANCEL' });
    }
  }

  function inRect(x, y, r) { return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  // ---------------- first-upgrade tutorial overlay ----------------
  /** Pixel-style pointing hand, fingertip at (x, y). */
  function drawHand(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#2b2116';
    ctx.fillRect(-3, -2, 8, 14);   // finger outline
    ctx.fillRect(-7, 8, 16, 10);   // palm outline
    ctx.fillStyle = '#fff4e0';
    ctx.fillRect(-2, -1, 6, 12);   // finger
    ctx.fillRect(-6, 9, 14, 8);    // palm
    ctx.restore();
  }

  /**
   * Spotlight for the first-upgrade tutorial: pulsing glow + hand + label on
   * the UPGRADE button, then on the cheapest affordable BUY button inside
   * the upgrade panel. Drawn above HUD and popup.
   */
  function drawUpgradeTutorial(ctx, t) {
    let target = null, label = null;
    if (!popup) {
      target = buttons.find(b => b.id === 'upgrade');
      label = 'UPGRADE YOUR FARM!';
    } else if (popup.type === 'upgrades') {
      let best = Infinity;
      for (const c of popup.cards || []) {
        const inf = Upgrades.info(popup.farmId, c.key);
        if (!inf.maxed && SaveManager.data.coins >= inf.cost && inf.cost < best) {
          best = inf.cost;
          target = c.btn;
        }
      }
      label = 'TAP BUY!';
    }
    if (!target) return;

    // pulsing golden glow around the target
    const pulse = (Math.sin(t * 6) + 1) / 2;
    const g = 4 + pulse * 4;
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.strokeStyle = '#ffe98a';
    ctx.lineWidth = 3;
    ctx.strokeRect(target.x - g, target.y - g, target.w + g * 2, target.h + g * 2);
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = '#ffe98a';
    ctx.fillRect(target.x - 2, target.y - 2, target.w + 4, target.h + 4);
    ctx.restore();

    // bobbing hand pointing at the target
    drawHand(ctx, target.x + target.w / 2 + 10, target.y + target.h / 2 + 8 + Math.sin(t * 4) * 4);

    // instruction label (kept fully on screen)
    const lw = measure(label, 2);
    const lx = U.clamp(target.x + target.w / 2, lw / 2 + 6, W - lw / 2 - 6);
    drawText(ctx, label, lx, target.y - g - 22, 10, '#ffe98a', 'center', true);
  }

  /** Returns true if the tap was consumed by UI. */
  function tap(x, y) {
    if (popup) {
      if (inRect(x, y, popup.closeRect)) {
        if (Game.upgradeTutorialActive) return true; // tutorial: must buy before closing
        AudioManager.play('click'); popup = null; panelFx = []; return true;
      }
      if (popup.type === 'upgrades') {
        for (const c of popup.cards || []) {
          if (inRect(x, y, c.btn)) {
            const r = Upgrades.buy(popup.farmId, c.key);
            if (r.ok) {
              AudioManager.play('buy');
              popup.fx[c.key] = 1;
              spawnPanelFx(c.btn.x + c.btn.w / 2, c.btn.y + c.btn.h / 2);
              Game.onUpgradePurchased();
            } else {
              AudioManager.play('error');
              toast = { text: r.reason, t: 1.6 };
            }
            return true;
          }
        }
        return true;
      }
      if (popup.type === 'discovery') {
        if (inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          popup = null;
          Game.endCelebration();
        }
        return true; // no other way out — gameplay stays paused until CONTINUE
      }
      if (popup.type === 'unlock' && inRect(x, y, popup.okRect)) {
        Game.tryUnlock(popup.farmId);
        return true;
      }
      if (popup.type === 'settings') {
        if (inRect(x, y, popup.musicRect)) { AudioManager.setMusic(!AudioManager.musicOn); SaveManager.data.settings.music = AudioManager.musicOn; SaveManager.save(); AudioManager.play('click'); return true; }
        if (inRect(x, y, popup.sfxRect)) { AudioManager.setSfx(!AudioManager.sfxOn); SaveManager.data.settings.sfx = AudioManager.sfxOn; SaveManager.save(); AudioManager.play('click'); return true; }
        if (inRect(x, y, popup.resetRect)) { AudioManager.play('click'); popup = { type: 'confirm-reset' }; return true; }
      }
      if (popup.type === 'confirm-reset') {
        if (inRect(x, y, popup.okRect)) { AudioManager.play('click'); popup = null; Game.resetAll(); return true; }
        if (inRect(x, y, popup.cancelRect)) { AudioManager.play('click'); popup = null; return true; }
      }
      return true; // modal swallows all taps
    }
    for (const b of buttons) {
      if (b.scene !== 'both' && b.scene !== Game.scene) continue;
      if (Game.upgradeTutorialActive && b.id !== 'upgrade') continue; // tutorial: only UPGRADE works
      if (inRect(x, y, b)) {
        AudioManager.play('click');
        Game.onButton(b.id);
        return true;
      }
    }
    return false;
  }

  // ---------------- loading screen ----------------
  function drawLoading(ctx, t) {
    ctx.fillStyle = '#2e2416';
    ctx.fillRect(0, 0, W, H);
    // decorative fence strip
    const f = SPRITES.fenceH(24);
    for (let x = 0; x < W; x += 44) ctx.drawImage(f, x, H / 2 + 60, 44, 26);
    drawText(ctx, 'FARM EVOLUTION', W / 2, H / 2 - 60, 15, '#ffe98a', 'center', true);
    const img = SPRITES.animal('chicken', 1, (t * 3 | 0) % 2 ? 'walk' : 'idle');
    PIXEL.blit(ctx, img, W / 2, H / 2 + 30, 3);
    const dots = '.'.repeat(1 + ((t * 2) | 0) % 3);
    drawText(ctx, 'TAP TO START' , W / 2, H / 2 + 100, 10, '#f4e8cc', 'center', true);
    drawText(ctx, 'LOADING' + dots, W / 2, H / 2 + 124, 5, '#c8b088', 'center');
  }

  return {
    drawText, measure, woodPanel, woodSign, drawButton, drawHUD, drawPopup, drawLoading,
    drawHand, drawUpgradeTutorial,
    tap, coinTarget,
    pulseCoin() { coinPulse = 1; },
    showToast(text) { toast = { text, t: 1.6 }; },
    openPopup(p) { popup = p; },
    closePopup() { popup = null; panelFx = []; },
    get popup() { return popup; },
    syncCoins() { displayedCoins = SaveManager.data.coins; },
  };
})();
