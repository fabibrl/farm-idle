/**
 * UIManager — HUD, buttons, popups and wooden panels. All typography
 * renders through the global 'pixel-art-font' engine (js/font.js).
 */
const UI = (() => {
  const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
  const P = () => SPRITES.P;

  // ---------------- typography ('pixel-art-font') ----------------
  // SIZE is the hierarchy scale (TITLE 20 / SUBTITLE 15 / BUTTON+BODY 10 /
  // CAPTION 5). drawText/measure keep the historical signature so every
  // module (farm, ufo, pigeon, tornado, vfx) shares this one text path.
  const SIZE = PixelFont.SIZE;

  function measure(text, size) { return PixelFont.measure(text, size); }

  function drawText(ctx, text, x, y, size = SIZE.BODY, col = '#fff', align = 'left', outline = false, shadow = false, maxWidth = 0) {
    return PixelFont.draw(ctx, text, x, y, size, col, align, outline, shadow, maxWidth);
  }

  /**
   * Popup title bar + centered title, geometry from Figma E04 (19:72/19:78):
   * outline at (px+8, py-15) w pw-16 h 33, dark wood face, 3.5px bevels,
   * seam at py+0.5; title 13px #ffe98a with em-top at py-5.
   */
  function popupTitle(ctx, text, px, py, pw, opts = {}) {
    const p = P();
    // E04's bar (19:72) is 33 tall with 3.5px bevels; the others (20:70 etc.)
    // use the 30-tall bar with 3px bevels
    const tall = !!opts.tall;
    const bt = tall ? py - 15 : py - 12;      // outline top
    const bh = tall ? 33 : 30;
    const ft = bt + 2, fh = bh - 4;           // face
    const bev = tall ? 3.5 : 3;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(px + 8, bt, pw - 16, bh);
    ctx.fillStyle = p.woodDk;
    ctx.fillRect(px + 10, ft, pw - 20, fh);
    ctx.fillStyle = p.wood;
    ctx.fillRect(px + 10, ft, pw - 20, bev);
    ctx.fillStyle = p.woodDkr;
    ctx.fillRect(px + 10, ft + fh - bev, pw - 20, bev);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(px + 10, ft + fh / 2 - 1, pw - 20, 1);
    const maxW = pw - 76;
    const base = opts.size || 13;
    const ts = PixelFont.fit(text, base, maxW);
    const top = opts.top !== undefined ? opts.top : (tall ? py - 5 : py - 3);
    drawText(ctx, text, px + pw / 2, top + (base - ts) / 2, ts, '#ffe98a', 'center', false, false, maxW);
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
    if (opts.seams !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let py = y + 12; py < y + h - 6; py += 14) ctx.fillRect(x, py, w, 1);
    }
    // wood grain flecks (Figma panels without them pass flecks: false)
    if (opts.flecks !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < w * h / 260; i++) {
        ctx.fillRect(x + ((i * 53) % (w - 8)) + 4, y + ((i * 37) % (h - 10)) + 5, 4, 1);
      }
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

  /**
   * Figma upgrade-button component (46:67, "Upgrades — States" page):
   * seven `state` variants sharing one geometry — only fills, opacity,
   * icons and label change. All values are Figma px / 2, offsets relative
   * to the outer rect (b.x-2, b.y-2).
   */
  const BTN_STATES = {
    'default':   { face: '#5e9c31', bevel: '#7dbb4a', drop: '#41701f' },
    'pressed':   { face: '#41701f', bevel: '#5e9c31', drop: '#41701f' },
    'disabled':  { face: '#8c8678', bevel: '#aaa596', drop: '#635e52', dim: true },
    'max-level': { face: '#f4c437', bevel: '#ffe98a', drop: '#c88f1e', label: 'MAX', labelCol: '#5c3a1d' },
    'locked':    { face: '#7d5027', bevel: '#a9743f', drop: '#5c3a1d', labelCol: '#e0cfa8' },
    'ad-unlock': { face: '#5e9c31', bevel: '#7dbb4a', drop: '#41701f', label: 'WATCH AD', labelCx: 55.5 },
    'loading':   { face: '#8c8678', bevel: '#aaa596', drop: '#635e52', dim: true, label: 'LOADING', labelCol: '#e0cfa8', labelCx: 54.5 },
  };

  function drawStateButton(ctx, b) {
    const st = BTN_STATES[b.state];
    const ox = b.x - 2, oy = b.y - 2;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(ox, oy, b.w + 4, b.h + 4);
    ctx.fillStyle = st.drop;
    ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    ctx.fillStyle = st.face;
    ctx.fillRect(b.x, b.y, b.w, b.h - 2);
    ctx.fillStyle = st.bevel;
    ctx.fillRect(b.x, b.y, b.w, 3);
    ctx.fillRect(b.x, b.y, 3, b.h - 6);
    if (b.state === 'locked') {
      // pixel lock (cream/300) + face-colored keyhole
      ctx.fillStyle = '#e0cfa8';
      ctx.fillRect(ox + 13.5, oy + 9.5, 2, 4);
      ctx.fillRect(ox + 19.5, oy + 9.5, 2, 4);
      ctx.fillRect(ox + 13.5, oy + 7.5, 8, 2);
      ctx.fillRect(ox + 11.5, oy + 13.5, 12, 9);
      ctx.fillStyle = st.face;
      ctx.fillRect(ox + 16.5, oy + 16.5, 2, 3);
    } else if (b.state === 'ad-unlock') {
      // play plate + stepped triangle
      ctx.fillStyle = PIXEL.OUTLINE;
      ctx.fillRect(ox + 6.5, oy + 11, 12, 10);
      ctx.fillStyle = '#fff6e8';
      ctx.fillRect(ox + 10, oy + 13, 2, 6);
      ctx.fillRect(ox + 12, oy + 14, 2, 4);
      ctx.fillRect(ox + 14, oy + 15, 2, 2);
    }
    if (st.dim) {
      ctx.fillStyle = 'rgba(40,30,20,0.45)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    if (b.state === 'loading') {
      // 4-dot pixel spinner, stepped opacity, rotating with time
      const step = Math.floor(performance.now() / 150) % 4;
      const dots = [[13.5, 10.5], [17.5, 14.5], [13.5, 18.5], [9.5, 14.5]];
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = [1, 0.7, 0.45, 0.2][(i - step + 4) % 4];
        ctx.fillStyle = '#fff6e8';
        ctx.fillRect(ox + dots[i][0], oy + dots[i][1], 3, 3);
      }
      ctx.globalAlpha = 1;
    }
    const label = st.label !== undefined ? st.label : b.label;
    if (label) {
      drawText(ctx, label, ox + (st.labelCx || 50), oy + 11.75, 8.5, st.labelCol || '#fff6e8', 'center', false, false, 92);
    }
  }

  /** Colored button (green/gray/red) with bevel + icon + label. */
  function drawButton(ctx, b) {
    if (b.state) { drawStateButton(ctx, b); return; }
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
    if (b.layout) {
      // exact icon/label placement from Figma (offsets from the outer rect)
      const ox = b.x - 2, oy = b.y - 2 + pr;
      if (b.icon) {
        const img = b.icon();
        ctx.drawImage(img, ox + b.layout.iconX, oy + b.layout.iconY, b.layout.iconW, b.layout.iconH);
      }
      if (b.label) {
        if (b.layout.center) {
          drawText(ctx, b.label, b.x + b.w / 2, oy + b.layout.labelY, b.layout.labelPx, '#fff6e8', 'center');
        } else {
          drawText(ctx, b.label, ox + b.layout.labelX, oy + b.layout.labelY, b.layout.labelPx, '#fff6e8', 'left');
        }
      }
      return;
    }
    let tx = b.x + b.w / 2;
    const ty = y + (b.h - 4) / 2;
    if (b.icon) {
      const img = b.icon();
      const isc = b.iconScale || 2;
      const iw = img.width * isc, ih = img.height * isc;
      if (b.label) {
        const availW = b.w - iw - 8;
        const fs = PixelFont.fit(b.label, b.labelSize || SIZE.BUTTON, availW);
        const lw = Math.min(measure(b.label, fs), availW);
        const total = iw + 6 + lw;
        ctx.drawImage(img, Math.round(tx - total / 2), Math.round(ty - ih / 2), iw, ih);
        drawText(ctx, b.label, tx - total / 2 + iw + 6, ty - fs / 2, fs, '#fff6e8', 'left', true, false, availW);
      } else {
        ctx.drawImage(img, Math.round(tx - iw / 2), Math.round(ty - ih / 2), iw, ih);
      }
    } else if (b.label) {
      const availW = b.w - 8;
      const fs = PixelFont.fit(b.label, b.labelSize || SIZE.BUTTON, availW);
      drawText(ctx, b.label, tx, ty - fs / 2, fs, '#fff6e8', 'center', true, false, availW);
    }
  }

  /** Small wooden sign with 1-2 lines (used on world map). */
  function woodSign(ctx, cx, cy, line1, line2, cost) {
    const w = Math.max(measure(line1, SIZE.BUTTON), line2 ? measure(line2, SIZE.CAPTION) : 0,
                       cost ? measure(cost, SIZE.CAPTION) + 12 : 0) + 18;
    const h = 18 + (line2 ? 9 : 0) + (cost ? 11 : 0);
    woodPanel(ctx, cx - w / 2, cy, w, h, {});
    drawText(ctx, line1, cx, cy + 5, SIZE.BUTTON, '#f4e8cc', 'center', true);
    let yy = cy + 17;
    if (line2) { drawText(ctx, line2, cx, yy, SIZE.CAPTION, '#e0cfa8', 'center'); yy += 10; }
    if (cost) {
      const img = SPRITES.coin(1);
      const tw = measure(cost, SIZE.CAPTION);
      ctx.drawImage(img, cx - tw / 2 - 12, yy - 3, 10, 10);
      drawText(ctx, cost, cx - tw / 2, yy, SIZE.CAPTION, '#ffe98a', 'left');
    }
    // legs
    ctx.fillStyle = P().woodDk;
    ctx.fillRect(cx - w / 2 + 4, cy + h, 3, 5);
    ctx.fillRect(cx + w / 2 - 7, cy + h, 3, 5);
  }

  // ---------------- upgrade panel cards ----------------
  /**
   * One parchment card in the upgrade panel, laid out COST > BENEFIT > ACTION:
   * the right column leads with a big coin+cost (gold when affordable, red
   * with a NEED hint when not) above the UPGRADE button; the left column has
   * the upgrade name and per-stat "cur > next" improvement rows. Registers
   * its hit rect on popup.cards and applies the purchase flash from popup.fx.
   * Returns the card's bottom y.
   */
  function upgradeCard(ctx, popup, x, y, w, h, inf) {
    // parchment card (x,y,w,h = inner face rect; all values Figma E04 / 2)
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#e8d8b4'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(x, y, w, 3);

    const afford = !inf.maxed && SaveManager.data.coins >= inf.cost;
    const spawn = h === 76;   // the shorter spawn-speed card has its own offsets

    // ---- right column: cost (coin 19:90, text 19:91), UPGRADE button (19:93) ----
    if (!inf.maxed) {
      const costTxt = U.fmt(inf.cost);
      const costSize = PixelFont.fit(costTxt, 13, 51);
      ctx.drawImage(SPRITES.coin(2), x + (spawn ? 196 : 195.5), y + (spawn ? 12.5 : 18.5), 16, 16);
      drawText(ctx, costTxt, x + (spawn ? 216 : 215.5), y + (spawn ? 14.5 : 20.5) + (13 - costSize) / 2,
               costSize, afford ? '#58972a' : '#b0442f', 'left');
    }
    const fx = popup.fx[inf.key] || 0;
    const btn = { x: x + 200, y: y + (spawn ? 40 : 52), w: 96, h: 28 };
    // state mapping per the Figma upgrade-button component (46:67)
    const state = inf.maxed ? 'max-level'
                : fx > 0.85 ? 'pressed'
                : afford ? 'default' : 'disabled';
    drawButton(ctx, { ...btn, state, label: 'UPGRADE' });

    // ---- left column: name, then per-stat label line + "cur > next" line ----
    const textW = 190;
    drawText(ctx, inf.label + ' LV ' + inf.level, x + 10, y + (spawn ? 8.75 : 8), spawn ? 8.5 : 10, '#000000', 'left', false, false, textW);
    let ly = y + (spawn ? 27.75 : 29.25);
    const ox = x - 2;   // Figma offsets in the cards are relative to the outer rect
    let row = 0;
    for (const st of inf.stats) {
      drawText(ctx, st.name, x + 10, ly, 6.5, '#8a6a3c');
      const vy = ly + (!spawn && row === 0 ? 9.5 : 10);
      drawText(ctx, st.cur, ox + 12, vy, 8.5, '#7d5027');
      if (st.next && st.next !== st.cur) {
        let vx = Math.ceil((12 + measure(st.cur, 8.5) + 4) / 2) * 2;
        drawText(ctx, '>', ox + vx, vy, 8.5, '#4a8f2c');
        vx = Math.ceil((vx + measure('>', 8.5) + 2) / 2) * 2;
        drawText(ctx, st.next, ox + vx, vy, 8.5, '#3f7d1e');
      }
      ly += 29.5;
      row++;
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
    // rects and icon/label placement from Figma E03 (14:29), Figma px / 2
    buttons = [
      { id: 'upgrade', color: 'green', x: 75, y: 586, w: 100, h: 40, label: 'UPGRADE', icon: () => SPRITES.arrowUp(), scene: 'farm',
        layout: { iconX: 5, iconY: 8, iconW: 24, iconH: 24, labelX: 30.5, labelY: 17, labelPx: 10 } },
      { id: 'map', color: 'red', x: 185, y: 586, w: 100, h: 40, label: 'MAP', icon: () => SPRITES.mapPin(), scene: 'farm',
        layout: { iconX: 11.5, iconY: 7, iconW: 24, iconH: 30, labelX: 48, labelY: 15, labelPx: 12 } },
      { id: 'settings', color: 'wood', x: 314, y: 12, w: 34, h: 32, icon: () => SPRITES.gear(), scene: 'both',
        layout: { iconX: 5.5, iconY: 3.5, iconW: 27, iconH: 27 } },
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
    drawText(ctx, '!', cx, cy - 5, SIZE.BODY, '#fff6e8', 'center');
  }

  // ---------------- HUD ----------------
  function drawHUD(ctx, scene) {
    const p = P();
    // top bar backdrop (Figma 30:3 — rgba(26,20,14,0.5), h 112/2)
    ctx.fillStyle = 'rgba(26,20,14,0.5)';
    ctx.fillRect(0, 0, W, 56);

    // coin capsule
    displayedCoins = U.lerp(displayedCoins, SaveManager.data.coins, Math.min(1, CONFIG.COIN_COUNT_LERP * Game.dt));
    if (Math.abs(displayedCoins - SaveManager.data.coins) < 1) displayedCoins = SaveManager.data.coins;
    inset(ctx, 14, 12, 118, 30);
    const coinImg = SPRITES.coin(3);
    coinPulse = Math.max(0, coinPulse - Game.dt * 4);
    const cs = 26 + coinPulse * 8;
    ctx.drawImage(coinImg, COIN_POS.x - cs / 2, COIN_POS.y - cs / 2, cs, cs);
    drawText(ctx, U.fmt(displayedCoins), 48, 21, 12, '#fff6e8', 'left', false, false, 78);

    // name plaque — fixed rects from Figma (farm 18:23, map 17:11)
    if (scene === 'map') {
      woodPanel(ctx, 142, 12, 116, 30, { gold: true, flecks: false });
      drawText(ctx, 'WORLD MAP', 201, 22, 10, '#f4e8cc', 'center', false, false, 112);
    } else {
      woodPanel(ctx, 146, 12, 109, 30, { gold: true, flecks: false });
      drawText(ctx, CONFIG.FARMS[SaveManager.data.currentFarm].name, 200, 21, 13, '#f4e8cc', 'center', false, false, 105);
    }

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
        const tt = PixelFont.truncate(toast.text, SIZE.BODY, W - 52);
        const tw2 = measure(tt, SIZE.BODY) + 24;
        inset(ctx, W / 2 - tw2 / 2, 84, tw2, 22);
        drawText(ctx, tt, W / 2, 90, SIZE.BODY, '#ffb0a0', 'center');
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

    popupTitle(ctx, 'NEW EVOLUTION', px, py, pw);
    drawText(ctx, 'DISCOVERED!', cx, py + 48, 16, '#ffe98a', 'center', false, false, pw - 24);

    // golden frame (22:33: outer 158px at 101, py+69.5)
    const fs = 150, fx = cx - fs / 2, fy = py + 73.5;
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
    const sc = Math.min(3, (fs - 34) / img.height);
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

    // flavor first (white, 30:106), then the name below it (22:20)
    PixelFont.drawWrapped(ctx, Discovery.flavor(popup.species, popup.stage), cx, py + 230.75, 5.5, '#ffffff', 'center', pw - 28, 2);
    drawText(ctx, Discovery.displayName(popup.species, popup.stage), cx, py + 257.5, 12, '#ffe98a', 'center', false, false, pw - 24);

    // CONTINUE
    popup.okRect = { x: px + 50, y: py + ph - 56, w: pw - 100, h: 40 };
    drawButton(ctx, { ...popup.okRect, color: 'green', label: 'CONTINUE', layout: { labelY: 19, labelPx: 10, center: true } });

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

  // ---------------- welcome-back popup ----------------
  /**
   * Layout numbers for the welcome-back popup. The per-farm breakdown only
   * appears when 2+ farms actually earned something; the panel height grows
   * with the rows and the cap note.
   */
  function welcomeMetrics() {
    // fixed geometry from Figma E08 (23:4/23:31)
    return { cardH: 122, ph: 256 };
  }

  function drawWelcome(ctx, px, py, pw) {
    const rep = popup.rep;
    const total = Math.floor(rep.total);
    popupTitle(ctx, 'WELCOME BACK!', px, py, pw, { size: 8.5, top: py - 1.25 });
    // parchment card (23:31)
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 24, pw - 36, 126);
    ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 26, pw - 40, 122);
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 26, pw - 40, 3);
    const cx = px + pw / 2;
    drawText(ctx, 'YOU WERE AWAY FOR', cx, py + 37.75, 6.5, '#7d5027', 'center');
    drawText(ctx, U.fmtDur(rep.awaySec), cx, py + 51.25, 8.5, '#000000', 'center');
    // total earned while away — big and black, coin at a fixed spot (23:43/23:44)
    ctx.drawImage(SPRITES.coin(2), px + 48, py + 84, 21.5, 21.5);
    drawText(ctx, '+' + U.fmt(total), px + 130.5, py + 86.5, 16, '#000000', 'center', false, false, 122);
    PixelFont.drawWrapped(ctx, 'WHILE YOU WERE AWAY, THE FARMS WERE PRODUCTIVE.', cx, py + 131.5, 4, '#7d5027', 'center', 131.5, 2);
    // primary collect + secondary rewarded-ad 2x (play icon + coin + amount)
    popup.okRect = { x: px + 30, y: py + 158, w: pw - 60, h: 40 };
    popup.adRect = { x: px + 30, y: py + 206, w: pw - 60, h: 34 };
    drawButton(ctx, { ...popup.okRect, color: 'green', label: 'COLLECT', layout: { labelY: 19, labelPx: 10, center: true } });
    drawButton(ctx, { ...popup.adRect, color: 'wood' });
    ctx.drawImage(SPRITES.adPlay(), px + 39.5, py + 212, 32, 24);
    ctx.drawImage(SPRITES.coin(2), px + 85, py + 216.5, 14.5, 14.5);
    drawText(ctx, U.fmt(total * 2), px + 104, py + 219, 10, '#fff6e8', 'left', false, false, 64);
  }

  // ---------------- popups ----------------
  function drawPopup(ctx) {
    if (!popup) return;

    // simulated reward ad: full-screen placeholder, auto-completes
    if (popup.type === 'adPlaying') {
      popup.t += Game.dt;
      ctx.fillStyle = 'rgba(8,8,12,0.94)';
      ctx.fillRect(0, 0, W, H);
      // values from Figma E11 (25:56..25:67), Figma px / 2
      drawText(ctx, 'REWARD AD', W / 2, 237.5, SIZE.TITLE, '#fff6e8', 'center');
      drawText(ctx, 'SIMULATED AD PLACEHOLDER', W / 2, 268.25, 4.5, '#8c8678', 'center');
      // silly ad: pigeon on a bombing run across the screen
      const t = Math.min(popup.t / popup.dur, 1);
      const bx = U.lerp(40, W - 40, t);
      const by = H / 2 + 4 + Math.sin(popup.t * 6) * 6;
      const frame = Math.floor(popup.t * 10) % 2 ? 'flapUp' : 'flapDn';
      PIXEL.blit(ctx, SPRITES.poop(0), bx - 14, by + 26 + Math.sin(popup.t * 3) * 8, 2);
      PIXEL.blit(ctx, SPRITES.pigeon(frame, false), bx, by, 3);
      // progress bar
      inset(ctx, W / 2 - 80, H / 2 + 60, 160, 14);
      ctx.fillStyle = '#7dbb4a';
      ctx.fillRect(W / 2 - 78, H / 2 + 62, Math.max(0, Math.round(156 * t)), 10);
      drawText(ctx, 'REWARD IN ' + Math.ceil(popup.dur - popup.t) + 'S', W / 2, 408.25, 4.5, '#c8b088', 'center');
      if (popup.t >= popup.dur) { const done = popup.onDone; popup = null; done(); }
      return;
    }

    ctx.fillStyle = popup.type === 'discovery' ? 'rgba(16,10,6,0.75)' : 'rgba(16,10,6,0.55)';
    ctx.fillRect(0, 0, W, H);

    const pw = popup.type === 'upgrades' ? 324 : popup.type === 'discovery' ? 280 : 240;
    const ph = popup.type === 'upgrades' ? 528
             : popup.type === 'discovery' ? 344
             : popup.type === 'unlock' ? 210
             : popup.type === 'pigeonAd' ? 254
             : popup.type === 'tornadoAd' ? 270.5
             : popup.type === 'welcomeBack' ? welcomeMetrics(popup.rep).ph : 190;
    // upgrades panel sits lower so the HUD coin counter stays visible;
    // the tornado panel sits higher than the centering formula (Figma 25:4)
    const px = (W - pw) / 2;
    const py = popup.type === 'tornadoAd' ? 152
             : (H - ph) / 2 - (popup.type === 'upgrades' ? 0 : 20);
    popup.rect = { x: px, y: py, w: pw, h: ph };
    // Figma: only the confirm-reset panel (21:4) shows plank seams
    woodPanel(ctx, px, py, pw, ph, { gold: true, flecks: false, seams: popup.type === 'confirm-reset' });

    // close X (discovery must be dismissed with CONTINUE); drawn after the
    // branch so the title bar never paints over it
    popup.closeRect = popup.type === 'discovery' ? null
      : { x: px + pw - 16, y: py - 16, w: 28, h: 26 };

    if (popup.type === 'unlock') {
      const f = CONFIG.FARMS[popup.farmId];
      // values from Figma E12 (26:2..26:47), Figma px / 2
      popupTitle(ctx, 'UNLOCK ' + f.name, px, py, pw, { size: 10, top: py - 2 });
      // inner parchment card
      ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 28, pw - 36, 104);
      ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 30, pw - 40, 100);
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 30, pw - 40, 3);
      // animal preview (26:35: bottom-center at 116.75, py+110.5)
      const img = SPRITES.animal(f.species, 1, 'idle', false);
      PIXEL.blit(ctx, img, px + 56.75, py + 110.5, 3.0);
      drawText(ctx, f.label.replace(/S$/, '') + ' FARM', px + 120, py + 52.25, 8.5, '#5c3a1d', 'left', false, false, 96);
      drawText(ctx, 'UNLOCK COST:', px + 138.5, py + 72.75, 4.5, '#7d5027', 'left');
      const cost = U.fmt(CONFIG.UNLOCK_COSTS[popup.farmId]);
      ctx.drawImage(SPRITES.coin(2), px + 121.5, py + 88.5, 16, 16);
      drawText(ctx, cost, px + 141.5, py + 92.25, 8.5, '#000000', 'left');
      // unlock button
      const can = SaveManager.data.coins >= CONFIG.UNLOCK_COSTS[popup.farmId];
      popup.okRect = { x: px + 40, y: py + ph - 60, w: pw - 80, h: 40 };
      drawButton(ctx, { ...popup.okRect, color: 'green', label: 'UNLOCK', disabled: !can,
        layout: { labelY: 19, labelPx: 10, center: true } });
    } else if (popup.type === 'upgrades') {
      const f = CONFIG.FARMS[popup.farmId];
      popupTitle(ctx, 'UPGRADES!', px, py, pw, { tall: true });
      popup.cards = [];
      // section labels + card rows from Figma 19:70/19:86/19:71/19:106..30:84
      drawText(ctx, 'FARM', px + 10, py + 21.75, SIZE.CAPTION, '#e0cfa8');
      upgradeCard(ctx, popup, px + 12, py + 32, pw - 24, 76, Upgrades.info(popup.farmId, 'spawn'));
      drawText(ctx, f.label, px + 10, py + 119.75, SIZE.CAPTION, '#e0cfa8');
      for (let s = 0; s < CONFIG.UPGRADES.STAGES.length; s++) {
        upgradeCard(ctx, popup, px + 12, py + 130 + s * 98, pw - 24, 88, Upgrades.info(popup.farmId, s));
      }
      drawPanelFx(ctx);
    } else if (popup.type === 'discovery') {
      drawDiscovery(ctx, px, py, pw, ph);
    } else if (popup.type === 'pigeonAd') {
      const inf = Pigeon.info();
      // values from Figma E09 (24:2..24:51), Figma px / 2
      popupTitle(ctx, 'POOP RAIN!', px, py, pw, { size: 10, top: py - 2 });
      // parchment card
      ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 26, pw - 36, 132);
      ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 28, pw - 40, 128);
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 28, pw - 40, 3);
      // the messenger, gently bobbing, with a COO! beside its head
      popup.fxT = (popup.fxT || 0) + Game.dt;
      const bob = Math.sin(popup.fxT * 3) * 2;
      PIXEL.blit(ctx, SPRITES.pigeon('idle', false), px + 58, py + 92 + bob, 3);
      drawText(ctx, 'COO!', px + 87.5, py + 36.75, 4.5, '#7d5027', 'left');
      // reward explanation (24:37 / 30:38)
      drawText(ctx, 'WATCH AN AD', px + 97, py + 72.5, 10, '#5c3a1d', 'left', false, false, 110);
      drawText(ctx, 'POOP MEANS MONEY', px + 97, py + 88.5, 7, '#7d5027', 'left', false, false, 115);
      // scattered poop cluster (30:33..30:36, 24:40 — bottom-center anchors)
      for (const [bx2, by2] of [[73.5, 116.5], [39.25, 109], [56.5, 125], [67, 146], [39.5, 140]]) {
        PIXEL.blit(ctx, SPRITES.poop(0), px + bx2, py + by2, 1.25);
      }
      // payout: coin + big value (30:39 / 24:43)
      ctx.drawImage(SPRITES.coin(2), px + 115, py + 111, 22.5, 22.5);
      drawText(ctx, '+' + U.fmt(inf.value), px + 140.5, py + 116.5, 15, '#000000', 'left', false, false, 56);
      // watch button + note below it
      popup.okRect = { x: px + 40, y: py + 175, w: pw - 80, h: 40 };
      drawButton(ctx, { ...popup.okRect, color: 'green', icon: () => SPRITES.adPlay(), label: 'REWARD AD',
        layout: { iconX: 11, iconY: 9, iconW: 32, iconH: 24, labelX: 52.5, labelY: 17, labelPx: 10 } });
      drawText(ctx, 'COINS COLLECT AUTOMATICALLY!', px + pw / 2, py + 223.75, 4.5, '#ffffff', 'center', false, false, pw - 44);
    } else if (popup.type === 'tornadoAd') {
      // values from Figma E10 (25:2..25:48), Figma px / 2
      popupTitle(ctx, 'TORNADO ALERT!', px, py, pw, { size: 10, top: py - 2 });
      // parchment card
      ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 26, pw - 36, 132);
      ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 28, pw - 40, 128);
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 28, pw - 40, 3);
      // the storm itself, spinning and swaying (25:35: 72x84, bottom-center 116, py+127)
      popup.fxT = (popup.fxT || 0) + Game.dt;
      const frame = Math.floor(popup.fxT * 10) % 3;
      const sway = Math.sin(popup.fxT * 4) * 2;
      const timg = SPRITES.tornado(frame);
      PIXEL.blit(ctx, timg, px + 56 + sway, py + 127, 72 / timg.width);
      // reward explanation
      drawText(ctx, 'WATCH AN AD', px + 112.5, py + 60.75, 8.5, '#5c3a1d', 'left', false, false, 100);
      drawText(ctx, 'TO UNLEASH A', px + 132, py + 80.25, 4.5, '#7d5027', 'left');
      drawText(ctx, 'MERGE STORM!', px + 96.5, py + 106.5, 10, '#b8860b', 'left', false, false, 120);
      // mutants feed the UFO only where it has been unlocked
      const ufoReady = SaveManager.data.ufo[SaveManager.data.currentFarm].landed;
      drawText(ctx, ufoReady ? 'MUTANTS BECOME MUTANT 2!' : 'MERGES ALL THE WAY TO MUTANTS!',
        px + pw / 2, py + 144.25, 4.5, '#7d5027', 'center', false, false, pw - 44);
      // single watch button (dismiss via the close X)
      popup.okRect = { x: px + 40, y: py + 192, w: pw - 80, h: 40 };
      popup.cancelRect = null;
      drawButton(ctx, { ...popup.okRect, color: 'green', icon: () => SPRITES.adPlay(), label: 'REWARD AD',
        layout: { iconX: 13, iconY: 10, iconW: 32, iconH: 24, labelX: 53, labelY: 17, labelPx: 10 } });
    } else if (popup.type === 'welcomeBack') {
      drawWelcome(ctx, px, py, pw);
    } else if (popup.type === 'settings') {
      popupTitle(ctx, 'SETTINGS', px, py, pw);
      popup.musicRect = { x: px + 30, y: py + 34, w: pw - 60, h: 34 };
      popup.sfxRect = { x: px + 30, y: py + 78, w: pw - 60, h: 34 };
      popup.resetRect = { x: px + 30, y: py + 128, w: pw - 60, h: 34 };
      const lay = { labelY: 14, labelPx: 10, center: true };
      drawButton(ctx, { ...popup.musicRect, color: 'wood', label: 'MUSIC: ' + (AudioManager.musicOn ? 'ON' : 'OFF'), layout: lay });
      drawButton(ctx, { ...popup.sfxRect, color: 'wood', label: 'SOUND: ' + (AudioManager.sfxOn ? 'ON' : 'OFF'), layout: lay });
      drawButton(ctx, { ...popup.resetRect, color: 'red', label: 'RESET SAVE', layout: lay });
    } else if (popup.type === 'confirm-reset') {
      popupTitle(ctx, 'RESET GAME?', px, py, pw);
      drawText(ctx, 'ALL PROGRESS WILL BE LOST!', px + pw / 2, py + 42.5, 7.5, '#f4e8cc', 'center', false, false, pw - 40);
      popup.okRect = { x: px + 30, y: py + 84, w: pw - 60, h: 36 };
      popup.cancelRect = { x: px + 30, y: py + 130, w: pw - 60, h: 36 };
      drawButton(ctx, { ...popup.okRect, color: 'red', label: 'YES, RESET', layout: { labelY: 17, labelPx: 10, center: true } });
      drawButton(ctx, { ...popup.cancelRect, color: 'gray', label: 'CANCEL', layout: { labelY: 15, labelPx: 10, center: true } });
    }

    if (popup.closeRect) {
      drawButton(ctx, { ...popup.closeRect, color: 'red', icon: () => SPRITES.xIcon(), pressed: false,
        layout: { iconX: 6, iconY: 5, iconW: 20, iconH: 20 } });
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
    const lw = measure(label, SIZE.BUTTON);
    const lx = U.clamp(target.x + target.w / 2, lw / 2 + 6, W - lw / 2 - 6);
    drawText(ctx, label, lx, target.y - g - 22, SIZE.BUTTON, '#ffe98a', 'center', true, false, W - 12);
  }

  /** Returns true if the tap was consumed by UI. */
  function tap(x, y) {
    if (popup) {
      if (popup.type === 'welcomeBack') {
        // every way out pays at least the base amount (claim is idempotent)
        if (inRect(x, y, popup.closeRect) || inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          Game.claimWelcome(1);
        } else if (inRect(x, y, popup.adRect)) {
          // ad popup replaces this one, blocking further taps until it ends
          AudioManager.play('click');
          popup = { type: 'adPlaying', t: 0, dur: CONFIG.IDLE.WELCOME_AD_DURATION, onDone: Game.onWelcomeAdDone };
        }
        return true;
      }
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
      if (popup.type === 'adPlaying') return true; // no skipping the ad
      if (popup.type === 'pigeonAd') {
        if (inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          popup = { type: 'adPlaying', t: 0, dur: Pigeon.info().adDur, onDone: Pigeon.adCompleted };
        }
        return true;
      }
      if (popup.type === 'tornadoAd') {
        if (inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          popup = { type: 'adPlaying', t: 0, dur: Tornado.info().adDur, onDone: Tornado.adCompleted };
        } else if (inRect(x, y, popup.cancelRect)) {
          AudioManager.play('click');
          popup = null;
        }
        return true;
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
    // values from Figma E01 (14:27), all Figma px / 2
    ctx.fillStyle = '#2e2416';
    ctx.fillRect(0, 0, W, H);
    // decorative fence strip
    const f = SPRITES.fenceH(24);
    for (let x = 0; x < W; x += 44) ctx.drawImage(f, x, 380, 44, 26);
    drawText(ctx, 'FARM EVOLUTION', W / 2, 255.5, SIZE.TITLE, '#ffe98a', 'center', false, false, W - 24);
    const img = SPRITES.animal('chicken', 1, (t * 3 | 0) % 2 ? 'walk' : 'idle');
    PIXEL.blit(ctx, img, W / 2, 350, 3);
    const dots = '.'.repeat(1 + ((t * 2) | 0) % 3);
    drawText(ctx, 'TAP TO START', W / 2, 590.5, 12, '#f4e8cc', 'center');
    drawText(ctx, 'LOADING' + dots, W / 2, 420.75, 7.5, '#c8b088', 'center');
  }

  return {
    SIZE, drawText, measure, woodPanel, woodSign, drawButton, drawHUD, drawPopup, drawLoading,
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
